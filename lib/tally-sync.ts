import { prisma } from "@/lib/prisma";

type SyncType = "auto" | "manual" | "cron";

type RawInvoice = {
  invoiceRef: string;
  invoiceDate?: string;
  dueDate?: string;
  amount?: number;
  pendingAmount: number;
  overdueDays?: number;
};

type RawParty = {
  name: string;
  tallyGroup?: string;
  salespersonName?: string;
  outstanding: number;
  daysOverdue?: number;
  address?: string;
  phone?: string;
  email?: string;
  invoices?: RawInvoice[];
};

export type SyncPayload = {
  syncType?: SyncType;
  parties?: RawParty[];
  xml?: string;
};

type SyncResult = {
  partiesUpdated: number;
  invoicesUpserted: number;
  totalOutstanding: number;
};

function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Handles common Tally style date format: YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    const year = Number.parseInt(trimmed.slice(0, 4), 10);
    const month = Number.parseInt(trimmed.slice(4, 6), 10) - 1;
    const day = Number.parseInt(trimmed.slice(6, 8), 10);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(date: Date): number {
  const now = Date.now();
  const diff = now - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function extractTagValue(block: string, tags: string[]): string | undefined {
  for (const tag of tags) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`<${escapedTag}>([\\s\\S]*?)<\\/${escapedTag}>`, "i");
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

function parseInvoicesFromBlock(block: string): RawInvoice[] {
  const billBlocks = [
    ...extractBlocks(block, "BILLALLOCATIONS.LIST"),
    ...extractBlocks(block, "BILLALLOCATIONSLIST"),
  ];

  return billBlocks
    .map((billBlock) => {
      const invoiceRef =
        extractTagValue(billBlock, ["NAME", "BILLNAME", "BILLREF", "BILLREFERENCE"]) ?? "UNKNOWN-INVOICE";
      const pendingAmount = parseAmount(
        extractTagValue(billBlock, ["AMOUNT", "OPENINGBALANCE", "PENDINGAMOUNT", "BALANCE"])
      );
      const amount = parseAmount(extractTagValue(billBlock, ["BILLEDAMOUNT", "AMOUNT"]));
      const invoiceDate = extractTagValue(billBlock, ["BILLDATE", "DATE", "INVOICEDATE"]);
      const dueDate = extractTagValue(billBlock, ["DUEDATE"]);
      const overdueDaysRaw = extractTagValue(billBlock, ["OVERDUEDAYS"]);

      return {
        invoiceRef,
        invoiceDate,
        dueDate,
        amount: amount > 0 ? amount : undefined,
        pendingAmount,
        overdueDays: overdueDaysRaw ? Math.max(0, Math.floor(parseAmount(overdueDaysRaw))) : undefined,
      } satisfies RawInvoice;
    })
    .filter((invoice) => invoice.pendingAmount !== 0);
}

function parsePartiesFromXml(xml: string): RawParty[] {
  const ledgerBlocks = [...extractBlocks(xml, "LEDGER"), ...extractBlocks(xml, "PARTY"), ...extractBlocks(xml, "ACCOUNT")];
  const parties: RawParty[] = [];

  for (const block of ledgerBlocks) {
    const name = extractTagValue(block, ["NAME", "LEDGERNAME", "PARTYNAME", "ACCOUNTNAME"]);
    if (!name) continue;

    const outstanding = parseAmount(extractTagValue(block, ["CLOSINGBALANCE", "AMOUNT", "OUTSTANDING", "BALANCE"]));
    const invoices = parseInvoicesFromBlock(block);
    const maxOverdueInvoiceDays = invoices.reduce((max, item) => Math.max(max, item.overdueDays ?? 0), 0);

    const groupName = extractTagValue(block, ["PARENT", "GROUP", "GROUPNAME"]);
    const dueDateRaw = extractTagValue(block, ["DUEDATE"]);
    const dueDate = parseDate(dueDateRaw);
    const daysOverdueFromDueDate = dueDate ? daysBetween(dueDate) : 0;
    const daysOverdue = Math.max(maxOverdueInvoiceDays, daysOverdueFromDueDate);

    parties.push({
      name,
      tallyGroup: groupName,
      outstanding,
      daysOverdue,
      address: extractTagValue(block, ["ADDRESS", "MAILINGNAME"]),
      phone: extractTagValue(block, ["PHONENO", "PHONE"]),
      email: extractTagValue(block, ["EMAIL"]),
      invoices,
    });
  }

  const deduped = new Map<string, RawParty>();
  for (const party of parties) {
    // keep the row with the highest absolute outstanding if duplicated
    const existing = deduped.get(party.name);
    if (!existing || Math.abs(party.outstanding) > Math.abs(existing.outstanding)) {
      deduped.set(party.name, party);
    }
  }

  return [...deduped.values()].filter((party) => party.outstanding !== 0);
}

async function resolveSalespersonId(input: RawParty): Promise<string> {
  if (input.tallyGroup) {
    const byGroup = await prisma.salesperson.findUnique({ where: { tallyGroup: input.tallyGroup } });
    if (byGroup) return byGroup.id;
  }

  if (input.salespersonName) {
    const byName = await prisma.salesperson.findFirst({ where: { name: input.salespersonName } });
    if (byName) return byName.id;
  }

  const fallback = await prisma.salesperson.findFirst({ where: { active: true }, orderBy: { name: "asc" } });
  if (fallback) return fallback.id;

  const created = await prisma.salesperson.create({
    data: {
      name: "Unassigned",
      tallyGroup: "UNASSIGNED",
      phone: "-",
      email: "-",
      active: true,
    },
  });
  return created.id;
}

export async function applyTallySync(payload: SyncPayload): Promise<SyncResult> {
  const inputParties =
    payload.parties && payload.parties.length > 0 ? payload.parties : payload.xml ? parsePartiesFromXml(payload.xml) : [];

  if (inputParties.length === 0) {
    return { partiesUpdated: 0, invoicesUpserted: 0, totalOutstanding: 0 };
  }

  let invoicesUpserted = 0;
  let totalOutstanding = 0;

  for (const rawParty of inputParties) {
    const salespersonId = await resolveSalespersonId(rawParty);
    const partyId = `${rawParty.name}`; // unique by name in schema
    const existingParty = await prisma.party.findUnique({
      where: { name: partyId },
      select: { daysOverdue: true, daysSinceLastPayment: true },
    });
    const incomingDaysOverdue = Math.max(0, Math.floor(rawParty.daysOverdue ?? 0));
    const invoiceDerivedDaysOverdue =
      rawParty.invoices && rawParty.invoices.length > 0
        ? rawParty.invoices.reduce((max, invoice) => Math.max(max, Math.max(0, Math.floor(invoice.overdueDays ?? 0))), 0)
        : 0;
    // Manual sync may return only balances; avoid wiping useful historical overdue signals.
    const daysOverdue =
      incomingDaysOverdue > 0 || invoiceDerivedDaysOverdue > 0
        ? Math.max(incomingDaysOverdue, invoiceDerivedDaysOverdue)
        : (existingParty?.daysOverdue ?? 0);
    const daysSinceLastPayment = daysOverdue > 0 ? daysOverdue : (existingParty?.daysSinceLastPayment ?? 0);
    const outstanding = parseAmount(rawParty.outstanding);
    totalOutstanding += outstanding;

    const savedParty = await prisma.party.upsert({
      where: { name: partyId },
      create: {
        name: rawParty.name,
        salespersonId,
        phone: rawParty.phone?.trim() || "-",
        email: rawParty.email?.trim() || "-",
        address: rawParty.address?.trim() || "-",
        outstanding,
        daysOverdue,
        daysSinceLastPayment,
      },
      update: {
        salespersonId,
        phone: rawParty.phone?.trim() || "-",
        email: rawParty.email?.trim() || "-",
        address: rawParty.address?.trim() || "-",
        outstanding,
        daysOverdue,
        daysSinceLastPayment,
        lastSyncedAt: new Date(),
      },
      select: { id: true },
    });

    if (rawParty.invoices && rawParty.invoices.length > 0) {
      for (const invoice of rawParty.invoices) {
        const invoiceDate = parseDate(invoice.invoiceDate) ?? new Date();
        const dueDate = parseDate(invoice.dueDate) ?? invoiceDate;
        const pendingAmount = parseAmount(invoice.pendingAmount);
        const amount = parseAmount(invoice.amount ?? invoice.pendingAmount);
        const overdueDays =
          typeof invoice.overdueDays === "number"
            ? Math.max(0, Math.floor(invoice.overdueDays))
            : Math.max(0, daysBetween(dueDate));

        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            partyId: savedParty.id,
            invoiceRef: invoice.invoiceRef,
          },
          select: { id: true },
        });

        if (existingInvoice) {
          await prisma.invoice.update({
            where: { id: existingInvoice.id },
            data: {
              invoiceDate,
              dueDate,
              amount,
              pendingAmount,
              overdueDays,
            },
          });
        } else {
          await prisma.invoice.create({
            data: {
              partyId: savedParty.id,
              invoiceRef: invoice.invoiceRef,
              invoiceDate,
              dueDate,
              amount,
              pendingAmount,
              overdueDays,
            },
          });
        }
        invoicesUpserted += 1;
      }
    }
  }

  return {
    partiesUpdated: inputParties.length,
    invoicesUpserted,
    totalOutstanding,
  };
}
