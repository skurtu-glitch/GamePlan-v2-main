"use client"

import { cn } from "@/lib/utils"

interface CoverageMeterProps {
  watchable: number
  listenOnly: number
  unavailable: number
  total: number
  showLabels?: boolean
  size?: "sm" | "md" | "lg"
}

export function CoverageMeter({ 
  watchable, 
  listenOnly, 
  unavailable, 
  total,
  showLabels = true,
  size = "md"
}: CoverageMeterProps) {
  const watchPercent = total > 0 ? (watchable / total) * 100 : 0
  const listenPercent = total > 0 ? (listenOnly / total) * 100 : 0
  const unavailablePercent = total > 0 ? (unavailable / total) * 100 : 0

  const barHeight = size === "sm" ? "h-2" : size === "lg" ? "h-4" : "h-3"

  return (
    <div className="w-full">
      {/* Segmented Bar */}
      <div className={cn("flex w-full overflow-hidden rounded-full bg-muted/30", barHeight)}>
        {watchPercent > 0 && (
          <div 
            className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${watchPercent}%` }}
          />
        )}
        {listenPercent > 0 && (
          <div 
            className="bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: `${listenPercent}%` }}
          />
        )}
        {unavailablePercent > 0 && (
          <div 
            className="bg-muted-foreground/30 transition-all duration-500"
            style={{ width: `${unavailablePercent}%` }}
          />
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">
              Watchable <span className="font-semibold text-foreground">{watchable}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">
              Listen Only <span className="font-semibold text-foreground">{listenOnly}</span>
            </span>
          </div>
          {unavailable > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">
                Not available with your plan <span className="font-semibold text-foreground">{unavailable}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface CircularCoverageProps {
  percentage: number
  watchable: number
  total: number
  size?: "sm" | "md" | "lg"
}

export function CircularCoverage({ 
  percentage, 
  watchable, 
  total,
  size = "md"
}: CircularCoverageProps) {
  const dimensions = size === "sm" ? 80 : size === "lg" ? 140 : 110
  const strokeWidth = size === "sm" ? 6 : size === "lg" ? 10 : 8
  const radius = (dimensions - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={dimensions}
        height={dimensions}
        className="-rotate-90 transform"
      >
        {/* Background circle */}
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          fill="none"
          stroke="url(#coverageGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="coverageGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          "font-bold text-emerald-400",
          size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl"
        )}>
          {percentage}%
        </span>
        <span className={cn(
          "text-muted-foreground",
          size === "sm" ? "text-[9px]" : size === "lg" ? "text-xs" : "text-[10px]"
        )}>
          Coverage
        </span>
      </div>

      {/* Games count below */}
      <p className={cn(
        "mt-2 text-center text-muted-foreground",
        size === "sm" ? "text-[10px]" : "text-xs"
      )}>
        <span className="font-semibold text-foreground">{watchable}</span> of {total} watchable
      </p>
    </div>
  )
}

interface ComparisonCoverageProps {
  current: {
    label: string
    watchable: number
    total: number
  }
  upgraded: {
    label: string
    watchable: number
    total: number
  }
  gamesUnlocked: number
}

export function ComparisonCoverage({ current, upgraded, gamesUnlocked }: ComparisonCoverageProps) {
  const currentPercent = current.total > 0 ? (current.watchable / current.total) * 100 : 0
  const upgradedPercent = upgraded.total > 0 ? (upgraded.watchable / upgraded.total) * 100 : 0

  return (
    <div className="w-full space-y-4">
      {/* Current Coverage */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{current.label}</span>
          <span className="font-semibold text-foreground">{current.watchable} games ({Math.round(currentPercent)}%)</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
          <div 
            className="h-full bg-muted-foreground/50 transition-all duration-500"
            style={{ width: `${currentPercent}%` }}
          />
        </div>
      </div>

      {/* Upgraded Coverage */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{upgraded.label}</span>
          <span className="font-semibold text-emerald-400">{upgraded.watchable} games ({Math.round(upgradedPercent)}%)</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${upgradedPercent}%` }}
          />
        </div>
      </div>

      {/* Games Unlocked Label */}
      <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
        <span className="text-lg font-bold text-emerald-400">+{gamesUnlocked}</span>
        <span className="text-sm text-muted-foreground">games unlocked</span>
      </div>
    </div>
  )
}
