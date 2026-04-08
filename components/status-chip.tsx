"use client"

import { cn } from "@/lib/utils"
import type { AvailabilityStatus } from "@/lib/types"

interface StatusChipProps {
  status: AvailabilityStatus
  label?: string
  size?: "sm" | "md"
}

export function StatusChip({ status, label, size = "md" }: StatusChipProps) {
  const statusConfig = {
    available: {
      bg: "bg-status-available/15",
      text: "text-status-available",
      dot: "bg-status-available",
      defaultLabel: "Available",
    },
    unavailable: {
      bg: "bg-status-unavailable/15",
      text: "text-status-unavailable",
      dot: "bg-status-unavailable",
      defaultLabel: "Not available with your plan",
    },
    partial: {
      bg: "bg-status-partial/15",
      text: "text-status-partial",
      dot: "bg-status-partial",
      defaultLabel: "Partial",
    },
  }

  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.bg,
        config.text,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {label || config.defaultLabel}
    </span>
  )
}
