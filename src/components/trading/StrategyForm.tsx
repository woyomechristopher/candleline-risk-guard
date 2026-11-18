"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, ShieldAlert } from "lucide-react";

import { saveBotStrategy } from "@/app/actions/bot-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BotSettings } from "@/types/trading";

interface StrategyFormProps {
  bot: BotSettings;
  hasOpenPosition: boolean;
}

export default function StrategyForm({ bot, hasOpenPosition }: StrategyFormProps) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(bot.symbol);
  const [interval, setInterval] = useState(bot.interval);
  const [fastPeriod, setFastPeriod] = useState(String(bot.fastPeriod));
  const [slowPeriod, setSlowPeriod] = useState(String(bot.slowPeriod));
  const [quoteOrderAmount, setQuoteOrderAmount] = useState(bot.quoteOrderAmount);
  const [maxDailyLoss, setMaxDailyLoss] = useState(bot.maxDailyLoss);
  const [stopLossPercent, setStopLossPercent] = useState(bot.stopLossPercent);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setSuccess(false);
    const result = await saveBotStrategy({
      symbol,
      interval,
      fastPeriod,
      slowPeriod,
      quoteOrderAmount,
      maxDailyLoss,
      stopLossPercent,
    });
    setMessage(result.message);
    setSuccess(result.ok);
    setPending(false);
    if (result.ok) router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-lg border border-border bg-card p-5 md:p-6">
        <div className="mb-5 border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Signal rules</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Moving-average crossover</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The bot compares two simple averages on completed candles. A cross above can buy; a cross below can sell. It holds at most one position.
          </p>
        </div>

        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="symbol">Binance.US market</Label>
            <Input autoCapitalize="characters" autoComplete="off" id="symbol" maxLength={20} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="BTCUSDT" value={symbol} />
            <p className="text-xs text-muted-foreground">Enter the exact market symbol shown by Binance.US.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="interval">Candle interval</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              id="interval"
              onChange={(event) => setInterval(event.target.value as BotSettings["interval"])}
              value={interval}
            >
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
              <option value="15m">15 minutes</option>
              <option value="1h">1 hour</option>
              <option value="4h">4 hours</option>
              <option value="1d">1 day</option>
            </select>
            <p className="text-xs text-muted-foreground">Signals use completed candles only.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fast-period">Fast average period</Label>
            <Input id="fast-period" max="199" min="2" onChange={(event) => setFastPeriod(event.target.value)} step="1" type="number" value={fastPeriod} />
            <p className="text-xs text-muted-foreground">Shorter window for the quicker signal.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slow-period">Slow average period</Label>
            <Input id="slow-period" max="200" min="3" onChange={(event) => setSlowPeriod(event.target.value)} step="1" type="number" value={slowPeriod} />
            <p className="text-xs text-muted-foreground">Must be longer than the fast period.</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 md:p-6">
        <div className="mb-5 border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Risk limits</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Keep each trade bounded</h2>
          <p className="mt-1 text-sm text-muted-foreground">Limits are required before the bot can start. A market can move through a stop before an order fills.</p>
        </div>

        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="quote-order-amount">Maximum spend per buy</Label>
            <Input id="quote-order-amount" min="0" onChange={(event) => setQuoteOrderAmount(event.target.value)} placeholder="Set your own amount" step="any" type="number" value={quoteOrderAmount} />
            <p className="text-xs text-muted-foreground">Uses the market’s quote currency and never exceeds your free balance.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-daily-loss">Daily realized-loss limit</Label>
            <Input id="max-daily-loss" min="0" onChange={(event) => setMaxDailyLoss(event.target.value)} placeholder="Set your own limit" step="any" type="number" value={maxDailyLoss} />
            <p className="text-xs text-muted-foreground">Gross realized P&amp;L resets at 00:00 UTC; exchange fees are not included.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stop-loss-percent">Stop-loss percentage</Label>
            <Input id="stop-loss-percent" max="100" min="0.01" onChange={(event) => setStopLossPercent(event.target.value)} placeholder="Set your own percentage" step="any" type="number" value={stopLossPercent} />
            <p className="text-xs text-muted-foreground">A sell is attempted when the last completed close crosses this level.</p>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
          <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" size={17} />
          <p className="leading-5 text-muted-foreground">
            This creates real market orders. The bot never requests withdrawals or uses leverage, caps new entries at five per UTC day, and pauses after uncertain order results. Disable withdrawal permission on the exchange key. Loss limits are not guarantees.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || bot.enabled} type="submit">
          <Save aria-hidden="true" size={16} />
          {pending ? "Saving…" : "Save strategy"}
        </Button>
        <Button nativeButton={false} render={<Link href="/" />} variant="outline">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to overview
        </Button>
        {bot.enabled ? <span className="text-sm text-muted-foreground">Pause the bot before editing its rules.</span> : null}
        {hasOpenPosition ? <span className="text-sm text-muted-foreground">The open position must be closed before changing markets.</span> : null}
        <p aria-live="polite" className={`w-full text-sm ${success ? "text-[var(--market-up)]" : "text-destructive"}`}>
          {message}
        </p>
      </div>
    </form>
  );
}
