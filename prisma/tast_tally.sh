#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# TALLY API TEST SUITE — Synergy Bonding Solutions Pvt Ltd
# ═══════════════════════════════════════════════════════════════
# Tests all critical Tally XML API endpoints needed for the
# recovery management system.
#
# USAGE:
#   chmod +x test_tally.sh
#   ./test_tally.sh
#
# REQUIREMENTS:
#   - TallyPrime must be running and accessible at TALLY URL below
#   - curl must be installed (default on Mac/Linux)
# ═══════════════════════════════════════════════════════════════

TALLY="http://sbsp.tallycloud.in:9000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   TALLY API TEST SUITE — Synergy Bonding           ║"
echo "║   Testing connection to: $TALLY  ║"
echo "╚════════════════════════════════════════════════════╝"

# ─────────────────────────────────────────────────────────────
# TEST 1: Connection check
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}TEST 1: Connection check${NC}"
RESP=$(curl -s --max-time 10 "$TALLY")
if [[ "$RESP" == *"Running"* ]]; then
  echo -e "  ${GREEN}✅ PASS${NC} — Tally responding"
else
  echo -e "  ${RED}❌ FAIL${NC} — Tally not reachable at $TALLY"
  echo "     Make sure TallyPrime is open and the cloud server is active."
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# TEST 2: All 7 salesperson groups
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}TEST 2: Salesperson groups (Sundry Debtor sub-groups)${NC}"

GROUPS=(
  "Sundry Debtor- Sharmaji"
  "Sundry Debtor- Vikas Choudhari"
  "Sundry Debtors - Vaibhav"
  "Sundry Debtors- Sanjay Thorat"
  "Sundry Debtors - Nitin"
  "Sundry Debtors - Irshad Jamadar"
  "Sundry Debtors - Sunil Karle"
)

TOTAL_PARTIES=0
FAILED_GROUPS=()

for GROUP in "${GROUPS[@]}"; do
  COUNT=$(curl -s --max-time 30 -X POST "$TALLY" \
    -H "Content-Type: application/xml" \
    -d "<?xml version=\"1.0\" encoding=\"utf-8\"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
<REPORTNAME>Group Outstandings</REPORTNAME>
<STATICVARIABLES>
<SVEXPORTFORMAT>\$\$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE>20240401</SVFROMDATE>
<SVTODATE>20260424</SVTODATE>
<GROUPNAME>$GROUP</GROUPNAME>
</STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>" | grep -c "DSPDISPNAME")
  
  if [[ $COUNT -gt 0 ]]; then
    printf "  ${GREEN}✅${NC} %-45s ${GREEN}%3d parties${NC}\n" "$GROUP" "$COUNT"
    TOTAL_PARTIES=$((TOTAL_PARTIES + COUNT))
  else
    printf "  ${RED}❌${NC} %-45s ${RED}0 parties${NC} (check spelling)\n" "$GROUP"
    FAILED_GROUPS+=("$GROUP")
  fi
  sleep 1
done

echo ""
echo "  ─────────────────────────────────────────────────"
echo -e "  ${GREEN}TOTAL: $TOTAL_PARTIES parties across all groups${NC}"

# ─────────────────────────────────────────────────────────────
# TEST 3: Bill-wise Outstanding (invoice-level data)
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}TEST 3: Invoice-level data (Bill Outstandings)${NC}"

INV=$(curl -s --max-time 30 -X POST "$TALLY" \
  -H "Content-Type: application/xml" \
  -d "<?xml version=\"1.0\" encoding=\"utf-8\"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
<REPORTNAME>Bill Outstandings</REPORTNAME>
<STATICVARIABLES>
<SVEXPORTFORMAT>\$\$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE>20240401</SVFROMDATE>
<SVTODATE>20260424</SVTODATE>
<LEDGERNAME>Omega Designer Doors(Moshi)</LEDGERNAME>
</STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>" | grep -c "BILLNAME")

if [[ $INV -gt 0 ]]; then
  echo -e "  ${GREEN}✅ PASS${NC} — Got $INV invoices for OMEGA DESIGNER DOORS"
else
  echo -e "  ${YELLOW}⚠️  WARNING${NC} — No invoice data (may need different ledger name)"
fi

# ─────────────────────────────────────────────────────────────
# TEST 4: Ledger Vouchers (transaction history)
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}TEST 4: Transaction history (Ledger Vouchers)${NC}"

VCH=$(curl -s --max-time 30 -X POST "$TALLY" \
  -H "Content-Type: application/xml" \
  -d "<?xml version=\"1.0\" encoding=\"utf-8\"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
<REPORTNAME>Ledger Vouchers</REPORTNAME>
<STATICVARIABLES>
<SVEXPORTFORMAT>\$\$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE>20240401</SVFROMDATE>
<SVTODATE>20260424</SVTODATE>
<LEDGERNAME>Omega Designer Doors(Moshi)</LEDGERNAME>
</STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>" | grep -c "VOUCHER")

if [[ $VCH -gt 0 ]]; then
  echo -e "  ${GREEN}✅ PASS${NC} — Got $VCH voucher entries"
else
  echo -e "  ${YELLOW}⚠️  WARNING${NC} — No voucher data"
fi

# ─────────────────────────────────────────────────────────────
# TEST 5: List of Accounts (master ledger list with contacts)
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}TEST 5: Master ledger list (for contact details)${NC}"

curl -s --max-time 60 -X POST "$TALLY" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
<REPORTNAME>List of Accounts</REPORTNAME>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<ACCOUNTTYPE>Ledger</ACCOUNTTYPE>
</STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>' > /tmp/ledgers.xml

LEDGER_COUNT=$(grep -c "<LEDGER" /tmp/ledgers.xml 2>/dev/null || echo "0")
SIZE=$(ls -lh /tmp/ledgers.xml 2>/dev/null | awk '{print $5}')

if [[ $LEDGER_COUNT -gt 0 ]]; then
  echo -e "  ${GREEN}✅ PASS${NC} — Got $LEDGER_COUNT ledgers ($SIZE)"
  echo "     Saved to: /tmp/ledgers.xml"
else
  echo -e "  ${YELLOW}⚠️  WARNING${NC} — No ledgers in master list"
fi

# ─────────────────────────────────────────────────────────────
# TEST 6: Bills Receivable (alternative — all overdue at once)
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}TEST 6: Bills Receivable (all overdue invoices)${NC}"

curl -s --max-time 60 -X POST "$TALLY" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
<REPORTNAME>Bills Receivable</REPORTNAME>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE>20240401</SVFROMDATE>
<SVTODATE>20260424</SVTODATE>
</STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>' > /tmp/bills_receivable.xml

BR_COUNT=$(grep -c "BILLNAME" /tmp/bills_receivable.xml 2>/dev/null || echo "0")
BR_SIZE=$(ls -lh /tmp/bills_receivable.xml 2>/dev/null | awk '{print $5}')

if [[ $BR_COUNT -gt 0 ]]; then
  echo -e "  ${GREEN}✅ PASS${NC} — Got $BR_COUNT outstanding bills ($BR_SIZE)"
  echo "     Saved to: /tmp/bills_receivable.xml"
else
  echo -e "  ${YELLOW}⚠️  WARNING${NC} — No bills receivable data"
fi

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   TEST SUMMARY                                      ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo -e "  Connection:           ${GREEN}OK${NC}"
echo -e "  Total Parties Found:  ${GREEN}$TOTAL_PARTIES${NC}"
echo -e "  Invoice Data:         $([ $INV -gt 0 ] && echo -e "${GREEN}OK ($INV invoices)${NC}" || echo -e "${YELLOW}Limited${NC}")"
echo -e "  Voucher Data:         $([ $VCH -gt 0 ] && echo -e "${GREEN}OK ($VCH vouchers)${NC}" || echo -e "${YELLOW}Limited${NC}")"
echo -e "  Master Ledgers:       $([ $LEDGER_COUNT -gt 0 ] && echo -e "${GREEN}OK ($LEDGER_COUNT ledgers)${NC}" || echo -e "${YELLOW}Limited${NC}")"
echo -e "  Bills Receivable:     $([ $BR_COUNT -gt 0 ] && echo -e "${GREEN}OK ($BR_COUNT bills)${NC}" || echo -e "${YELLOW}Limited${NC}")"

if [[ ${#FAILED_GROUPS[@]} -gt 0 ]]; then
  echo ""
  echo -e "  ${RED}⚠️  Groups returning 0 parties (check exact spelling in Tally):${NC}"
  for G in "${FAILED_GROUPS[@]}"; do
    echo -e "     ${RED}• $G${NC}"
  done
fi

echo ""
echo "📁 Output files saved to:"
echo "   /tmp/ledgers.xml"
echo "   /tmp/bills_receivable.xml"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  All tests complete!"
echo "═══════════════════════════════════════════════════════"
echo ""