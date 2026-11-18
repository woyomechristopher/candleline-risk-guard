"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pause, Play, ShieldCheck } from "lucide-react";

import { closePosition, confirmNoPendingOrder, pauseBot, runBotTick, startBot } from "@/app/actions/bot-actions";
import { Button } from "@/components/ui/button";
import type { BotSettings } from "@/types/trading";

interface BotControlsProps {
  bot: BotSettings;
  connected: boolean;
  pendingOrder: boolean;
}

export default function BotControls({ bot, connected, pendingOrder }: BotControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const configured = Boolean(
    bot.symbol &&
    Number(bot.quoteOrderAmount) > 0 &&
    Number(bot.maxDailyLoss) > 0 &&
    Number(bot.stopLossPercent) > 0,
  );

  useEffect(() => {
    if (!bot.enabled && !pendingOrder) return;
    let closed = false;
    let inFlight = false;

    async function checkMarket() {
      if (closed || inFlight) return;
      inFlight = true;
      try {
        const result = await runBotTick();
        if (!closed && (!result.ok || /filled|paused|review/i.test(result.message))) {
          setMessage(result.message);
          if (!pendingOrder || /filled|partial|did not complete/i.test(result.message)) router.refresh();
        }
      } catch {
        if (!closed) setMessage("This market check could not be confirmed. Review Binance.US before restarting the bot.");
      } finally {
        inFlight = false;
      }
    }

    void checkMarket();
    const marketTimer = window.setInterval(() => void checkMarket(), 15_000);
    const pageTimer = window.setInterval(() => router.refresh(), 60_000);
    return () => {
      closed = true;
      window.clearInterval(marketTimer);
      window.clearInterval(pageTimer);
    };
  }, [bot.enabled, pendingOrder, router]);

  async function handleStart() {
    if (!connected || !configured) return;
    const confirmed = window.confirm(
      `Start real spot trading on ${bot.symbol}? The bot can place market orders up to ${bot.quoteOrderAmount} per buy.`,
    );
    if (!confirmed) return;
    setPending(true);
    const result = await startBot();
    setMessage(result.message);
    setPending(false);
    router.refresh();
  }

  async function handlePause() {
    setPending(true);
    const result = await pauseBot();
    setMessage(result.message);
    setPending(false);
    router.refresh();
  }

  async function handleClose() {
    const confirmed = window.confirm(
      `Send a market sell for the bot-tracked ${bot.symbol} position? This places a real order.`,
    );
    if (!confirmed) return;
    setPending(true);
    const result = await closePosition();
    setMessage(result.message);
    setPending(false);
    router.refresh();
  }

  async function handlePendingReview() {
    const confirmed = window.confirm(
      "Check Binance.US first. Continue only if you have reviewed recent orders and balances for this market.",
    );
    if (!confirmed) return;
    setPending(true);
    const result = await confirmNoPendingOrder();
    setMessage(result.message);
    setPending(false);
    router.refresh();
  }

  return (
    <section aria-labelledby="bot-control-title" className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Automation</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="bot-control-title">
            {pendingOrder ? "Order needs review" : bot.enabled ? "Monitoring market" : "Bot paused"}
          </h2>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pendingOrder ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : bot.enabled ? "bg-[var(--market-up)]/10 text-[var(--market-up)]" : "bg-muted text-muted-foreground"}`}>
          <span className={`size-1.5 rounded-full ${pendingOrder ? "bg-amber-600" : bot.enabled ? "bg-[var(--market-up)]" : "bg-muted-foreground"}`} />
          {pendingOrder ? "Review" : bot.enabled ? "Active" : "Paused"}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-md bg-muted/60 p-3">
        {bot.lastError ? (
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" size={17} />
        ) : (
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={17} />
        )}
        <p className="text-sm leading-5 text-muted-foreground">
          {bot.lastError || (pendingOrder
            ? "A recent order is not confirmed. Trading stays paused until it is checked against Binance.US."
            : "Spot only. This bot never requests withdrawals or uses leverage. One open position at a time; up to five new entries per UTC day.")}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {pendingOrder ? (
          <>
            {bot.enabled ? <Button disabled={pending} onClick={handlePause} variant="outline"><Pause aria-hidden="true" size={16} />Pause new trades</Button> : null}
            <Button disabled={pending || !connected} onClick={handlePendingReview} variant="outline">Check unresolved order</Button>
          </>
        ) : bot.enabled ? (
          <Button disabled={pending} onClick={handlePause} variant="outline">
            <Pause aria-hidden="true" size={16} />
            Pause new trades
          </Button>
        ) : (
          <Button disabled={pending || !connected || !configured} onClick={handleStart}>
            <Play aria-hidden="true" size={16} />
            Start trading
          </Button>
        )}
        {Number(bot.currentPositionQty) > 0 ? (
          <Button disabled={pending} onClick={handleClose} variant="destructive">
            Close position
          </Button>
        ) : null}
        {!configured ? (
          <Button nativeButton={false} render={<Link href="/strategy" />} variant="outline">
            Set strategy
          </Button>
        ) : null}
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">
        {message || (bot.enabled
          ? "Checks run every 15 seconds while this overview stays open."
          : "Pausing prevents new orders; any open position stays on Binance.US until closed." )}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Loss limits cannot guarantee a maximum loss. Fast markets, exchange fees, and order execution can change the final result.
      </p>
    </section>
  );
}
