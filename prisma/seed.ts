import "./load-env";
import {
  ActionOutcome,
  ActionType,
  PaymentMethod,
  Prisma,
  PrismaClient,
  SyncStatus,
  SyncType,
} from "@prisma/client";

const prisma = new PrismaClient();

type PartySeed = {
  name: string;
  outstanding: number;
  daysOverdue: number;
  address: string;
};

const salespeople = [
  { name: "Om Sharma", tallyGroup: "OM-GROUP", phone: "9898123401", email: "om.sharma@synergyrecovery.in" },
  { name: "Vikas Choudhari", tallyGroup: "VIKAS-GROUP", phone: "9898123402", email: "vikas.choudhari@synergyrecovery.in" },
  { name: "Vaibhav Ghatpande", tallyGroup: "VAIBHAV-GROUP", phone: "9898123403", email: "vaibhav.ghatpande@synergyrecovery.in" },
  { name: "Sanjay Thorat", tallyGroup: "SANJAY-GROUP", phone: "9898123404", email: "sanjay.thorat@synergyrecovery.in" },
  { name: "Nitin Kosandar", tallyGroup: "NITIN-GROUP", phone: "9898123405", email: "nitin.kosandar@synergyrecovery.in" },
  { name: "Irshad Jamadar", tallyGroup: "IRSHAD-GROUP", phone: "9898123406", email: "irshad.jamadar@synergyrecovery.in" },
  { name: "Sunil Karle", tallyGroup: "SUNIL-GROUP", phone: "9898123407", email: "sunil.karle@synergyrecovery.in" },
];

const omParties: PartySeed[] = [
  { name: "TULSI PLYWOOD & HARDWARE", outstanding: 722726, daysOverdue: 33, address: "Shop 14, Timber Market, Bhawani Peth, Pune" },
  { name: "OMEGA DESIGNER DOORS", outstanding: 682806, daysOverdue: 215, address: "S.No. 23, Kondhwa Khurd, Pune" },
  { name: "VOHRA BROTHERS", outstanding: 508098, daysOverdue: 159, address: "Ganesh Peth Road, Pune" },
  { name: "SADHANA DOORS MANUFACTURING", outstanding: 442341, daysOverdue: 67, address: "Chakan MIDC, Pune" },
  { name: "MATRIXX DOORS & PLY", outstanding: 343534, daysOverdue: 420, address: "Bhosari Industrial Area, Pune" },
  { name: "SURFACE DEKOR PUNE LLP", outstanding: 329078, daysOverdue: 0, address: "Pimple Saudagar Main Road, Pune" },
  { name: "INTRADOOR INDUSTRIES", outstanding: 310908, daysOverdue: 118, address: "Wagholi, Pune Nagar Road, Pune" },
  { name: "HANUMAN MODULAR COMPANY", outstanding: 309545, daysOverdue: 159, address: "Akurdi Pradhikaran, Pune" },
  { name: "DEXARTE INDIA PVT LTD", outstanding: 257939, daysOverdue: 60, address: "Talawade IT Park Road, Pune" },
  { name: "SATYAM ACRYLIC DOOR", outstanding: 153640, daysOverdue: 280, address: "Thergaon, Pune" },
  { name: "BHAGAWATI STEEL HOUSE", outstanding: 140420, daysOverdue: 0, address: "Market Yard, Pune" },
  { name: "AVENTIS SURFACE PVT LTD", outstanding: 118876, daysOverdue: 69, address: "Narhe, Pune" },
  { name: "Mahalaxmi Modular MOSHI", outstanding: 100000, daysOverdue: 118, address: "Moshi Alandi Road, Pune" },
  { name: "UMIYA TREDERS", outstanding: 96465, daysOverdue: 244, address: "Dhanori Lohegaon Road, Pune" },
  { name: "A AND G FURNITURE KONDHAWA", outstanding: 95760, daysOverdue: 0, address: "Kondhwa Budruk, Pune" },
  { name: "HARE KRISHNA HARDWARE", outstanding: 91981, daysOverdue: 67, address: "Warje Malwadi, Pune" },
  { name: "CHINTAMANI DECORE TIMBER MARKET", outstanding: 83261, daysOverdue: 45, address: "Timber Market, Bhawani Peth, Pune" },
  { name: "VIKAS KITCHEN AND INTERIORS DESIGNERS", outstanding: 82097, daysOverdue: 256, address: "Katraj Kondhwa Road, Pune" },
  { name: "SANT JAGADGURU FURNITURE", outstanding: 79493, daysOverdue: 35, address: "Hadapsar Industrial Estate, Pune" },
  { name: "KPS PROJECTS AND INTERIORS", outstanding: 77440, daysOverdue: 33, address: "Baner Pashan Link Road, Pune" },
  { name: "Nirmitee Decors", outstanding: 76376, daysOverdue: 248, address: "Sinhagad Road, Pune" },
  { name: "HARI OM PLY KATRAJ", outstanding: 74269, daysOverdue: 67, address: "Katraj Chowk, Pune" },
  { name: "Siddhi Ply and Veneers Bhavani Peth", outstanding: 71508, daysOverdue: 118, address: "Bhavani Peth, Pune" },
  { name: "HOME INTERIOR PISOLI", outstanding: 70360, daysOverdue: 248, address: "Pisoli, Pune" },
  { name: "RD ENTERPRISES", outstanding: 56994, daysOverdue: 67, address: "Khadki Bazaar, Pune" },
  { name: "SAMSHED PLYWOOD", outstanding: 56640, daysOverdue: 25, address: "Camp, Pune" },
  { name: "METPHI Mumbai", outstanding: 50000, daysOverdue: 164, address: "Transport Nagar, Pune (Mumbai supply office)" },
  { name: "JAGADGURU ENTERPRISES DEHU", outstanding: 48144, daysOverdue: 118, address: "Dehu Phata, Pune" },
  { name: "VIGHNAHARTA PLYWOOD CHIKHALI", outstanding: 46728, daysOverdue: 42, address: "Chikhali Spine Road, Pune" },
  { name: "MAJISHA ENTERPRISES", outstanding: 43896, daysOverdue: 40, address: "Ravet, Pune" },
  { name: "SWAMI KRUPA PLYWOOD TIMBER MARKET", outstanding: 42543, daysOverdue: 59, address: "Timber Market, Pune" },
  { name: "OM PLYWOOD JALGAON", outstanding: 42000, daysOverdue: 52, address: "Distributor billing desk, Pune" },
  { name: "NARPATSINGH ENTERPRISE WARJE", outstanding: 41742, daysOverdue: 194, address: "Warje Service Road, Pune" },
  { name: "AAIJI HARDWARE MOSHI", outstanding: 41300, daysOverdue: 28, address: "Moshi Chikhali Road, Pune" },
  { name: "KRISHNA PLYWOOD CHIKHALI", outstanding: 41042, daysOverdue: 31, address: "Chikhali Kudalwadi, Pune" },
  { name: "HARIOM PLY SANE CHOWK", outstanding: 40710, daysOverdue: 38, address: "Sane Chowk, Chinchwad, Pune" },
  { name: "Nita Traders Bhawanipeth", outstanding: 40000, daysOverdue: 27, address: "Bhawani Peth, Pune" },
  { name: "MAHESH PLYWOOD CENTER", outstanding: 39350, daysOverdue: 48, address: "Nigdi, Pune" },
  { name: "JINENDRA PLY WARJE", outstanding: 38115, daysOverdue: 54, address: "Warje, Pune" },
  { name: "ASHAPURA POSTFORMING", outstanding: 35683, daysOverdue: 72, address: "Pimpri MIDC, Pune" },
  { name: "VINAYAK PLY PIMPLE GURAV", outstanding: 33162, daysOverdue: 44, address: "Pimple Gurav, Pune" },
  { name: "VEDIK MODULAR RAVET", outstanding: 31152, daysOverdue: 33, address: "Ravet, Pune" },
  { name: "SPARK INTERIOR", outstanding: 27348, daysOverdue: 25, address: "Wakad, Pune" },
  { name: "Bajrangbali Steel Furniture Moshi", outstanding: 27081, daysOverdue: 57, address: "Moshi, Pune" },
  { name: "D. K. KITCHEN MAKERS", outstanding: 25488, daysOverdue: 36, address: "Kondhwa, Pune" },
  { name: "BRS INTERIOR FURNITURE", outstanding: 24072, daysOverdue: 56, address: "Hinjawadi Phase 1, Pune" },
  { name: "Shree Ply & Hardware Warje", outstanding: 24072, daysOverdue: 46, address: "Warje, Pune" },
  { name: "POONAM PLY AKURDI", outstanding: 23647, daysOverdue: 34, address: "Akurdi, Pune" },
  { name: "LALITA ENTERPRISES AMBEGON", outstanding: 23081, daysOverdue: 29, address: "Ambegaon Pathar, Pune" },
  { name: "GAYATRI PLYWOOD PIMPRI", outstanding: 20414, daysOverdue: 41, address: "Pimpri Camp, Pune" },
  { name: "MAHAVEER PLYWOOD KAMSHET", outstanding: 17700, daysOverdue: 269, address: "Kamshet Highway, Pune District" },
  { name: "PREM PLYWOOD SHAHUNAGAR", outstanding: 17574, daysOverdue: 32, address: "Shahunagar, Chinchwad, Pune" },
  { name: "V K SANGHVI TIMBER MARKET", outstanding: 17201, daysOverdue: 47, address: "Timber Market, Pune" },
  { name: "COSMO INC", outstanding: 14843, daysOverdue: 39, address: "Pimple Nilakh, Pune" },
  { name: "TRISHA ENTERPRISES URULIKANCHAN", outstanding: 13570, daysOverdue: 26, address: "Uruli Kanchan, Pune" },
  { name: "SURAKSHA DOORS", outstanding: 13570, daysOverdue: 52, address: "Bhosari, Pune" },
  { name: "SHREE MAHALAXMI PLYWOOD MALEGAON", outstanding: 11505, daysOverdue: 35, address: "Malegaon BK Road, Pune District" },
  { name: "CHINTAMANI PLYWOOD THEUR PHATA", outstanding: 10570, daysOverdue: 40, address: "Theur Phata, Pune" },
  { name: "DEVRAJ PLYWOOD KALEWADI", outstanding: 10090, daysOverdue: 37, address: "Kalewadi, Pune" },
  { name: "Gayatri Industries Chinchwad", outstanding: 8850, daysOverdue: 18, address: "Chinchwad, Pune" },
  { name: "VARDHAMAN PLY TIMBER MARKET", outstanding: 8024, daysOverdue: 21, address: "Timber Market, Pune" },
  { name: "SHREE MURTI KRUPS PLY", outstanding: 6570, daysOverdue: 171, address: "Dapodi, Pune" },
  { name: "ZAM ZAM TRADING SHARMAJI", outstanding: 6000, daysOverdue: 23, address: "Camp, Pune" },
  { name: "GLOBAL DOOR'S", outstanding: 6018, daysOverdue: 30, address: "Bopodi, Pune" },
  { name: "Jai Trading Company Rahatani", outstanding: 5664, daysOverdue: 24, address: "Rahatani, Pune" },
  { name: "PLY STUDIO", outstanding: 5700, daysOverdue: 27, address: "Balewadi, Pune" },
  { name: "A. R. ENTERPRISES Kalewadi", outstanding: 4000, daysOverdue: 20, address: "Kalewadi Main Road, Pune" },
  { name: "MAFATLAL ENTERPRISES", outstanding: 4036, daysOverdue: 17, address: "Yerawada, Pune" },
  { name: "LAMINATE EMPIRE WADKI", outstanding: 3375, daysOverdue: 67, address: "Wadki, Pune" },
  { name: "TEAK PLYWOOD AND HARDWARE", outstanding: 2470, daysOverdue: 30, address: "Katraj, Pune" },
  { name: "SHAH TRADERS MOSHI", outstanding: 2085, daysOverdue: 19, address: "Moshi, Pune" },
  { name: "SHREE NAGESHWAR PLYWOOD MOSHI", outstanding: 720, daysOverdue: 8, address: "Moshi, Pune" },
  { name: "MORYA WOODEN CARVING CENTER", outstanding: 546, daysOverdue: 10, address: "Ravet, Pune" },
  { name: "JOGESHWARI ENTERPRISES", outstanding: 36, daysOverdue: 2, address: "Bhosari, Pune" },
];

const mockPartyPool = [
  "Shivam Plywood & Hardware",
  "Royal Modular Interiors",
  "Ganesh Hardware Mart",
  "Sai Samarth Doors",
  "Pratham Veneers",
  "Venkatesh Timber & Ply",
  "Classic Kitchen Studio",
  "Morya Interior Solutions",
  "Arihant Plywood House",
  "Sankalp Contractors",
  "Omkar Furnitech",
  "Pioneer Laminates",
];

function slugEmail(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
  return `${slug || "party"}@gmail.com`;
}

function phoneFor(seed: number): string {
  return `98${(10000000 + seed).toString().slice(-8)}`;
}

function decimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

function computePriority(outstanding: number, daysOverdue: number): string {
  if (outstanding >= 500000 || daysOverdue >= 180) return "Critical";
  if (outstanding >= 200000 || daysOverdue >= 90) return "High";
  if (outstanding >= 50000 || daysOverdue >= 30) return "Medium";
  return "Low";
}

function computeRisk(priority: string, daysOverdue: number): number {
  const base = priority === "Critical" ? 85 : priority === "High" ? 65 : priority === "Medium" ? 45 : 20;
  return Math.min(99, base + Math.floor(daysOverdue / 15));
}

function makeMockParties(ownerIdx: number, count: number): PartySeed[] {
  return Array.from({ length: count }).map((_, i) => {
    const base = mockPartyPool[(ownerIdx * 3 + i) % mockPartyPool.length];
    const area = ["Wakad", "Kharadi", "Hadapsar", "Baner", "Nigdi", "Aundh", "Pimpri", "Kondhwa", "Chinchwad"][i % 9];
    const outstanding = 5000 + ((ownerIdx + 7) * (i + 11) * 4379) % 395000;
    const daysOverdue = ((ownerIdx + 1) * (i + 9) * 17) % 240;
    return {
      name: `${base} ${area} ${ownerIdx + 1}-${i + 1}`,
      outstanding,
      daysOverdue,
      address: `Shop ${10 + i}, ${area} Main Road, Pune`,
    };
  });
}

function randomMethod(i: number): PaymentMethod {
  const methods = [PaymentMethod.Cash, PaymentMethod.Cheque, PaymentMethod.UPI, PaymentMethod.RTGS, PaymentMethod.NEFT];
  return methods[i % methods.length];
}

async function main() {
  await prisma.action.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.recoveryTarget.deleteMany();
  await prisma.party.deleteMany();
  await prisma.salesperson.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      email: "admin@synergyrecovery.in",
      name: "Recovery Admin",
      role: "admin",
    },
  });

  const createdSalespeople = await Promise.all(
    salespeople.map((sp) => prisma.salesperson.create({ data: sp })),
  );

  const salespersonPartyMap = new Map<string, PartySeed[]>();
  salespersonPartyMap.set(createdSalespeople[0].id, omParties);

  for (let i = 1; i < createdSalespeople.length; i += 1) {
    salespersonPartyMap.set(createdSalespeople[i].id, makeMockParties(i, 9));
  }

  let partyCounter = 0;
  for (const sp of createdSalespeople) {
    const parties = salespersonPartyMap.get(sp.id) ?? [];
    for (const party of parties) {
      partyCounter += 1;
      const priority = computePriority(party.outstanding, party.daysOverdue);
      const daysSinceLastPayment = Math.max(0, Math.min(180, party.daysOverdue - 5));
      const now = new Date();
      const recommendationDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const createdParty = await prisma.party.create({
        data: {
          name: party.name,
          salespersonId: sp.id,
          phone: phoneFor(1000 + partyCounter),
          email: slugEmail(party.name),
          address: party.address,
          outstanding: decimal(party.outstanding),
          priority,
          daysSinceLastPayment,
          daysOverdue: party.daysOverdue,
          aiRecommendation:
            priority === "Critical"
              ? "Escalate immediately with legal notice readiness and daily follow-up cadence."
              : priority === "High"
                ? "Schedule field visit this week and secure written commitment with payment schedule."
                : "Continue structured follow-up with WhatsApp reminders and weekly call cadence.",
          aiActions: [
            { type: "Call", owner: sp.name, dueInDays: 1 },
            { type: "Visit", owner: sp.name, dueInDays: priority === "Critical" ? 2 : 5 },
          ],
          riskScore: computeRisk(priority, party.daysOverdue),
          redFlags:
            party.daysOverdue >= 180
              ? ["AgingAbove180", "PaymentDelayPattern"]
              : party.daysOverdue >= 90
                ? ["AgingAbove90"]
                : [],
          recommendationDate,
          lastSyncedAt: now,
        },
      });

      const invoiceCount = 2 + (partyCounter % 4);
      let remainingPending = party.outstanding;
      for (let i = 0; i < invoiceCount; i += 1) {
        const weight = invoiceCount - i;
        const pending = i === invoiceCount - 1 ? remainingPending : Math.max(500, Math.floor((remainingPending * weight) / (weight + 3)));
        remainingPending -= pending;
        const amount = pending + Math.floor((pending * (8 + (i % 10))) / 100);
        const invoiceDate = new Date(Date.now() - (20 + i * 30 + Math.max(0, party.daysOverdue)) * 24 * 60 * 60 * 1000);
        const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const overdueDays = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));

        await prisma.invoice.create({
          data: {
            partyId: createdParty.id,
            invoiceRef: `INV-${new Date().getFullYear()}-${partyCounter.toString().padStart(3, "0")}-${i + 1}`,
            invoiceDate,
            dueDate,
            amount: decimal(amount),
            pendingAmount: decimal(pending),
            overdueDays,
          },
        });
      }

      const paymentCount = partyCounter % 4;
      for (let i = 0; i < paymentCount; i += 1) {
        const amount = Math.max(1500, Math.floor(party.outstanding * (0.04 + i * 0.03)));
        const paymentDate = new Date(Date.now() - (15 + i * 40 + (partyCounter % 20)) * 24 * 60 * 60 * 1000);
        await prisma.payment.create({
          data: {
            partyId: createdParty.id,
            paymentDate,
            amount: decimal(amount),
            method: randomMethod(i + partyCounter),
            reference: `PAY-${partyCounter.toString().padStart(4, "0")}-${i + 1}`,
            notes: i % 2 === 0 ? "Part payment received against running invoices." : "Payment acknowledged and adjusted in ledger.",
          },
        });
      }

      const actionCount = partyCounter % 3;
      for (let i = 0; i < actionCount; i += 1) {
        const actionType = [ActionType.Call, ActionType.Visit, ActionType.WhatsApp, ActionType.Email][(partyCounter + i) % 4];
        const outcome = [ActionOutcome.PromiseToPay, ActionOutcome.NoResponse, ActionOutcome.PartialPayment, ActionOutcome.Disputed][(partyCounter + i) % 4];
        const completedAt = new Date(Date.now() - (i * 12 + 2) * 24 * 60 * 60 * 1000);
        await prisma.action.create({
          data: {
            partyId: createdParty.id,
            actionType,
            outcome,
            notes:
              outcome === ActionOutcome.PromiseToPay
                ? "Client committed release in next cycle; reminder scheduled."
                : outcome === ActionOutcome.PartialPayment
                  ? "Recovered partial amount and requested follow-up before due date."
                  : "Follow-up done; no firm payment timeline shared.",
            amountCommitted: outcome === ActionOutcome.PromiseToPay ? decimal(Math.floor(party.outstanding * 0.35)) : null,
            amountRecovered: outcome === ActionOutcome.PartialPayment ? decimal(Math.floor(party.outstanding * 0.12)) : null,
            commitmentDate:
              outcome === ActionOutcome.PromiseToPay
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                : null,
            completedAt,
            createdBy: sp.name,
          },
        });
      }
    }
  }

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  for (let i = 0; i < createdSalespeople.length; i += 1) {
    await prisma.recoveryTarget.create({
      data: {
        salespersonId: createdSalespeople[i].id,
        weekStart,
        weekEnd,
        targetAmount: decimal(600000 + i * 85000),
        actualAmount: decimal(180000 + i * 52000),
      },
    });
  }

  await prisma.syncLog.createMany({
    data: [
      { syncType: SyncType.auto, status: SyncStatus.success, partiesUpdated: partyCounter, durationMs: 14820 },
      { syncType: SyncType.manual, status: SyncStatus.partial, partiesUpdated: 34, durationMs: 23210, errorMessage: "2 parties skipped due to invalid GST mapping from source system." },
      { syncType: SyncType.cron, status: SyncStatus.failed, partiesUpdated: 0, durationMs: 3175, errorMessage: "Tally connector timeout after 3 retries." },
    ],
  });

  console.log(`Seed complete. Salespeople: ${createdSalespeople.length}, parties: ${partyCounter}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
