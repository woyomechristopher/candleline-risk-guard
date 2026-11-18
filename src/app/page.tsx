import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, ShieldCheck, Wallet } from "lucide-react";

import BotControls from "@/components/trading/BotControls";
import AppShell from "@/components/trading/AppShell";
import MarketChart from "@/components/trading/MarketChart";
import TradeHistory from "@/components/trading/TradeHistory";
import { Button } from "@/components/ui/button";
import { getUser, googleSignInEnabled } from "@/lib/auth";
import { isBotOwner, loadDashboardData } from "@/lib/bot-service";

export const metadata: Metadata = {
  title: "Overview",
};

function quoteAsset(symbol: string): string {
  if (symbol.endsWith("USDT")) return "USDT";
  if (symbol.endsWith("USD")) return "USD";
  return "quote";
}

function formatAmount(value: string | number, asset: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ${asset}`;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

export default async function Home() {
  const user = await getUser();
  if (!user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 py-12">
        <section className="w-full max-w-lg rounded-xl border border-border bg-card p-7 shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck aria-hidden="true" size={22} />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Candleline · Binance.US</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Owner sign-in required</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This trading workspace is limited to its designated owner. Sign in to review your strategy and trading activity.
          </p>
          {googleSignInEnabled ? (
            <Button className="mt-5" nativeButton={false} render={<Link href="/auth/start" />}>
              Continue with Google
            </Button>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Owner sign-in isn’t available right now.</p>
          )}
        </section>
      </main>
    );
  }

  if (!process.env.BINANCE_BOT_OWNER_EMAIL || !isBotOwner(user.email)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 py-12">
        <section className="w-full max-w-lg rounded-xl border border-border bg-card p-7 shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck aria-hidden="true" size={22} />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Candleline · Binance.US</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Owner access is not ready</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This trading workspace is limited to its designated owner. Trading stays off until the owner account is connected.
          </p>
        </section>
      </main>
    );
  }

  const data = await loadDashboardData(user.id);
  const quote = quoteAsset(data.bot.symbol);
  const latestPrice = data.candles.at(-1)?.close ?? null;
  const positionQty = Number(data.bot.currentPositionQty);
  const positionValue = latestPrice !== null ? positionQty * latestPrice : null;
  const entryPrice = positionQty > 0 ? Number(data.bot.currentPositionCost) / positionQty : null;
  const connectionMessage = data.exchange.accountReady
    ? !data.exchange.canTrade
      ? "Spot permission needed"
      : "Account connected"
    : data.exchange.credentialsReady ? "Account check needed" : "Secure setup pending";
  const tradingReady = data.exchange.credentialsReady && data.exchange.accountReady && data.exchange.canTrade;

  return (
    <AppShell
      active="overview"
      botEnabled={data.bot.enabled}
      exchangeMessage={connectionMessage}
      exchangeReady={tradingReady}
      userEmail={user.email}
      userName={user.name}
    >
      <div className="space-y-5 px-4 py-5 md:px-7 md:py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Candleline · Binance.US</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Trading overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">One spot market, explicit risk limits, and a full record of bot orders.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/strategy" />} variant="outline">
            Review strategy <ArrowRight aria-hidden="true" size={16} />
          </Button>
        </div>

        {!data.exchange.credentialsReady ? (
          <section className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={18} />
              <div>
                <h2 className="text-sm font-semibold">Secure exchange access is not connected</h2>
                <p className="mt-1 text-sm text-muted-foreground">The bot will stay paused until owner-only Binance.US access is ready.</p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-primary">No credentials are entered on this screen</span>
          </section>
        ) : null}

        {data.exchange.credentialsReady && (!data.exchange.accountReady || !data.exchange.canTrade) ? (
          <section className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-4">
            <h2 className="text-sm font-semibold">Check your Binance.US connection</h2>
            <p className="mt-1 text-sm text-muted-foreground">{data.exchange.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">Use a system-generated key for spot trading only, with withdrawals turned off.</p>
          </section>
        ) : null}

        <section aria-label="Trading summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Latest price</p>
              <CircleDollarSign aria-hidden="true" className="text-muted-foreground" size={17} />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold tabular-nums">
              {latestPrice === null ? "—" : `${formatPrice(latestPrice)} ${quote}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{data.bot.symbol || "Choose a market"}</p>
          </article>
          <article className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Open position</p>
              <Wallet aria-hidden="true" className="text-muted-foreground" size={17} />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold tabular-nums">
              {positionQty > 0 ? formatAmount(positionQty, data.bot.symbol.replace(/(USDT|USD)$/, "")) : "None"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {positionValue !== null && positionQty > 0 ? `Approx. ${formatAmount(positionValue, quote)} at latest close` : "This bot tracks one position at a time"}
            </p>
          </article>
          <article className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Today’s gross realized P&amp;L</p>
            <p className={`mt-3 font-mono text-xl font-semibold tabular-nums ${Number(data.bot.dailyRealizedPnl) >= 0 ? "text-[var(--market-up)]" : "text-[var(--market-down)]"}`}>
              {formatAmount(data.bot.dailyRealizedPnl, quote)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Before exchange fees · resets at 00:00 UTC</p>
          </article>
          <article className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Daily loss stop</p>
            <p className="mt-3 font-mono text-xl font-semibold tabular-nums">
              {Number(data.bot.maxDailyLoss) > 0 ? formatAmount(data.bot.maxDailyLoss, quote) : "Not set"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Required before live trading starts</p>
          </article>
        </section>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.85fr)]">
          <section className="min-w-0 rounded-lg border border-border bg-card p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <h2 className="font-semibold tracking-tight">Market movement</h2>
                <p className="mt-1 text-xs text-muted-foreground">Completed candles · updated {new Date(data.updatedAt).toISOString().slice(11, 19)} UTC</p>
              </div>
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                {data.bot.symbol || "No market selected"} · {data.bot.interval}
              </span>
            </div>
            <MarketChart candles={data.candles} interval={data.bot.interval} symbol={data.bot.symbol} />
          </section>

          <div className="min-w-0 space-y-5">
            <BotControls bot={data.bot} connected={tradingReady} pendingOrder={data.pendingOrder} />
            <section className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Exchange account</p>
                  <h2 className="mt-1 font-semibold tracking-tight">Available assets</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${data.exchange.accountReady ? "bg-[var(--market-up)]/10 text-[var(--market-up)]" : "bg-muted text-muted-foreground"}`}>
                  {data.exchange.accountReady && data.exchange.canTrade ? "Connected" : "Needs setup"}
                </span>
              </div>
              {data.exchange.balances.length ? (
                <ul className="mt-4 divide-y divide-border">
                  {data.exchange.balances.slice(0, 4).map((balance) => (
                    <li className="flex items-center justify-between gap-3 py-2.5 text-sm" key={balance.asset}>
                      <span className="font-medium">{balance.asset}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">{formatAmount(balance.free, balance.asset)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-5 text-muted-foreground">{data.exchange.message}</p>
              )}
              {entryPrice !== null ? <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Tracked average entry: {formatPrice(entryPrice)} {quote}</p> : null}
            </section>
          </div>
        </div>

        <section className="min-w-0 rounded-lg border border-border bg-card p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Recent bot orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">Fills, signals, and orders needing review.</p>
            </div>
            <Button nativeButton={false} render={<Link href="/orders" />} variant="ghost">
              Order history <ArrowRight aria-hidden="true" size={15} />
            </Button>
          </div>
          <TradeHistory compact events={data.recentTrades} />
        </section>
      </div>
    </AppShell>
  );
}
