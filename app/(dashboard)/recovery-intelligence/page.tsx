import { prisma } from "@/lib/prisma";
import { RecoveryIntelligenceView } from "@/components/recovery-intelligence/RecoveryIntelligenceView";

type FunnelStage = {
  stage: string;
  count: number;
  amount: number;
};

type PromiseReliabilityRow = {
  key: string;
  label: string;
  committed: number;
  recovered: number;
  realizationPct: number;
  onTimePct: number;
  promiseCount: number;
};

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

async function getRecoveryIntelligenceData() {
  const now = new Date();
  const start90Days = new Date(now);
  start90Days.setDate(now.getDate() - 90);

  const [parties, payments90, actions, paymentsByParty] = await Promise.all([
    prisma.party.findMany({
      select: {
        id: true,
        name: true,
        outstanding: true,
        daysOverdue: true,
        salesperson: { select: { name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: start90Days } },
      select: {
        amount: true,
      },
    }),
    prisma.action.findMany({
      where: { outcome: "PromiseToPay" },
      select: {
        partyId: true,
        amountCommitted: true,
        amountRecovered: true,
        commitmentDate: true,
        completedAt: true,
        party: {
          select: {
            name: true,
            salesperson: { select: { name: true } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      select: { partyId: true, amount: true },
    }),
  ]);

  const totalOutstanding = parties.reduce((sum, party) => sum + party.outstanding.toNumber(), 0);
  const collected90 = payments90.reduce((sum, payment) => sum + payment.amount.toNumber(), 0);
  const baseRealizationRate = totalOutstanding > 0 ? Math.min(collected90 / totalOutstanding, 1) : 0;

  const weightedExposure = parties.reduce((sum, party) => {
    const amount = party.outstanding.toNumber();
    let weight = 0.8;
    if (party.daysOverdue > 30) weight = 0.65;
    if (party.daysOverdue > 60) weight = 0.5;
    if (party.daysOverdue > 90) weight = 0.35;
    if (party.daysOverdue > 180) weight = 0.2;
    return sum + amount * weight;
  }, 0);

  const forecast30 = Number((weightedExposure * baseRealizationRate * 0.7).toFixed(0));
  const forecast60 = Number((weightedExposure * baseRealizationRate * 1.15).toFixed(0));
  const forecast90 = Number((weightedExposure * baseRealizationRate * 1.45).toFixed(0));

  const promiseByParty = new Map<string, PromiseReliabilityRow & { onTimeCount: number }>();
  const promiseBySalesperson = new Map<string, PromiseReliabilityRow & { onTimeCount: number }>();
  for (const action of actions) {
    const committed = action.amountCommitted?.toNumber() ?? 0;
    const recovered = action.amountRecovered?.toNumber() ?? 0;
    const onTime =
      action.commitmentDate && action.completedAt ? action.completedAt.getTime() <= action.commitmentDate.getTime() : false;

    const partyKey = action.partyId;
    const partyLabel = action.party.name;
    const spKey = action.party.salesperson.name;
    const spLabel = action.party.salesperson.name;

    const partyAgg = promiseByParty.get(partyKey) ?? {
      key: partyKey,
      label: partyLabel,
      committed: 0,
      recovered: 0,
      realizationPct: 0,
      onTimePct: 0,
      promiseCount: 0,
      onTimeCount: 0,
    };
    partyAgg.committed += committed;
    partyAgg.recovered += recovered;
    partyAgg.promiseCount += 1;
    if (onTime) partyAgg.onTimeCount += 1;
    promiseByParty.set(partyKey, partyAgg);

    const spAgg = promiseBySalesperson.get(spKey) ?? {
      key: spKey,
      label: spLabel,
      committed: 0,
      recovered: 0,
      realizationPct: 0,
      onTimePct: 0,
      promiseCount: 0,
      onTimeCount: 0,
    };
    spAgg.committed += committed;
    spAgg.recovered += recovered;
    spAgg.promiseCount += 1;
    if (onTime) spAgg.onTimeCount += 1;
    promiseBySalesperson.set(spKey, spAgg);
  }

  const partyReliability = [...promiseByParty.values()]
    .map((row) => ({
      key: row.key,
      label: row.label,
      committed: row.committed,
      recovered: row.recovered,
      promiseCount: row.promiseCount,
      realizationPct: pct(row.recovered, row.committed),
      onTimePct: pct(row.onTimeCount, row.promiseCount),
    }))
    .sort((a, b) => b.committed - a.committed)
    .slice(0, 12);

  const salespersonReliability = [...promiseBySalesperson.values()]
    .map((row) => ({
      key: row.key,
      label: row.label,
      committed: row.committed,
      recovered: row.recovered,
      promiseCount: row.promiseCount,
      realizationPct: pct(row.recovered, row.committed),
      onTimePct: pct(row.onTimeCount, row.promiseCount),
    }))
    .sort((a, b) => b.committed - a.committed);

  const contactedPartyIds = new Set(actions.map((a) => a.partyId));
  const promisedPartyIds = new Set(actions.map((a) => a.partyId));
  const paymentsByPartyMap = new Map<string, number>();
  for (const payment of paymentsByParty) {
    paymentsByPartyMap.set(payment.partyId, (paymentsByPartyMap.get(payment.partyId) ?? 0) + payment.amount.toNumber());
  }

  const stages = {
    notContacted: { count: 0, amount: 0 },
    contacted: { count: 0, amount: 0 },
    promiseMade: { count: 0, amount: 0 },
    partialPaid: { count: 0, amount: 0 },
    fullyRecovered: { count: 0, amount: 0 },
  };

  for (const party of parties) {
    const amount = party.outstanding.toNumber();
    const recovered = paymentsByPartyMap.get(party.id) ?? 0;
    const hasContact = contactedPartyIds.has(party.id);
    const hasPromise = promisedPartyIds.has(party.id);
    const isFullyRecovered = amount <= 0 && recovered > 0;
    const isPartialPaid = recovered > 0 && amount > 0;

    if (!hasContact) {
      stages.notContacted.count += 1;
      stages.notContacted.amount += amount;
    }
    if (hasContact) {
      stages.contacted.count += 1;
      stages.contacted.amount += amount;
    }
    if (hasPromise) {
      stages.promiseMade.count += 1;
      stages.promiseMade.amount += amount;
    }
    if (isPartialPaid) {
      stages.partialPaid.count += 1;
      stages.partialPaid.amount += amount;
    }
    if (isFullyRecovered) {
      stages.fullyRecovered.count += 1;
      stages.fullyRecovered.amount += recovered;
    }
  }

  const dunningFunnel: FunnelStage[] = [
    { stage: "Not contacted", ...stages.notContacted },
    { stage: "Contacted", ...stages.contacted },
    { stage: "Promise made", ...stages.promiseMade },
    { stage: "Partial paid", ...stages.partialPaid },
    { stage: "Fully recovered", ...stages.fullyRecovered },
  ];

  return {
    forecast: {
      baseRealizationRatePct: Number((baseRealizationRate * 100).toFixed(1)),
      forecast30,
      forecast60,
      forecast90,
      totalOutstanding,
    },
    partyReliability,
    salespersonReliability,
    dunningFunnel,
  };
}

export default async function RecoveryIntelligencePage() {
  const data = await getRecoveryIntelligenceData();
  return <RecoveryIntelligenceView data={data} />;
}
