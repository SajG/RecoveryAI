export type Priority = "Critical" | "High" | "Medium" | "Low";

export function getPriority(outstanding: number, daysOverdue: number): Priority {
  if (outstanding >= 500000 || daysOverdue >= 180) return "Critical";
  if (outstanding >= 200000 || daysOverdue >= 90) return "High";
  if (outstanding >= 50000 || daysOverdue >= 30) return "Medium";
  return "Low";
}

export function getPriorityColor(priority: Priority) {
  return {
    Critical: {
      bg: "bg-red-100",
      text: "text-red-900",
      border: "border-red-300",
      dot: "bg-red-500",
    },
    High: {
      bg: "bg-orange-100",
      text: "text-orange-900",
      border: "border-orange-300",
      dot: "bg-orange-500",
    },
    Medium: {
      bg: "bg-yellow-100",
      text: "text-yellow-900",
      border: "border-yellow-300",
      dot: "bg-yellow-500",
    },
    Low: {
      bg: "bg-green-100",
      text: "text-green-900",
      border: "border-green-300",
      dot: "bg-green-500",
    },
  }[priority];
}

export function getQuickRecommendation(party: {
  outstanding: number;
  daysOverdue: number;
  daysSinceLastPayment: number;
}): string {
  if (party.outstanding > 500000) {
    return "🚨 Director visit + Legal Notice within 7 days";
  }

  if (party.outstanding > 200000 && party.daysOverdue > 90) {
    return "⚠️ Stop supply. Manager visit. Demand PDC immediately.";
  }

  if (party.outstanding > 100000 && party.daysSinceLastPayment > 30) {
    return "📞 Field visit overdue — visit today";
  }

  if (party.outstanding > 50000) {
    return "📞 Daily call until written commitment";
  }

  return "✅ Routine weekly follow-up";
}

export function calculateCashFlowHealthScore(
  totalOutstanding: number,
  overdue90Plus: number,
  recoveredThisMonth: number,
  monthlyTarget: number
): number {
  if (totalOutstanding <= 0 && monthlyTarget <= 0) {
    return 100;
  }

  const safeOutstanding = Math.max(totalOutstanding, 0);
  const safeOverdue = Math.max(overdue90Plus, 0);
  const safeRecovered = Math.max(recoveredThisMonth, 0);
  const safeTarget = Math.max(monthlyTarget, 1);

  const overdueRatio = safeOutstanding === 0 ? 0 : Math.min(safeOverdue / safeOutstanding, 1);
  const recoveryRatio = Math.min(safeRecovered / safeTarget, 1.25);

  const overduePenalty = overdueRatio * 65;
  const recoveryBoost = recoveryRatio * 35;

  const rawScore = 65 - overduePenalty + recoveryBoost;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}
