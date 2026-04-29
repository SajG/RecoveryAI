export type SalespersonOutstanding = {
  name: string;
  outstanding: number;
  partyCount: number;
  criticalCount: number;
};

export type AgingBucket = {
  bucket: "0-30 days" | "31-60 days" | "61-90 days" | "91-180 days" | "180+ days";
  count: number;
  amount: number;
};

export type RecentAction = {
  id: string;
  partyId: string;
  partyName: string;
  salespersonName: string;
  actionType: string;
  notes: string;
  completedAt: string | Date | null;
};

export type CriticalParty = {
  id: string;
  name: string;
  salespersonName: string;
  outstanding: number;
  daysOverdue: number;
};

export type DashboardResponse = {
  totalOutstanding: number;
  recoveredThisMonth: number;
  monthlyTarget: number;
  overdue90Plus: number;
  overdue90PlusCount: number;
  cashFlowHealthScore: number;
  salespersonOutstanding: SalespersonOutstanding[];
  agingBuckets: AgingBucket[];
  recentActions: RecentAction[];
  lastSyncedAt: string | Date | null;
  topCriticalParties: CriticalParty[];
};
