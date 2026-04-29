import type { Decimal } from "@prisma/client/runtime/library";

type NumberLike = number | Decimal;

function toNumber(value: NumberLike): number {
  return typeof value === "number" ? value : value.toNumber();
}

export function formatINR(amount: NumberLike): string {
  const numericValue = toNumber(amount);

  if (!Number.isFinite(numericValue)) {
    return "₹0";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export function formatCompactINR(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "₹0";
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absAmount >= 10_000_000) {
    return `${sign}₹${(absAmount / 10_000_000).toFixed(2)} Cr`;
  }

  if (absAmount >= 100_000) {
    const lakhs = absAmount / 100_000;
    return `${sign}₹${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(2)} L`;
  }

  if (absAmount >= 1_000) {
    const thousands = absAmount / 1_000;
    return `${sign}₹${Number.isInteger(thousands) ? thousands : thousands.toFixed(2)} K`;
  }

  return `${sign}₹${absAmount.toFixed(0)}`;
}

function parseDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

export function formatDate(date: Date | string): string {
  const parsedDate = parseDate(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

export function formatDateTime(date: Date | string): string {
  const parsedDate = parseDate(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  const formattedDate = formatDate(parsedDate);
  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parsedDate);

  return `${formattedDate}, ${formattedTime}`;
}

export function getDaysAgo(date: Date | string): number {
  const parsedDate = parseDate(date);
  if (Number.isNaN(parsedDate.getTime())) return 0;

  const now = new Date();
  const diffMs = now.getTime() - parsedDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatRelativeTime(date: Date | string): string {
  const parsedDate = parseDate(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  const diffMs = Date.now() - parsedDate.getTime();
  const isFuture = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);
  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (!isFuture && days === 1) return "yesterday";
  if (days >= 1) return isFuture ? `in ${days} days` : `${days} days ago`;
  if (hours >= 1) return isFuture ? `in ${hours} hours` : `${hours} hours ago`;
  if (minutes >= 1) return isFuture ? `in ${minutes} minutes` : `${minutes} minutes ago`;
  return isFuture ? `in ${seconds} seconds` : `${seconds} seconds ago`;
}

export function getAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 30) return "0-30 days";
  if (daysOverdue <= 60) return "31-60 days";
  if (daysOverdue <= 90) return "61-90 days";
  if (daysOverdue <= 180) return "91-180 days";
  return "180+ days";
}
