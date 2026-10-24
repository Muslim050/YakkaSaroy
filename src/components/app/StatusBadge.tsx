import { cn } from "@/lib/utils";
import { STATUS, type BookingStatus } from "@/lib/bookings";

export function StatusBadge({ status, short, className }: { status: BookingStatus; short?: boolean; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", s.className, className)}>
      {short ? s.short : s.label}
    </span>
  );
}
