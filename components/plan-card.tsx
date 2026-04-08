"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X, ExternalLink } from "lucide-react"
import type { StreamingPlan } from "@/lib/types"

interface PlanCardProps {
  plan: StreamingPlan
  recommended?: boolean
}

export function PlanCard({ plan, recommended = false }: PlanCardProps) {
  return (
    <Card
      className={`overflow-hidden border-border bg-card p-0 ${
        recommended ? "ring-2 ring-accent" : ""
      }`}
    >
      {recommended && (
        <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">
          Best for Your Teams
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {plan.sports.map((sport) => (
                <span
                  key={sport}
                  className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {sport}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${plan.price.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">/{plan.priceUnit}</p>
          </div>
        </div>

        {/* Channels */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Channels
          </p>
          <p className="text-sm text-foreground">{plan.channels.join(", ")}</p>
        </div>

        {/* Pros & Cons */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pros
            </p>
            <ul className="flex flex-col gap-1.5">
              {plan.pros.map((pro, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-status-available" />
                  <span className="text-foreground">{pro}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cons
            </p>
            <ul className="flex flex-col gap-1.5">
              {plan.cons.map((con, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <X className="mt-0.5 size-3.5 shrink-0 text-status-unavailable" />
                  <span className="text-foreground">{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <Button className="w-full gap-2" variant={recommended ? "default" : "secondary"}>
          Learn More
          <ExternalLink className="size-4" />
        </Button>
      </div>
    </Card>
  )
}
