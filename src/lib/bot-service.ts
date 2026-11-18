import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tradeEvent, tradingBot } from "@/db/schema";
import {
  BinanceUsError,
  getAccount,
  getCandles,
  hasBinanceCredentials,
} from "@/lib/binance-us";
import type { BotSettings, CandlePoint, DashboardData, TradeEventView } from "@/types/trading";

export function isBotOwner(email: string): boolean {
  const ownerEmail = process.env.BINANCE_BOT_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(ownerEmail && email.trim().toLowerCase() === ownerEmail);
}

export async function getBotRow(userId: string) {
  let [bot] = await db.select().from(tradingBot).where(eq(tradingBot.userId, userId)).limit(1);
  if (bot) return bot;

  await db.insert(tradingBot).values({ userId }).onConflictDoNothing({ target: tradingBot.userId });
  [bot] = await db.select().from(tradingBot).where(eq(tradingBot.userId, userId)).limit(1);
  if (!bot) throw new Error("Your trading setup could not be loaded.");
  return bot;
}

function toBotSettings(bot: typeof tradingBot.$inferSelect): BotSettings {
  return {
    enabled: bot.enabled,
    symbol: bot.symbol,
    interval: bot.interval as BotSettings["interval"],
    fastPeriod: bot.fastPeriod,
    slowPeriod: bot.slowPeriod,
    quoteOrderAmount: bot.quoteOrderAmount,
    maxDailyLoss: bot.maxDailyLoss,
    stopLossPercent: bot.stopLossPercent,
    currentPositionQty: bot.currentPositionQty,
    currentPositionCost: bot.currentPositionCost,
    dailyRealizedPnl: bot.dailyRealizedPnl,
    dailyTradeCount: bot.dailyTradeCount,
    dailyDayKey: bot.dailyDayKey,
    lastHeartbeatAt: bot.lastHeartbeatAt?.toISOString() ?? null,
    lastError: bot.lastError,
  };
}

function toTradeEvent(event: typeof tradeEvent.$inferSelect): TradeEventView {
  return {
    id: event.id,
    symbol: event.symbol,
    side: event.side,
    signal: event.signal,
    status: event.status,
    price: event.price,
    quantity: event.quantity,
    quoteAmount: event.quoteAmount,
    realizedPnl: event.realizedPnl,
    createdAt: event.createdAt.toISOString(),
  };
}

function toCandlePoint(candle: Awaited<ReturnType<typeof getCandles>>[number]): CandlePoint {
  return {
    close: candle.close,
    label: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(candle.closeTime)),
    openTime: candle.openTime,
  };
}

export async function loadDashboardData(userId: string): Promise<DashboardData> {
  const bot = await getBotRow(userId);
  const [events, pendingEvents] = await Promise.all([
    db.select().from(tradeEvent)
      .where(eq(tradeEvent.userId, userId))
      .orderBy(desc(tradeEvent.createdAt))
      .limit(12),
    db.select({ id: tradeEvent.id }).from(tradeEvent)
      .where(and(eq(tradeEvent.userId, userId), eq(tradeEvent.status, "PENDING")))
      .limit(1),
  ]);

  let candles: CandlePoint[] = [];
  let marketMessage = "Choose a market in Strategy to view its live chart.";
  if (bot.symbol) {
    try {
      const now = Date.now();
      const exchangeCandles = await getCandles(bot.symbol, bot.interval, 100);
      candles = exchangeCandles
        .filter((candle) => candle.closeTime < now)
        .slice(-72)
        .map(toCandlePoint);
      marketMessage = candles.length ? "Live market data from Binance.US" : "Waiting for the first completed candle.";
    } catch {
      marketMessage = "Market prices are temporarily unavailable.";
    }
  }

  const credentialsReady = hasBinanceCredentials();
  let accountReady = false;
  let canTrade = false;
  let exchangeMessage = credentialsReady
    ? "Checking your Binance.US account…"
    : "Secure Binance.US access is being connected.";
  let balances: DashboardData["exchange"]["balances"] = [];

  if (credentialsReady) {
    try {
      const account = await getAccount();
      accountReady = true;
      canTrade = account.canTrade;
      exchangeMessage = account.canTrade
        ? "Binance.US account connected"
        : "Spot trading permission is not enabled.";
      balances = account.balances
        .filter((balance) => Number(balance.free) > 0)
        .slice(0, 8)
        .map((balance) => ({ asset: balance.asset, free: balance.free }));
    } catch (error) {
      exchangeMessage = error instanceof BinanceUsError
        ? error.message
        : "Binance.US could not be reached.";
    }
  }

  return {
    bot: toBotSettings(bot),
    candles,
    pendingOrder: pendingEvents.length > 0,
    recentTrades: events.map(toTradeEvent),
    exchange: { credentialsReady, accountReady, canTrade, message: exchangeMessage, balances },
    updatedAt: new Date().toISOString(),
  };
}

export async function saveSettings(userId: string, settings: {
  symbol: string;
  interval: BotSettings["interval"];
  fastPeriod: number;
  slowPeriod: number;
  quoteOrderAmount: string;
  maxDailyLoss: string;
  stopLossPercent: string;
}) {
  const bot = await getBotRow(userId);
  if (bot.enabled) throw new Error("Pause the bot before changing its rules.");
  if (Number(bot.currentPositionQty) > 0 && settings.symbol !== bot.symbol) {
    throw new Error("Close the open position before changing its market.");
  }
  await db.update(tradingBot)
    .set({ ...settings, lastError: null, updatedAt: new Date() })
    .where(and(eq(tradingBot.userId, userId), eq(tradingBot.id, bot.id)));
}

export async function setBotEnabled(userId: string, enabled: boolean, lastError: string | null = null) {
  const bot = await getBotRow(userId);
  await db.update(tradingBot)
    .set({ enabled, lastError, updatedAt: new Date() })
    .where(eq(tradingBot.userId, userId));
  return bot;
}

export async function listTradeEvents(userId: string) {
  const events = await db.select().from(tradeEvent)
    .where(eq(tradeEvent.userId, userId))
    .orderBy(desc(tradeEvent.createdAt))
    .limit(100);
  return events.map(toTradeEvent);
}
