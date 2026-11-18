import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import AppShell from "@/components/trading/AppShell";
import StrategyForm from "@/components/trading/StrategyForm";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { isBotOwner, loadDashboardData } from "@/lib/bot-service";

export const metadata: Metadata = {
  title: "Strategy",
};

export default async function StrategyPage() {
  const user = await getUser();
  if (!user) redirect("/auth/start");
  if (!process.env.BINANCE_BOT_OWNER_EMAIL || !isBotOwner(user.email)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 py-12">
        <section className="w-full max-w-lg rounded-xl border border-border bg-card p-7 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Owner access is not ready</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Strategy controls are limited to the designated bot owner.</p>
        </section>
      </main>
    );
  }

  const data = await loadDashboardData(user.id);
  return (
    <AppShell
      active="strategy"
      botEnabled={data.bot.enabled}
      exchangeMessage={data.exchange.credentialsReady ? data.exchange.message : "Secure setup pending"}
      exchangeReady={data.exchange.accountReady && data.exchange.canTrade}
      userEmail={user.email}
      userName={user.name}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 md:px-7 md:py-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Rules and risk</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Strategy setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure one Binance.US spot market and the limits the bot must respect.</p>
        </div>

        {data.bot.enabled ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-4">
            <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" size={18} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Pause trading before changing rules</p>
              <p className="mt-1 text-sm text-muted-foreground">The Overview must stay open for market checks while the bot is active.</p>
              <Button className="mt-3" nativeButton={false} render={<Link href="/" />} variant="outline">
                Go to Overview
              </Button>
            </div>
          </div>
        ) : null}

        {!data.exchange.credentialsReady ? (
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Trading remains off until owner-only Binance.US access is connected. No credentials are entered in the app.
          </div>
        ) : null}

        <StrategyForm bot={data.bot} hasOpenPosition={Number(data.bot.currentPositionQty) > 0} />
      </div>
    </AppShell>
  );
}
