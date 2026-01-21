/**
 * Statistics Card Component
 *
 * Displays a single statistic with label, value, and optional change indicator.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
        {Icon && (
          <div className="rounded-md bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      {(description || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "font-medium",
                trend.isPositive !== false ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}
            </span>
          )}
          {(description || trend?.label) && (
            <span className="text-muted-foreground">
              {description || trend?.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
