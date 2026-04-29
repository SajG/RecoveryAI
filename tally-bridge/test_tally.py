#!/usr/bin/env python3
import os
import sys
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv

GROUP_NAME = "Sundry Debtor- Sharmaji"


def normalize_tally_date_input(value: str, field_name: str) -> str:
    raw = (value or "").strip()
    if not raw:
        raise ValueError(f"{field_name} cannot be empty")

    if len(raw) == 8 and raw.isdigit():
        return raw

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y%m%d")
        except ValueError:
            continue
    raise ValueError(f"Invalid {field_name}: '{value}'")


def parse_amount(raw: str) -> float:
    if not raw:
        return 0.0
    cleaned = "".join(ch for ch in raw if ch.isdigit() or ch in ".-")
    if not cleaned or cleaned in {"-", ".", "-."}:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def build_group_outstandings_xml(from_date: str, to_date: str, group_name: str) -> str:
    return f"""<?xml version="1.0" encoding="utf-8"?>
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


def parse_parties(xml_text: str):
    root = ET.fromstring(xml_text)
    names = root.findall(".//DSPACCNAME")
    rows = root.findall(".//DSPACCINFO")
    parties = []
    for idx, row in enumerate(rows):
        name_node = names[idx] if idx < len(names) else None
        name = (name_node.findtext("DSPDISPNAME") if name_node is not None else "") or ""
        name = name.strip()
        debit = parse_amount((row.findtext(".//DSPCLDRAMTA") or "").strip())
        credit = parse_amount((row.findtext(".//DSPCLCRAMTA") or "").strip())
        outstanding = abs(debit) - credit
        if name and outstanding > 0:
            parties.append(
                {
                    "name": name,
                    "outstanding": round(outstanding, 2),
                    "debit": round(abs(debit), 2),
                    "credit": round(credit, 2),
                }
            )
    return parties


def main() -> int:
    load_dotenv()
    tally_url = os.getenv("TALLY_URL", "http://sbsp.tallycloud.in:9000")
    try:
        from_date = normalize_tally_date_input(os.getenv("FROM_DATE", "20240401"), "FROM_DATE")
        to_date_raw = os.getenv("TO_DATE", "")
        to_date = normalize_tally_date_input(to_date_raw, "TO_DATE") if to_date_raw else datetime.now().strftime("%Y%m%d")
    except ValueError as exc:
        print(f"Date configuration error: {exc}")
        return 1

    print(f"Tally URL: {tally_url}")
    print(f"Testing group: {GROUP_NAME}")
    print(f"Date range: {from_date} to {to_date}")

    try:
        ping = requests.get(tally_url, timeout=10)
        print(f"GET / status: {ping.status_code}")
        print(f"GET / body: {ping.text.strip()}")
    except Exception as exc:
        print(f"Connection test failed: {exc}")
        return 1

    xml_body = build_group_outstandings_xml(from_date, to_date, GROUP_NAME)
    try:
        response = requests.post(
            tally_url,
            headers={"Content-Type": "application/xml"},
            data=xml_body.encode("utf-8"),
            timeout=30,
        )
    except Exception as exc:
        print(f"Group fetch failed: {exc}")
        return 1

    print(f"POST status: {response.status_code}")
    if response.status_code != 200:
        print(response.text[:500])
        return 1

    try:
        parties = parse_parties(response.text)
    except Exception as exc:
        print(f"XML parse failed: {exc}")
        print(response.text[:1000])
        return 1

    print(f"Total outstanding parties found: {len(parties)}")
    print("First 5 parties:")
    for idx, party in enumerate(parties[:5], start=1):
        print(
            f"{idx}. {party['name']} | outstanding={party['outstanding']} "
            f"(debit={party['debit']}, credit={party['credit']})"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
