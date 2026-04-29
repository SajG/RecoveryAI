import { getPriorityColor, type Priority } from "@/lib/rules";
import { cn } from "@/lib/utils";

type PriorityBadgeProps = {
  priority: Priority;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const colors = getPriorityColor(priority);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
      {priority}
    </span>
  );
}
