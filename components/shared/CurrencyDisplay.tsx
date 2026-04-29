import { formatCompactINR, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Decimal } from "@prisma/client/runtime/library";

type CurrencyDisplayProps = {
  amount: number | Decimal;
  compact?: boolean;
  colorizeNegative?: boolean;
  className?: string;
};

export function CurrencyDisplay({
  amount,
  compact = false,
  colorizeNegative = false,
  className,
}: CurrencyDisplayProps) {
  const numericAmount = typeof amount === "number" ? amount : amount.toNumber();
  const formattedValue = compact ? formatCompactINR(numericAmount) : formatINR(amount);

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        colorizeNegative && numericAmount < 0 ? "text-red-600" : "text-inherit",
        className
      )}
    >
      {formattedValue}
    </span>
  );
}
