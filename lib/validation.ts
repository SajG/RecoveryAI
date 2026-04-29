import { z } from "zod";

function sanitizeText(value: string): string {
  return value.replace(/[<>]/g, "").trim();
}

const isoDateTimeSchema = z.string().datetime({ offset: true });
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format");

export const BridgeInvoiceSchema = z.object({
  ref: z.string().min(1).max(200).transform(sanitizeText),
  date: dateOnlySchema,
  dueDate: dateOnlySchema,
  amount: z.number().finite().nonnegative(),
  pending: z.number().finite().nonnegative(),
  overdueDays: z.number().int().nonnegative(),
});

export const BridgePaymentSchema = z.object({
  date: dateOnlySchema,
  amount: z.number().finite().nonnegative(),
  method: z.string().min(1).max(100).transform(sanitizeText),
  reference: z.string().min(1).max(200).transform(sanitizeText),
});

export const BridgePartySchema = z.object({
  name: z.string().min(1).max(200).transform(sanitizeText),
  outstanding: z.number().finite().nonnegative(),
  phone: z.string().max(50).optional().default("").transform(sanitizeText),
  email: z.string().max(255).optional().default("").transform(sanitizeText),
  address: z.string().max(500).optional().default("").transform(sanitizeText),
  invoices: z.array(BridgeInvoiceSchema),
  payments: z.array(BridgePaymentSchema),
});

export const BridgeSalespersonSchema = z.object({
  name: z.string().min(1).max(120).transform(sanitizeText),
  tallyGroup: z.string().min(1).max(200).transform(sanitizeText),
  parties: z.array(BridgePartySchema),
});

export const BridgePayloadSchema = z.object({
  timestamp: isoDateTimeSchema,
  fromDate: dateOnlySchema,
  toDate: dateOnlySchema,
  company: z.string().min(1).max(255).transform(sanitizeText),
  salespeople: z.array(BridgeSalespersonSchema),
});

export type BridgePayload = z.infer<typeof BridgePayloadSchema>;
