#!/usr/bin/env python3
from __future__ import annotations

import datetime
import json
import logging
from logging.handlers import RotatingFileHandler
import os
import sys
import time
import xml.etree.ElementTree as ET

import requests
from dotenv import load_dotenv

SALESPEOPLE = {
    "Om Sharma": "Sundry Debtor- Sharmaji",
    "Vikas Choudhari": "Sundry Debtor- Vikas Choudhari",
    "Vaibhav Ghatpande": "Sundry Debtors - Vaibhav",
    "Sanjay Thorat": "Sundry Debtors- Sanjay Thorat",
    "Nitin Kosandar": "Sundry Debtors - Nitin",
    "Irshad Jamadar": "Sundry Debtors - Irshad Jamadar",
    "Sunil Karle": "Sundry Debtors - Sunil Karle",
}

COMPANY_NAME = "SYNERGY BONDING SOLUTIONS PVT LTD"
CONTACT_CACHE: dict[str, dict[str, str]] = {}


def parse_amount(value: str | None) -> float:
    if not value:
        return 0.0
    cleaned = "".join(ch for ch in value if ch.isdigit() or ch in ".-")
    if not cleaned or cleaned in {"-", ".", "-."}:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def clean_text(value: str, max_len: int) -> str:
    text = " ".join((value or "").replace("\x00", " ").split())
    return text[:max_len]


def parse_tally_date(value: str | None) -> str:
    if not value:
        return ""
    raw = value.strip()
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    # Common Tally date style: 11-Apr-26
    for fmt in ("%d-%b-%y", "%d-%b-%Y", "%d-%B-%y", "%d-%B-%Y"):
        try:
            parsed = datetime.datetime.strptime(raw, fmt).date()
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def normalize_tally_date_input(value: str, field_name: str) -> str:
    raw = (value or "").strip()
    if not raw:
        raise ValueError(f"{field_name} cannot be empty")

    if len(raw) == 8 and raw.isdigit():
        return raw

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
        try:
            parsed = datetime.datetime.strptime(raw, fmt).date()
            return parsed.strftime("%Y%m%d")
        except ValueError:
            continue

    raise ValueError(
        f"Invalid {field_name}: '{value}'. Use YYYYMMDD, YYYY-MM-DD, or DD-MM-YYYY."
    )


def get_date_range() -> tuple[str, str]:
    from_date = normalize_tally_date_input(os.environ["FROM_DATE"], "FROM_DATE")
    to_date_raw = os.environ.get("TO_DATE", "").strip()
    to_date = normalize_tally_date_input(to_date_raw, "TO_DATE") if to_date_raw else datetime.datetime.now().strftime("%Y%m%d")
    if from_date > to_date:
        raise ValueError(f"FROM_DATE ({from_date}) cannot be later than TO_DATE ({to_date})")
    return from_date, to_date


def days_overdue(due_date_yyyy_mm_dd: str) -> int:
    if not due_date_yyyy_mm_dd:
        return 0
    try:
        due = datetime.datetime.strptime(due_date_yyyy_mm_dd, "%Y-%m-%d").date()
        now = datetime.datetime.now().date()
        return max(0, (now - due).days)
    except ValueError:
        return 0


def post_tally_xml(xml_payload: str, timeout_sec: int = 60) -> str:
    tally_url = os.environ["TALLY_URL"]
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            response = requests.post(
                tally_url,
                headers={"Content-Type": "application/xml"},
                data=xml_payload.encode("utf-8"),
                timeout=timeout_sec,
            )
            response.raise_for_status()
            return response.text
        except Exception as exc:
            last_error = exc
            logging.warning("Tally XML call attempt %s failed: %s", attempt, exc)
            if attempt < 3:
                time.sleep(attempt * 2)
    raise RuntimeError(f"Tally XML request failed after retries: {last_error}")


def sanitize_xml_entities(text: str) -> str:
    # Tally may occasionally return invalid XML numeric entities (e.g. control chars).
    chars = []
    i = 0
    while i < len(text):
        if i + 2 < len(text) and text[i] == "&" and text[i + 1] == "#":
            j = i + 2
            digits = []
            while j < len(text) and text[j].isdigit():
                digits.append(text[j])
                j += 1
            if j < len(text) and text[j] == ";" and digits:
                try:
                    codepoint = int("".join(digits))
                except ValueError:
                    codepoint = 0
                if codepoint in (9, 10, 13) or (32 <= codepoint <= 55295) or (57344 <= codepoint <= 1114111):
                    chars.append(text[i : j + 1])
                # else drop invalid numeric reference
                i = j + 1
                continue
        chars.append(text[i])
        i += 1
    return "".join(chars)


def parse_xml(text: str) -> ET.Element:
    try:
        return ET.fromstring(text)
    except ET.ParseError:
        cleaned = sanitize_xml_entities(text)
        return ET.fromstring(cleaned)


def test_tally_connection() -> bool:
    try:
        response = requests.get(os.environ["TALLY_URL"], timeout=10)
        body = response.text.strip()
        ok = response.status_code == 200 and body == "<RESPONSE>TallyPrime Server is Running</RESPONSE>"
        if not ok:
            logging.error("Tally connection test failed. status=%s body=%s", response.status_code, body)
        return ok
    except Exception as exc:
        logging.error("Tally connection error: %s", exc)
        return False


def fetch_group_parties(group_name: str) -> list[dict]:
    from_date, to_date = get_date_range()
    xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>Group Outstandings</REPORTNAME>
    <STATICVARIABLES>
      <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      <SVFROMDATE>{from_date}</SVFROMDATE>
      <SVTODATE>{to_date}</SVTODATE>
      <GROUPNAME>{group_name}</GROUPNAME>
    </STATICVARIABLES>
  </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>"""
    text = post_tally_xml(xml_payload)
    root = parse_xml(text)
    names = root.findall(".//DSPACCNAME")
    infos = root.findall(".//DSPACCINFO")
    parties = []
    for idx, info in enumerate(infos):
        name_node = names[idx] if idx < len(names) else None
        party_name = (name_node.findtext("DSPDISPNAME") if name_node is not None else "") or ""
        party_name = party_name.strip()
        debit = parse_amount(info.findtext(".//DSPCLDRAMTA"))
        credit = parse_amount(info.findtext(".//DSPCLCRAMTA"))
        net_outstanding = abs(debit) - credit
        if party_name and net_outstanding > 0:
            parties.append(
                {
                    "name": party_name,
                    "outstanding": round(net_outstanding, 2),
                    "debit": round(abs(debit), 2),
                    "credit": round(credit, 2),
                }
            )
    return parties


def fetch_party_invoices(party_name: str) -> list[dict]:
    return fetch_all_bills_receivable().get(party_name.lower(), [])


def fetch_all_bills_receivable() -> dict[str, list[dict]]:
    from_date, to_date = get_date_range()
    xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>Bills Receivable</REPORTNAME>
    <STATICVARIABLES>
      <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      <SVFROMDATE>{from_date}</SVFROMDATE>
      <SVTODATE>{to_date}</SVTODATE>
    </STATICVARIABLES>
  </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>"""
    text = post_tally_xml(xml_payload)
    root = parse_xml(text)
    grouped: dict[str, list[dict]] = {}
    children = list(root)
    now_date = datetime.datetime.now().strftime("%Y-%m-%d")

    idx = 0
    while idx < len(children):
        node = children[idx]
        if node.tag != "BILLFIXED":
            idx += 1
            continue

        party_name = (node.findtext("BILLPARTY") or "").strip()
        bill_ref = (node.findtext("BILLREF") or node.findtext("BILLNAME") or "").strip()
        bill_date = parse_tally_date(node.findtext("BILLDATE"))

        pending = 0.0
        due_date = ""
        overdue_days = 0

        lookahead = idx + 1
        while lookahead < len(children) and children[lookahead].tag != "BILLFIXED":
            tag = children[lookahead].tag
            text_value = (children[lookahead].text or "").strip()
            if tag in {"BILLCL", "BILLOSAMOUNT", "BILLAMOUNT"}:
                pending = parse_amount(text_value)
            elif tag in {"BILLDUE", "BILLDUEDATE"}:
                due_date = parse_tally_date(text_value)
            elif tag == "BILLOVERDUE":
                overdue_days = int(parse_amount(text_value))
            lookahead += 1

        if party_name and bill_ref and abs(pending) > 0:
            party_key = party_name.lower()
            grouped.setdefault(party_key, []).append(
                {
                    "ref": bill_ref,
                    "date": bill_date or now_date,
                    "dueDate": due_date or bill_date or now_date,
                    "amount": round(abs(pending), 2),
                    "pending": round(abs(pending), 2),
                    "overdueDays": max(overdue_days, days_overdue(due_date or bill_date)),
                }
            )

        idx = lookahead

    return grouped


def fetch_party_payments(party_name: str) -> list[dict]:
    from_date, to_date = get_date_range()
    xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>Ledger Vouchers</REPORTNAME>
    <STATICVARIABLES>
      <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      <SVFROMDATE>{from_date}</SVFROMDATE>
      <SVTODATE>{to_date}</SVTODATE>
      <LEDGERNAME>{party_name}</LEDGERNAME>
    </STATICVARIABLES>
  </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>"""
    text = post_tally_xml(xml_payload)
    root = parse_xml(text)
    payments = []
    vouchers = root.findall(".//VOUCHER")
    if vouchers:
        for voucher in vouchers:
            vtype = (voucher.findtext("VOUCHERTYPENAME") or "").strip().lower()
            if vtype != "receipt":
                continue
            payment_date = parse_tally_date(voucher.findtext("DATE"))
            narration = (voucher.findtext("NARRATION") or "").strip()
            method = "Other"
            narration_lower = narration.lower()
            if "cheque" in narration_lower or "chq" in narration_lower:
                method = "Cheque"
            elif "upi" in narration_lower:
                method = "UPI"
            elif "rtgs" in narration_lower:
                method = "RTGS"
            elif "neft" in narration_lower:
                method = "NEFT"
            elif "cash" in narration_lower:
                method = "Cash"

            amount = 0.0
            for entry in voucher.findall(".//ALLLEDGERENTRIES.LIST"):
                entry_name = (entry.findtext("LEDGERNAME") or "").strip()
                if entry_name.lower() == party_name.lower():
                    amount = abs(parse_amount(entry.findtext("AMOUNT")))
                    break
            if amount == 0.0:
                entry = voucher.find(".//ALLLEDGERENTRIES.LIST")
                amount = abs(parse_amount(entry.findtext("AMOUNT") if entry is not None else ""))

            reference = (voucher.findtext("VCHKEY") or voucher.findtext("VOUCHERNUMBER") or "").strip()
            if amount > 0:
                payments.append(
                    {
                        "date": payment_date or datetime.datetime.now().strftime("%Y-%m-%d"),
                        "amount": round(amount, 2),
                        "method": method,
                        "reference": reference or f"receipt-{payment_date or 'na'}",
                    }
                )
    else:
        # Some Tally instances return condensed DSP-style voucher rows instead of <VOUCHER> blocks.
        row_type = (root.findtext(".//DSPVCHTYPE") or "").strip().lower()
        if row_type in {"rcpt", "receipt"}:
            payment_date = parse_tally_date(root.findtext(".//DSPVCHDATE"))
            amount = abs(parse_amount(root.findtext(".//DSPVCHCRAMT") or root.findtext(".//DSPVCHDRAMT")))
            reference = (root.findtext(".//DSPVCHNUMBER") or root.findtext(".//DSPVCHNARR") or "").strip()
            if amount > 0:
                payments.append(
                    {
                        "date": payment_date or datetime.datetime.now().strftime("%Y-%m-%d"),
                        "amount": round(amount, 2),
                        "method": "Other",
                        "reference": reference or f"receipt-{payment_date or 'na'}",
                    }
                )
    payments.sort(key=lambda item: item["date"], reverse=True)
    return payments


def load_ledger_cache() -> None:
    xml_payload = """<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>List of Accounts</REPORTNAME>
    <STATICVARIABLES>
      <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      <ACCOUNTTYPE>Ledger</ACCOUNTTYPE>
    </STATICVARIABLES>
  </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>"""
    text = post_tally_xml(xml_payload)
    root = parse_xml(text)
    CONTACT_CACHE.clear()
    valid_groups = set(SALESPEOPLE.values())
    for ledger in root.findall(".//LEDGER"):
        name = (ledger.attrib.get("NAME") or ledger.findtext("NAME") or "").strip()
        if not name:
            continue
        parent_group = (ledger.findtext("PARENT") or "").strip()
        if parent_group and parent_group not in valid_groups:
            continue
        phone = (
            ledger.findtext("LEDGERMOBILE")
            or ledger.findtext("LEDMOBILE")
            or ledger.findtext("LEDGERPHONE")
            or ledger.findtext("LEDPHONE")
            or ""
        ).strip()
        email = (ledger.findtext("EMAIL") or ledger.findtext("LEDEMAIL") or "").strip()
        mailing_name = (ledger.findtext("MAILINGNAME") or ledger.findtext("LEDMAILINGNAME") or "").strip()
        address_lines = []
        for addr in ledger.findall(".//ADDRESS.LIST") + ledger.findall(".//OLDADDRESS.LIST") + ledger.findall(".//LEDADDRESS.LIST"):
            for line in addr.findall("ADDRESS") + addr.findall("OLDADDRESS") + addr.findall("LEDADDRESS"):
                val = (line.text or "").strip()
                if val:
                    address_lines.append(val)
        address = ", ".join(address_lines)
        CONTACT_CACHE[name.lower()] = {
            "phone": clean_text(phone, 50),
            "email": clean_text(email, 255),
            "address": clean_text(address, 500),
            "mailingName": clean_text(mailing_name, 255),
        }
    logging.info("Loaded ledger contact cache: %s entries", len(CONTACT_CACHE))


def fetch_party_contact(party_name: str) -> dict:
    cached = CONTACT_CACHE.get(party_name.lower(), {})
    return {
        "phone": cached.get("phone", ""),
        "email": cached.get("email", ""),
        "address": cached.get("address", ""),
    }


def build_payload() -> dict:
    if not test_tally_connection():
        raise RuntimeError("Tally is unreachable or did not return expected health response.")

    load_ledger_cache()
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
    from_date_raw, to_date_raw = get_date_range()
    from_date = f"{from_date_raw[0:4]}-{from_date_raw[4:6]}-{from_date_raw[6:8]}"
    to_date = f"{to_date_raw[0:4]}-{to_date_raw[4:6]}-{to_date_raw[6:8]}"

    all_invoices_by_party = fetch_all_bills_receivable()
    salespeople_payload = []
    for salesperson_name, group_name in SALESPEOPLE.items():
        logging.info("Fetching group outstandings: %s (%s)", salesperson_name, group_name)
        try:
            group_parties = fetch_group_parties(group_name)
        except Exception as exc:
            logging.error("Failed group fetch for %s: %s", group_name, exc)
            group_parties = []
        party_payload = []
        for party in group_parties:
            party_name = party["name"]
            contact = fetch_party_contact(party_name)
            invoices = all_invoices_by_party.get(party_name.lower(), [])
            payments = []
            try:
                payments = fetch_party_payments(party_name)
            except Exception as exc:
                logging.warning("Payment fetch failed for '%s': %s", party_name, exc)

            party_payload.append(
                {
                    "name": party_name,
                    "outstanding": party["outstanding"],
                    "phone": contact["phone"],
                    "email": contact["email"],
                    "address": contact["address"],
                    "invoices": invoices,
                    "payments": payments,
                }
            )
        salespeople_payload.append(
            {
                "name": salesperson_name,
                "tallyGroup": group_name,
                "parties": party_payload,
            }
        )

    return {
        "timestamp": now.isoformat(),
        "fromDate": from_date,
        "toDate": to_date,
        "company": COMPANY_NAME,
        "salespeople": salespeople_payload,
    }


def push_to_vercel(payload: dict) -> dict:
    url = os.environ["VERCEL_API_URL"]
    secret = os.environ["BRIDGE_SECRET"]
    backoff_seconds = [5, 15, 45]
    last_error: Exception | None = None
    timeout_seconds = int(os.environ.get("VERCEL_PUSH_TIMEOUT", "300"))
    max_attempts = 5
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                url,
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Content-Type": "application/json",
                },
                data=json.dumps(payload),
                timeout=timeout_seconds,
            )
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                wait_seconds = int(retry_after) if retry_after and retry_after.isdigit() else 65
                raise RuntimeError(f"HTTP 429: rate limited; retry in {wait_seconds}s")
            if response.status_code >= 400:
                raise RuntimeError(f"HTTP {response.status_code}: {response.text[:500]}")
            return response.json()
        except Exception as exc:
            last_error = exc
            logging.error("Push attempt %s failed: %s", attempt, exc)
            if attempt < max_attempts:
                msg = str(exc).lower()
                if "429" in msg or "rate limited" in msg:
                    time.sleep(65)
                else:
                    idx = min(attempt - 1, len(backoff_seconds) - 1)
                    time.sleep(backoff_seconds[idx])
    raise RuntimeError(f"Failed to push payload after retries: {last_error}")


def setup_logging() -> None:
    log_file = os.environ.get("LOG_FILE", "./tally-bridge.log")
    log_dir = os.path.dirname(log_file)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    rotating_handler = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5)
    rotating_handler.setFormatter(formatter)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    root_logger.handlers = [rotating_handler, stream_handler]


def main() -> None:
    load_dotenv()
    setup_logging()
    start_time = datetime.datetime.now().isoformat()
    logging.info("Starting Tally bridge sync at %s", start_time)

    required_keys = ["TALLY_URL", "VERCEL_API_URL", "BRIDGE_SECRET", "FROM_DATE"]
    missing = [key for key in required_keys if not os.environ.get(key)]
    if missing:
        error = f"Missing required env keys: {', '.join(missing)}"
        logging.error(error)
        with open("/tmp/tally-bridge-error.txt", "w", encoding="utf-8") as handle:
            handle.write(error)
        sys.exit(1)

    try:
        payload = build_payload()
        response = push_to_vercel(payload)
        stats = response.get("stats", {})
        logging.info("Bridge sync success. stats=%s", json.dumps(stats))
        sys.exit(0)
    except Exception as exc:
        logging.error("Bridge sync failed: %s", exc, exc_info=True)
        with open("/tmp/tally-bridge-error.txt", "w", encoding="utf-8") as handle:
            handle.write(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
