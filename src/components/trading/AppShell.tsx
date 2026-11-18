import Link from "next/link";
import { Activity, ArrowLeftRight, ChartNoAxesCombined, Settings2 } from "lucide-react";

import SignOutButton from "@/components/trading/SignOutButton";

interface AppShellProps {
  active: "overview" | "strategy" | "orders";
  botEnabled: boolean;
  children: React.ReactNode;
  exchangeReady: boolean;
  userEmail: string;
  userName: string;
  exchangeMessage: string;
}

const navigation = [
  { href: "/", label: "Overview", key: "overview", icon: ChartNoAxesCombined },
  { href: "/strategy", label: "Strategy", key: "strategy", icon: Settings2 },
  { href: "/orders", label: "Orders", key: "orders", icon: ArrowLeftRight },
] as const;

export default function AppShell({ active, botEnabled, children, exchangeReady, userEmail, userName, exchangeMessage }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[228px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:min-h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Activity aria-hidden="true" size={19} strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight">Candleline</span>
            <span className="block text-xs text-sidebar-foreground/60">Spot automation</span>
          </span>
        </div>

        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {navigation.map(({ href, label, key, icon: Icon }) => {
            const isActive = active === key;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                }`}
                href={href}
                key={key}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden border-t border-sidebar-border p-3 lg:block">
          <div className="mb-3 min-w-0 px-2">
            <p className="truncate text-sm font-medium">{userName || "Account owner"}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{userEmail}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-7">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className={`size-2 shrink-0 rounded-full ${exchangeReady ? "bg-[var(--market-up)]" : "bg-muted-foreground"}`} />
            <span className="truncate font-medium">Binance.US</span>
            <span className="hidden truncate text-muted-foreground sm:inline">{exchangeMessage}</span>
          </div>
          {botEnabled ? <p className="hidden text-xs text-muted-foreground md:block">Keep Overview open for market checks</p> : null}
          <div className="flex items-center gap-2 lg:hidden">
            <span className="max-w-36 truncate text-xs text-muted-foreground">{userEmail}</span>
            <SignOutButton />
          </div>
        </header>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
