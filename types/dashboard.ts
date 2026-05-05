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
  collectionEfficiencyTrend: CollectionEfficiencyPoint[];
  paymentBehaviorByCustomer: CustomerPaymentBehavior[];
  agingMovement: AgingMovement;
  salespersonCollectionQuality: SalespersonCollectionQuality[];
};

export type CollectionEfficiencyPoint = {
  monthKey: string;
  label: string;
  dues: number;
  payments: number;
  efficiencyPct: number;
};

export type CustomerPaymentBehavior = {
  partyId: string;
  partyName: string;
  salespersonName: string;
  paymentCount: number;
  totalPaid: number;
  avgPaymentAmount: number;
  avgGapDays: number | null;
  lastPaymentDate: string | Date | null;
  methodSplit: {
    cash: number;
    cheque: number;
    upi: number;
    rtgs: number;
    neft: number;
  };
};

export type AgingBucketMovement = {
  fromBucket: AgingBucket["bucket"];
  toBucket: AgingBucket["bucket"];
  invoiceCount: number;
  amount: number;
};

export type SlippingInvoice = {
  invoiceId: string;
  invoiceRef: string;
  partyId: string;
  partyName: string;
  salespersonName: string;
  pendingAmount: number;
  currentBucket: AgingBucket["bucket"];
  nextBucket: AgingBucket["bucket"] | null;
  overdueDays: number;
  daysToSlip: number | null;
};

export type AgingMovement = {
  slippingSoonCount: number;
  slippedRecentlyCount: number;
  slippingSoonAmount: number;
  slippedRecentlyAmount: number;
  topSlippingInvoices: SlippingInvoice[];
  bucketTransitions: AgingBucketMovement[];
};

export type SalespersonCollectionQuality = {
  salespersonName: string;
  partyCount: number;
  totalOutstanding: number;
  recoveredThisMonth: number;
  collectionVsExposurePct: number;
  avgOverdueDays: number;
  payingPartiesThisMonth: number;
  overdue90PlusCount: number;
};
