import { NextResponse } from "next/server";
import { processBridgePayload } from "@/lib/sync";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/settings";
import type { BridgePayload } from "@/lib/validation";

type ManualSyncRequest = {
  fromDate?: string;
  toDate?: string;
};

type ContactInfo = {
  phone: string;
  email: string;
  address: string;
};

type GroupParty = {
  name: string;
  outstanding: number;
};

function sanitizeXmlEntities(text: string): string {
  // Tally occasionally returns invalid numeric XML entities that break parsing.
  const chars: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (i + 2 < text.length && text[i] === "&" && text[i + 1] === "#") {
      let j = i + 2;
      const digits: string[] = [];
      while (j < text.length && text[j] >= "0" && text[j] <= "9") {
        digits.push(text[j]);
        j += 1;
      }
      if (j < text.length && text[j] === ";" && digits.length > 0) {
        const codepoint = Number.parseInt(digits.join(""), 10);
        const isValidXmlChar =
          codepoint === 9 ||
          codepoint === 10 ||
          codepoint === 13 ||
          (codepoint >= 32 && codepoint <= 55295) ||
          (codepoint >= 57344 && codepoint <= 1114111);
        if (isValidXmlChar) {
          chars.push(text.slice(i, j + 1));
        }
        i = j + 1;
        continue;
      }
    }
    chars.push(text[i]);
    i += 1;
  }
  return chars.join("");
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value: string | undefined, maxLen = 500): string {
  const text = (value ?? "").replace(/\x00/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, maxLen);
}

function parseTallyDate(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function daysOverdue(yyyyMmDd: string): number {
  if (!yyyyMmDd) return 0;
  const parsed = new Date(yyyyMmDd);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
}

function extractTagValue(block: string, tags: string[]): string | undefined {
  for (const tag of tags) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i");
    const match = block.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractBlocks(xml: string, tag: string): string[] {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "gi");
  const blocks: string[] = [];
  let match = regex.exec(xml);
  while (match) {
    blocks.push(match[0]);
    match = regex.exec(xml);
  }
  return blocks;
}

function normalizeDateInput(value: string | undefined, fallback: Date): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    const yyyy = fallback.getUTCFullYear();
    const mm = String(fallback.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(fallback.getUTCDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  return raw.replaceAll("-", "");
}

function buildXmlRequest(reportName: string, staticVariables: string): string {
  return `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>${reportName}</REPORTNAME><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${staticVariables}</STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
}

async function fetchTallyXml(tallyUrl: string, xmlBody: string, timeoutMs = 65_000): Promise<string> {
  const baseUrl = tallyUrl.startsWith("http://") || tallyUrl.startsWith("https://") ? tallyUrl : `http://${tallyUrl}`;
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/xml" },
        body: xmlBody,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        lastError = `Tally request failed (${response.status})`;
        continue;
      }
      const rawXml = await response.text();
      return sanitizeXmlEntities(rawXml);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error.message : "Unknown Tally request error";
    }
  }
  throw new Error(lastError ?? "Tally request failed");
}

async function loadLedgerContacts(tallyUrl: string, validGroups: Set<string>): Promise<Map<string, ContactInfo>> {
  const xml = buildXmlRequest("List of Accounts", "<ACCOUNTTYPE>Ledger</ACCOUNTTYPE>");
  const text = await fetchTallyXml(tallyUrl, xml);
  const ledgerBlocks = extractBlocks(text, "LEDGER");
  const contacts = new Map<string, ContactInfo>();
  for (const block of ledgerBlocks) {
    const name = cleanText(extractTagValue(block, ["NAME"]), 200);
    if (!name) continue;
    const parent = cleanText(extractTagValue(block, ["PARENT"]), 200);
    if (validGroups.size > 0 && parent && !validGroups.has(parent)) continue;

    const phone = cleanText(extractTagValue(block, ["LEDGERMOBILE", "LEDMOBILE", "LEDGERPHONE", "LEDPHONE"]), 50);
    const email = cleanText(extractTagValue(block, ["EMAIL", "LEDEMAIL"]), 255);
    const address = cleanText(
      [
        ...extractBlocks(block, "ADDRESS.LIST").map((addrBlock) => cleanText(extractTagValue(addrBlock, ["ADDRESS"]))),
        ...extractBlocks(block, "OLDADDRESS.LIST").map((addrBlock) => cleanText(extractTagValue(addrBlock, ["OLDADDRESS"]))),
      ]
        .filter(Boolean)
        .join(", "),
      500
    );

    contacts.set(name.toLowerCase(), { phone, email, address });
  }
  return contacts;
}

async function fetchGroupParties(tallyUrl: string, fromDate: string, toDate: string, groupName: string): Promise<GroupParty[]> {
  const xml = buildXmlRequest(
    "Group Outstandings",
    `<SVFROMDATE>${fromDate}</SVFROMDATE><SVTODATE>${toDate}</SVTODATE><GROUPNAME>${groupName}</GROUPNAME>`
  );
  const text = await fetchTallyXml(tallyUrl, xml);
  const names = extractBlocks(text, "DSPACCNAME");
  const infos = extractBlocks(text, "DSPACCINFO");
  const parties: GroupParty[] = [];
  for (let idx = 0; idx < infos.length; idx += 1) {
    const nameBlock = names[idx] ?? "";
    const infoBlock = infos[idx];
    const name = cleanText(extractTagValue(nameBlock, ["DSPDISPNAME"]), 200);
    const debit = parseAmount(extractTagValue(infoBlock, ["DSPCLDRAMTA"]));
    const credit = parseAmount(extractTagValue(infoBlock, ["DSPCLCRAMTA"]));
    const outstanding = Math.max(0, Math.abs(debit) - credit);
    if (name && outstanding > 0) {
      parties.push({ name, outstanding: Math.round(outstanding * 100) / 100 });
    }
  }
  return parties;
}

async function fetchGroupPartiesWithRetry(
  tallyUrl: string,
  fromDate: string,
  toDate: string,
  groupName: string
): Promise<GroupParty[]> {
  let lastError: unknown = null;
  const delays = [0, 3000, 8000, 15000];
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
    try {
      return await fetchGroupParties(tallyUrl, fromDate, toDate, groupName);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Group outstanding fetch failed");
}

async function fetchBillsReceivableByParty(tallyUrl: string, fromDate: string, toDate: string): Promise<Record<string, BridgePayload["salespeople"][number]["parties"][number]["invoices"]>> {
  const xml = buildXmlRequest("Bills Receivable", `<SVFROMDATE>${fromDate}</SVFROMDATE><SVTODATE>${toDate}</SVTODATE>`);
  const text = await fetchTallyXml(tallyUrl, xml);
  const grouped: Record<string, BridgePayload["salespeople"][number]["parties"][number]["invoices"]> = {};

  const billRegex = /<BILLFIXED>([\s\S]*?)<\/BILLFIXED>([\s\S]*?)(?=<BILLFIXED>|$)/gi;
  let match = billRegex.exec(text);
  while (match) {
    const fixed = match[1] ?? "";
    const tail = match[2] ?? "";

    const partyName = cleanText(extractTagValue(fixed, ["BILLPARTY"]), 200);
    const ref = cleanText(extractTagValue(fixed, ["BILLREF", "BILLNAME"]), 200);
    const billDate = parseTallyDate(extractTagValue(fixed, ["BILLDATE"]));
    const dueDate = parseTallyDate(extractTagValue(tail, ["BILLDUE", "BILLDUEDATE"])) || billDate;
    const pending = Math.abs(parseAmount(extractTagValue(tail, ["BILLCL", "BILLOSAMOUNT", "BILLAMOUNT"])));
    const overdueDays = Math.max(
      Math.floor(parseAmount(extractTagValue(tail, ["BILLOVERDUE"]))),
      daysOverdue(dueDate || billDate)
    );

    if (partyName && ref && pending > 0) {
      const key = partyName.toLowerCase();
      if (!grouped[key]) grouped[key] = [];
      const dateValue = billDate || new Date().toISOString().slice(0, 10);
      const dueValue = dueDate || dateValue;
      grouped[key].push({
        ref,
        date: dateValue,
        dueDate: dueValue,
        amount: pending,
        pending,
        overdueDays,
      });
    }
    match = billRegex.exec(text);
  }

  return grouped;
}

async function fetchPartyPayments(
  tallyUrl: string,
  fromDate: string,
  toDate: string,
  partyName: string
): Promise<BridgePayload["salespeople"][number]["parties"][number]["payments"]> {
  const xml = buildXmlRequest(
    "Ledger Vouchers",
    `<SVFROMDATE>${fromDate}</SVFROMDATE><SVTODATE>${toDate}</SVTODATE><LEDGERNAME>${partyName}</LEDGERNAME>`
  );
  const text = await fetchTallyXml(tallyUrl, xml, 45_000);
  const vouchers = extractBlocks(text, "VOUCHER");
  const payments: BridgePayload["salespeople"][number]["parties"][number]["payments"] = [];

  for (const voucher of vouchers) {
    const voucherType = (extractTagValue(voucher, ["VOUCHERTYPENAME"]) ?? "").trim().toLowerCase();
    if (voucherType !== "receipt") continue;
    const paymentDate = parseTallyDate(extractTagValue(voucher, ["DATE"])) || new Date().toISOString().slice(0, 10);
    const narration = cleanText(extractTagValue(voucher, ["NARRATION"]), 200);
    const reference = cleanText(extractTagValue(voucher, ["VCHKEY", "VOUCHERNUMBER"]), 200) || `receipt-${paymentDate}`;

    const entryBlocks = extractBlocks(voucher, "ALLLEDGERENTRIES.LIST");
    let amount = 0;
    for (const entry of entryBlocks) {
      const ledgerName = (extractTagValue(entry, ["LEDGERNAME"]) ?? "").trim().toLowerCase();
      if (ledgerName === partyName.toLowerCase()) {
        amount = Math.abs(parseAmount(extractTagValue(entry, ["AMOUNT"])));
        break;
      }
    }
    if (amount <= 0 && entryBlocks.length > 0) {
      amount = Math.abs(parseAmount(extractTagValue(entryBlocks[0], ["AMOUNT"])));
    }
    if (amount <= 0) continue;

    let method = "Other";
    const lower = narration.toLowerCase();
    if (lower.includes("cheque") || lower.includes("chq")) method = "Cheque";
    else if (lower.includes("upi")) method = "UPI";
    else if (lower.includes("rtgs")) method = "RTGS";
    else if (lower.includes("neft")) method = "NEFT";
    else if (lower.includes("cash")) method = "Cash";

    payments.push({
      date: paymentDate,
      amount,
      method,
      reference,
    });
  }

  if (payments.length === 0) {
    const rowType = (extractTagValue(text, ["DSPVCHTYPE"]) ?? "").trim().toLowerCase();
    if (rowType === "rcpt" || rowType === "receipt") {
      const paymentDate = parseTallyDate(extractTagValue(text, ["DSPVCHDATE"])) || new Date().toISOString().slice(0, 10);
      const amount = Math.abs(parseAmount(extractTagValue(text, ["DSPVCHCRAMT", "DSPVCHDRAMT"])));
      const reference =
        cleanText(extractTagValue(text, ["DSPVCHNUMBER", "DSPVCHNARR"]), 200) || `receipt-${paymentDate}`;
      if (amount > 0) {
        payments.push({
          date: paymentDate,
          amount,
          method: "Other",
          reference,
        });
      }
    }
  }

  payments.sort((a, b) => b.date.localeCompare(a.date));
  return payments;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let partiesUpdated = 0;
  const failedGroups: string[] = [];

  try {
    const body = (await request.json().catch(() => ({}))) as ManualSyncRequest;
    const today = new Date();
    const fiscalStart = new Date(Date.UTC(today.getUTCFullYear(), 3, 1));
    const fromDate = normalizeDateInput(body.fromDate, fiscalStart);
    const toDate = normalizeDateInput(body.toDate, today);
    if (fromDate > toDate) {
      return NextResponse.json({ message: "Invalid date range", error: "fromDate must be <= toDate" }, { status: 400 });
    }

    const settings = await getOrCreateSettings();
    const salespeople = await prisma.salesperson.findMany({
      where: { active: true },
      select: { name: true, tallyGroup: true },
      orderBy: { name: "asc" },
    });
    if (salespeople.length === 0) {
      throw new Error("No active salespeople configured with Tally groups.");
    }

    const validGroups = new Set(salespeople.map((sp) => sp.tallyGroup));
    const contacts = await loadLedgerContacts(settings.tallyUrl, validGroups);
    const invoicesByParty = await fetchBillsReceivableByParty(settings.tallyUrl, fromDate, toDate);

    const salespeoplePayload: BridgePayload["salespeople"] = [];
    for (const salesperson of salespeople) {
      try {
        const groupParties = await fetchGroupPartiesWithRetry(
          settings.tallyUrl,
          fromDate,
          toDate,
          salesperson.tallyGroup
        );
        const parties = await mapWithConcurrency(groupParties, 3, async (party) => {
          const key = party.name.toLowerCase();
          const contact = contacts.get(key) ?? { phone: "", email: "", address: "" };
          const invoices = invoicesByParty[key] ?? [];
          const payments = await fetchPartyPayments(settings.tallyUrl, fromDate, toDate, party.name).catch(() => []);
          return {
            name: party.name,
            outstanding: party.outstanding,
            phone: contact.phone,
            email: contact.email,
            address: contact.address,
            invoices,
            payments,
          };
        });
        salespeoplePayload.push({
          name: salesperson.name,
          tallyGroup: salesperson.tallyGroup,
          parties,
        });
      } catch (error) {
        failedGroups.push(`${salesperson.name} (${salesperson.tallyGroup})`);
        console.error(`Manual sync group fetch failed for ${salesperson.tallyGroup}`, error);
      }
    }

    if (salespeoplePayload.length === 0) {
      throw new Error(
        `Could not fetch data from any Tally group. Failed groups: ${failedGroups.join(", ")}`
      );
    }

    const payload: BridgePayload = {
      timestamp: new Date().toISOString(),
      fromDate: `${fromDate.slice(0, 4)}-${fromDate.slice(4, 6)}-${fromDate.slice(6, 8)}`,
      toDate: `${toDate.slice(0, 4)}-${toDate.slice(4, 6)}-${toDate.slice(6, 8)}`,
      company: settings.companyName,
      salespeople: salespeoplePayload,
    };

    const stats = await processBridgePayload(payload);
    partiesUpdated = stats.parties;
    const totalOutstanding = payload.salespeople
      .flatMap((sp) => sp.parties)
      .reduce((sum, party) => sum + party.outstanding, 0);

    const status = failedGroups.length > 0 ? "partial" : "success";
    const partialErrorMessage =
      failedGroups.length > 0 ? `Some groups failed to sync: ${failedGroups.join(", ")}` : null;

    await prisma.syncLog.create({
      data: {
        syncType: "manual",
        status,
        partiesUpdated: stats.parties,
        durationMs: Date.now() - startedAt,
        errorMessage: partialErrorMessage,
      },
    });

    return NextResponse.json({
      message:
        failedGroups.length > 0
          ? `Manual Tally sync partially completed (${failedGroups.length} groups failed)`
          : "Manual Tally sync completed",
      fromDate: `${fromDate.slice(0, 4)}-${fromDate.slice(4, 6)}-${fromDate.slice(6, 8)}`,
      toDate: `${toDate.slice(0, 4)}-${toDate.slice(4, 6)}-${toDate.slice(6, 8)}`,
      partiesUpdated: stats.parties,
      invoicesUpserted: stats.invoices,
      totalOutstanding,
      paymentsUpserted: stats.payments,
      failedGroups,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Manual sync failed";
    console.error("Manual Tally sync failed", error);

    await prisma.syncLog.create({
      data: {
        syncType: "manual",
        status: "failed",
        partiesUpdated,
        durationMs: Date.now() - startedAt,
        errorMessage,
      },
    });

    return NextResponse.json({ message: "Unable to run manual Tally sync", error: errorMessage }, { status: 500 });
  }
}
