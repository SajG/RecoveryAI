export type PartyDetailResponse = {
  party: {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    outstanding: number;
    priority: string;
    daysSinceLastPayment: number;
    daysOverdue: number;
    salesperson: {
      id: string;
      name: string;
      email: string;
      phone: string;
    };
  };
  invoices: Array<{
    id: string;
    invoiceRef: string;
    invoiceDate: string | Date;
    dueDate: string | Date;
    amount: number;
    pendingAmount: number;
    overdueDays: number;
  }>;
  payments: Array<{
    id: string;
    paymentDate: string | Date;
    amount: number;
    method: string;
    reference: string;
    notes: string | null;
  }>;
  actions: Array<{
    id: string;
    actionType: string;
    outcome: string;
    notes: string;
    amountCommitted: number | null;
    amountRecovered: number | null;
    commitmentDate: string | Date | null;
    completedAt: string | Date | null;
    createdBy: string;
  }>;
  aging: {
    current: number;
    "0-30": number;
    "31-60": number;
    "61-90": number;
    "91-180": number;
    "180+": number;
  };
  paymentTrend: Array<{
    month: string;
    amount: number;
  }>;
  metrics: {
    dso: number;
    paymentBehaviorScore: number;
    avgPaymentDelay: number;
  };
};
