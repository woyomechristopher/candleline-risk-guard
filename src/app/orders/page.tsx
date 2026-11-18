import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowDownToLine, Clock3 } from "lucide-react";

import AppShell from "@/components/trading/AppShell";
import TradeHistory from "@/components/trading/TradeHistory";
import { getUser } from "@/lib/auth";
import { isBotOwner, listTradeEvents, loadDashboardData } from "@/lib/bot-service";

export const metadata: Metadata = {
  title: "Order history",
};

export default async function OrdersPage() {
  const user = await getUser();
  if (!user) redirect("/auth/start");
  if (!process.env.BINANCE_BOT_OWNER_EMAIL || !isBotOwner(user.email)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 py-12">
        <section className="w-full max-w-lg rounded-xl border border-border bg-card p-7 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Owner access is not ready</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Order history is limited to the designated bot owner.</p>
        </section>
      </main>
    );
  }

  const [data, events] = await Promise.all([
    loadDashboardData(user.id),
    listTradeEvents(user.id),
  ]);
  const filledCount = events.filter((event) => event.status === "FILLED").length;
  const pendingCount = events.filter((event) => event.status === "PENDING" || event.status === "PARTIALLY_FILLED").length;

  return (
    <AppShell
      active="orders"
      botEnabled={data.bot.enabled}
      exchangeMessage={data.exchange.credentialsReady ? data.exchange.message : "Secure setup pending"}
      exchangeReady={data.exchange.accountReady && data.exchange.canTrade}
      userEmail={user.email}
      userName={user.name}
    >
      <div className="space-y-6 px-4 py-5 md:px-7 md:py-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Execution record</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Order history</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every order this bot has attempted, including orders that need review.</p>
        </div>

        <section aria-label="Order summary" className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Recorded orders</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{events.length}</p>
          </article>
          <article className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ArrowDownToLine aria-hidden="true" size={15} /> Filled
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{filledCount}</p>
          </article>
          <article className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock3 aria-hidden="true" size={15} /> Needs review
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{pendingCount}</p>
          </article>
        </section>

        <section className="min-w-0 rounded-lg border border-border bg-card p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="font-semibold tracking-tight">All bot orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">Up to 100 most recent records · shown in UTC</p>
            </div>
            <p className="text-xs text-muted-foreground">Gross realized P&amp;L excludes exchange fees.</p>
          </div>
          <TradeHistory events={events} />
        </section>
      </div>
    </AppShell>
  );
}
