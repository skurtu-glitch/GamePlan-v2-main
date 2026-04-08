"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, MessageCircle, CreditCard, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/teams", label: "My Teams", icon: Users },
  { href: "/assistant", label: "Assistant", icon: MessageCircle },
  { href: "/plans", label: "Plans", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("size-5", isActive && "text-accent")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
      {/* Safe area for mobile devices */}
      <div className="h-safe-area-inset-bottom bg-card" />
    </nav>
  )
}
