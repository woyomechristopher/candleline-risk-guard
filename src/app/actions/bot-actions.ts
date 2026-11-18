"use server";

import { and, desc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { tradeEvent, tradingBot } from "@/db/schema";
import { getUser } from "@/lib/auth";
import {
  BinanceUsError,
  findOrder,
  getAccount,
  getCandles,
  getSymbolRules,
  hasBinanceCredentials,
  makeClientOrderId,
  placeMarketOrder,
} from "@/lib/binance-us";
import { getBotRow, isBotOwner, saveSettings as persistSettings, setBotEnabled } from "@/lib/bot-service";
import type { ActionResult, TradingInterval } from "@/types/trading";

const intervals: TradingInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const maxDailyEntries = 5;

class UserFacingError extends Error {}

interface SettingsInput {
  symbol: string;
  interval: TradingInterval;
  fastPeriod: number;
  slowPeriod: number;
  quoteOrderAmount: string;
  maxPositionSize: string;
  maxDailyLoss: string;
  stopLossPercent: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError || error instanceof BinanceUsError) return error.message;
  return fallback;
}

async function requireOwner(): Promise<{ id: string; email: string }> {
  const user = await getUser();
  if (!user) throw new UserFacingError("Sign in with the bot owner account to continue.");
  if (!isBotOwner(user.email)) throw new UserFacingError("This trading dashboard is limited to its designated owner.");
  return { id: user.id, email: user.email };
}

function readSettings(input: unknown): SettingsInput {
  if (!isRecord(input)) throw new UserFacingError("Review the strategy fields and try again.");
  const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  const interval = input.interval;
  const fastPeriod = Number(input.fastPeriod);
  const slowPeriod = Number(input.slowPeriod);
  const quoteOrderAmount = typeof input.quoteOrderAmount === "string" ? input.quoteOrderAmount.trim() : "";
  const maxPositionSize = typeof input.maxPositionSize === "string" ? input.maxPositionSize.trim() : "";
  const maxDailyLoss = typeof input.maxDailyLoss === "string" ? input.maxDailyLoss.trim() : "";
  const stopLossPercent = typeof input.stopLossPercent === "string" ? input.stopLossPercent.trim() : "";

  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) {
    throw new UserFacingError("Enter a valid Binance.US market symbol, such as BTCUSDT.");
  }
  if (typeof interval !== "string" || !intervals.includes(interval as TradingInterval)) {
    throw new UserFacingError("Choose one of the listed candle intervals.");
  }
  if (!Number.isInteger(fastPeriod) || !Number.isInteger(slowPeriod) || fastPeriod < 2 || slowPeriod > 200 || fastPeriod >= slowPeriod) {
    throw new UserFacingError("The fast period must be 2 or higher and smaller than the slow period, which can be up to 200.");
  }
  const amount = Number(quoteOrderAmount);
  const positionSize = Number(maxPositionSize);
  const lossCap = Number(maxDailyLoss);
  const stopLoss = Number(stopLossPercent);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    throw new UserFacingError("Enter a positive maximum spend for each buy.");
  }
  if (!Number.isFinite(positionSize) || positionSize <= 0 || positionSize > 1_000_000) {
    throw new UserFacingError("Enter a positive maximum total position size.");
  }
  if (!Number.isFinite(lossCap) || lossCap <= 0 || lossCap > 1_000_000) {
    throw new UserFacingError("Enter a positive daily loss limit.");
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= 0 || stopLoss > 100) {
    throw new UserFacingError("Enter a stop-loss percentage greater than zero and no more than 100.");
  }
  if (positionSize * stopLoss / 100 > lossCap) {
    throw new UserFacingError("The maximum position’s planned stop-loss must fit within the daily loss limit.");
  }
  return { symbol, interval: interval as TradingInterval, fastPeriod, slowPeriod, quoteOrderAmount, maxPositionSize, maxDailyLoss, stopLossPercent };
}

function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function sma(values: number[], period: number, endIndex: number): number {
  const start = endIndex - period + 1;
  if (start < 0) return Number.NaN;
  const slice = values.slice(start, endIndex + 1);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function crossoverSignal(closes: number[], fastPeriod: number, slowPeriod: number): "BUY" | "SELL" | null {
  const index = closes.length - 1;
  if (index < slowPeriod) return null;
  const previousFast = sma(closes, fastPeriod, index - 1);
  const currentFast = sma(closes, fastPeriod, index);
  const previousSlow = sma(closes, slowPeriod, index - 1);
  const currentSlow = sma(closes, slowPeriod, index);
  if (previousFast <= previousSlow && currentFast > currentSlow) return "BUY";
  if (previousFast >= previousSlow && currentFast < currentSlow) return "SELL";
  return null;
}

function floorToStep(quantity: number, step: number): string {
  if (!Number.isFinite(quantity) || quantity <= 0) return "0";
  if (!Number.isFinite(step) || step <= 0) return String(quantity);
  const stepText = step.toString();
  const [coefficient, exponentText] = stepText.split("e");
  const exponent = Number(exponentText ?? "0");
  const decimalPlaces = Math.max(0, (coefficient.split(".")[1]?.length ?? 0) - exponent);
  const scale = 10 ** Math.min(decimalPlaces, 12);
  const stepUnits = Math.max(1, Math.round(step * scale));
  const units = Math.floor((quantity * scale + 1e-10) / stepUnits) * stepUnits;
  const result = (units / scale).toFixed(Math.min(decimalPlaces, 12));
  return decimalPlaces > 0 ? result.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1") : result;
}

async function claimCandle(bot: typeof tradingBot.$inferSelect, candleTime: number, dayKey: string) {
  const conditions = [
    eq(tradingBot.id, bot.id),
    eq(tradingBot.enabled, true),
    bot.lastProcessedCandle
      ? eq(tradingBot.lastProcessedCandle, bot.lastProcessedCandle)
      : isNull(tradingBot.lastProcessedCandle),
  ];
  const result = await db.update(tradingBot)
    .set({
      lastProcessedCandle: String(candleTime),
      lastHeartbeatAt: new Date(),
      dailyDayKey: dayKey,
      dailyRealizedPnl: bot.dailyDayKey === dayKey ? bot.dailyRealizedPnl : "0",
      dailyTradeCount: bot.dailyDayKey === dayKey ? bot.dailyTradeCount : 0,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ id: tradingBot.id });
  return result.length > 0;
}

async function applyOrderFill(
  bot: typeof tradingBot.$inferSelect,
  event: typeof tradeEvent.$inferSelect,
  order: Awaited<ReturnType<typeof placeMarketOrder>>,
) {
  const quantity = Number(order.executedQty);
  const quote = Number(order.cummulativeQuoteQty);
  if (!Number.isFinite(quantity) || !Number.isFinite(quote) || quantity <= 0) {
    await db.update(tradeEvent)
      .set({ status: "NO_FILL" })
      .where(eq(tradeEvent.clientOrderId, event.clientOrderId));
    await setBotEnabled(bot.userId, false, "The exchange returned no filled quantity. Review the account before restarting.");
    return "The exchange reported no filled quantity; the bot is paused for review.";
  }

  const averagePrice = quote / quantity;
  let currentQty = Number(bot.currentPositionQty);
  let currentCost = Number(bot.currentPositionCost);
  let realizedPnl: number | null = null;
  let dailyPnl = bot.dailyDayKey === currentUtcDay() ? Number(bot.dailyRealizedPnl) : 0;
  let dailyTradeCount = bot.dailyDayKey === currentUtcDay() ? bot.dailyTradeCount : 0;

  if (event.side === "BUY") {
    currentQty += quantity;
    currentCost += quote;
    dailyTradeCount += 1;
  } else {
    const heldQty = Math.max(currentQty, quantity);
    const costUsed = heldQty > 0 ? currentCost * (quantity / heldQty) : 0;
    realizedPnl = quote - costUsed;
    dailyPnl += realizedPnl;
    currentQty = Math.max(0, currentQty - quantity);
    currentCost = Math.max(0, currentCost - costUsed);
    if (currentQty < 1e-12) {
      currentQty = 0;
      currentCost = 0;
    }
  }

  await db.update(tradeEvent)
    .set({
      exchangeOrderId: order.orderId,
      status: order.status,
      price: String(averagePrice),
      quantity: String(quantity),
      quoteAmount: String(quote),
      realizedPnl: realizedPnl === null ? null : String(realizedPnl),
    })
    .where(eq(tradeEvent.clientOrderId, event.clientOrderId));
  await db.update(tradingBot)
    .set({
      currentPositionQty: String(currentQty),
      currentPositionCost: String(currentCost),
      dailyRealizedPnl: String(dailyPnl),
      dailyTradeCount,
      dailyDayKey: currentUtcDay(),
      enabled: order.status === "FILLED" ? bot.enabled : false,
      lastError: order.status === "FILLED" ? null : "A market order was only partially filled. Review the exchange before restarting.",
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tradingBot.id, bot.id));

  return order.status === "FILLED"
    ? `${event.side === "BUY" ? "Buy" : "Sell"} filled at an average ${averagePrice.toFixed(6)}.`
    : "The market order was partially filled; the bot is paused for review.";
}

async function reconcilePendingOrder(bot: typeof tradingBot.$inferSelect) {
  const [pending] = await db.select().from(tradeEvent)
    .where(and(eq(tradeEvent.botId, bot.id), eq(tradeEvent.status, "PENDING")))
    .orderBy(desc(tradeEvent.createdAt))
    .limit(1);
  if (!pending) return null;

  try {
    const order = await findOrder(pending.symbol, pending.clientOrderId);
    if (!order) {
      await setBotEnabled(bot.userId, false, "A recent order could not be confirmed. Check Binance.US before restarting.");
      return "A recent order needs review in Binance.US; trading is paused.";
    }
    if (order.status === "FILLED" || order.status === "PARTIALLY_FILLED") {
      const message = await applyOrderFill(bot, pending, order);
      await setBotEnabled(bot.userId, false, "The bot paused after recovering a pending order. Review the position before restarting.");
      return `${message} The bot remains paused until you review the position.`;
    }
    await db.update(tradeEvent)
      .set({ exchangeOrderId: order.orderId, status: order.status })
      .where(eq(tradeEvent.clientOrderId, pending.clientOrderId));
    await setBotEnabled(bot.userId, false, "A recent order did not complete as expected. Review Binance.US before restarting.");
    return "A recent order did not complete; trading is paused for review.";
  } catch {
    await setBotEnabled(bot.userId, false, "A recent order could not be confirmed. Check Binance.US before restarting.");
    return "A recent order needs review in Binance.US; trading is paused.";
  }
}

async function executeSignal(
  requestedBot: typeof tradingBot.$inferSelect,
  side: "BUY" | "SELL",
  signal: string,
  candleTime: number,
  currentPrice: number,
) {
  const rules = await getSymbolRules(requestedBot.symbol);
  if (!rules || rules.status !== "TRADING") {
    await setBotEnabled(requestedBot.userId, false, "This market is not currently available for spot trading.");
    return "This market is not currently available; the bot is paused.";
  }
  if (side === "BUY" && !rules.quoteOrderQtyMarketAllowed) {
    await setBotEnabled(requestedBot.userId, false, "This market does not support a spend-capped market buy.");
    return "This market does not support a spend-capped buy; the bot is paused.";
  }

  const account = side === "BUY" ? await getAccount() : null;
  const bot = await getBotRow(requestedBot.userId);
  if (bot.id !== requestedBot.id) {
    await setBotEnabled(requestedBot.userId, false, "The saved strategy changed during this market check.");
    return "The saved strategy changed; trading is paused for review.";
  }

  const [pendingOrder] = await db.select({ id: tradeEvent.id }).from(tradeEvent)
    .where(and(eq(tradeEvent.botId, bot.id), eq(tradeEvent.status, "PENDING")))
    .limit(1);
  if (pendingOrder) {
    await setBotEnabled(bot.userId, false, "A previous order is still awaiting confirmation.");
    return "A previous order is still being reviewed; trading is paused.";
  }

  const clientOrderId = makeClientOrderId(bot.id, candleTime, side);
  let orderQuantity = "0";
  let orderQuote = "0";

  if (side === "BUY") {
    if (!account?.canTrade) {
      await setBotEnabled(bot.userId, false, "Spot trading permission is not enabled for this exchange key.");
      return "Spot trading permission is not enabled; the bot is paused.";
    }
    const settings = readSettings(bot);
    const currentPositionCost = Number(bot.currentPositionCost);
    const positionQty = Number(bot.currentPositionQty);
    const currentDayPnl = bot.dailyDayKey === currentUtcDay() ? Number(bot.dailyRealizedPnl) : 0;
    const maxDailyLoss = Number(settings.maxDailyLoss);
    const maxPositionSize = Number(settings.maxPositionSize);
    if (
      !Number.isFinite(currentPositionCost) ||
      currentPositionCost < 0 ||
      !Number.isFinite(positionQty) ||
      positionQty < 0 ||
      (positionQty > 0 && currentPositionCost <= 0) ||
      !Number.isFinite(currentDayPnl)
    ) {
      await setBotEnabled(bot.userId, false, "Saved risk totals could not be verified.");
      return "Saved risk totals could not be verified; the bot is paused.";
    }
    if (currentDayPnl <= -maxDailyLoss) {
      await setBotEnabled(bot.userId, false, "The daily realized-loss limit was reached.");
      return "The daily loss limit was reached; this buy was blocked and the bot is paused.";
    }

    const remainingPositionSize = Math.max(0, maxPositionSize - currentPositionCost);
    const spendBeforePrecision = Math.min(Number(settings.quoteOrderAmount), remainingPositionSize);
    const requestedAmount = Math.floor(spendBeforePrecision * 100_000_000) / 100_000_000;
    const projectedStopLoss = (currentPositionCost + requestedAmount) * Number(settings.stopLossPercent) / 100;
    const remainingDailyLoss = maxDailyLoss + currentDayPnl;
    if (requestedAmount <= 0 || currentPositionCost + requestedAmount > maxPositionSize + 1e-8) {
      await setBotEnabled(bot.userId, false, "The configured maximum position size has been reached.");
      return "The position-size limit blocks this buy; the bot is paused.";
    }
    if (projectedStopLoss > remainingDailyLoss + 1e-8) {
      await setBotEnabled(bot.userId, false, "The planned stop-loss risk exceeds the remaining daily loss limit.");
      return "This buy would exceed the remaining daily risk limit; the bot is paused.";
    }
    const averageEntry = positionQty > 0 ? currentPositionCost / positionQty : 0;
    const stopPrice = averageEntry * (1 - Number(settings.stopLossPercent) / 100);
    if (positionQty > 0 && currentPrice > 0 && currentPrice <= stopPrice) {
      await setBotEnabled(bot.userId, false, "The stop-loss level was reached before this buy.");
      return "The stop-loss level blocks this buy; the bot is paused for review.";
    }

    if (rules.minNotional > 0 && requestedAmount < rules.minNotional) {
      await setBotEnabled(bot.userId, false, "The buy limit is below this market’s minimum order size.");
      return "The buy limit is below this market’s minimum; the bot is paused.";
    }
    const available = Number(account.balances.find((balance) => balance.asset === rules.quoteAsset)?.free ?? "0");
    if (!Number.isFinite(available) || requestedAmount > available * 0.995) {
      await setBotEnabled(bot.userId, false, `There is not enough available ${rules.quoteAsset} balance for the configured buy limit.`);
      return `There is not enough available ${rules.quoteAsset} balance; the bot is paused.`;
    }
    orderQuote = requestedAmount.toFixed(8).replace(/\.?0+$/, "");
  } else {
    const quantity = floorToStep(Number(bot.currentPositionQty), rules.quantityStep);
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      await setBotEnabled(bot.userId, false, "The tracked position is below this market’s sellable quantity.");
      return "The tracked position is below this market’s sellable amount; the bot is paused.";
    }
    orderQuantity = quantity;
  }

  const [event] = await db.insert(tradeEvent).values({
    userId: bot.userId,
    botId: bot.id,
    clientOrderId,
    symbol: bot.symbol,
    side,
    signal,
    status: "PENDING",
    price: String(currentPrice),
    quantity: orderQuantity,
    quoteAmount: orderQuote,
  }).returning();
  if (!event) {
    await setBotEnabled(bot.userId, false, "The order record could not be saved. Trading is paused.");
    return "The order record could not be saved; the bot is paused.";
  }

  try {
    const order = await placeMarketOrder({
      symbol: bot.symbol,
      side,
      clientOrderId,
      quoteOrderQty: side === "BUY" ? orderQuote : undefined,
      quantity: side === "SELL" ? orderQuantity : undefined,
    });
    return await applyOrderFill(bot, event, order);
  } catch (error) {
    try {
      const order = await findOrder(bot.symbol, clientOrderId);
      if (order) return await applyOrderFill(bot, event, order);
      await db.update(tradeEvent)
        .set({ status: "FAILED" })
        .where(eq(tradeEvent.clientOrderId, clientOrderId));
      const message = error instanceof BinanceUsError
        ? error.message
        : "The exchange could not confirm the order. Trading has been paused.";
      await setBotEnabled(bot.userId, false, message);
      return `${message} Check Binance.US before restarting.`;
    } catch {
      await setBotEnabled(bot.userId, false, "A recent order could not be confirmed. Check Binance.US before restarting.");
      return "A recent order needs review in Binance.US; trading is paused.";
    }
  }
}

export async function saveBotStrategy(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireOwner();
    const settings = readSettings(input);
    const bot = await getBotRow(user.id);
    if (bot.enabled) throw new UserFacingError("Pause the bot before changing its rules.");
    if (Number(bot.currentPositionQty) > 0 && settings.symbol !== bot.symbol) {
      throw new UserFacingError("Close the open position before changing its market.");
    }
    await persistSettings(user.id, settings);
    revalidatePath("/");
    revalidatePath("/strategy");
    return { ok: true, message: "Your trading rules are saved." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Your rules could not be saved. Try again.") };
  }
}

export async function startBot(): Promise<ActionResult> {
  try {
    const user = await requireOwner();
    if (!hasBinanceCredentials()) throw new UserFacingError("Secure Binance.US access is not connected yet.");
    const bot = await getBotRow(user.id);
    const settings = readSettings(bot);
    if (Number(bot.currentPositionQty) > 0 && settings.symbol !== bot.symbol) {
      throw new UserFacingError("Close the open position before changing its market.");
    }
    const [rules, account] = await Promise.all([getSymbolRules(settings.symbol), getAccount()]);
    if (!rules || rules.status !== "TRADING") throw new UserFacingError("This market is not currently available for spot trading.");
    if (!rules.quoteOrderQtyMarketAllowed) throw new UserFacingError("This market does not support a spend-capped market buy. Choose a different market.");
    if (!account.canTrade) throw new UserFacingError("Spot trading permission is not enabled for this exchange key.");
    const maximumEntryAmount = Math.min(Number(settings.quoteOrderAmount), Number(settings.maxPositionSize));
    if (rules.minNotional > 0 && maximumEntryAmount < rules.minNotional) {
      throw new UserFacingError(`The buy limit must be at least ${rules.minNotional} ${rules.quoteAsset} for this market.`);
    }
    const available = Number(account.balances.find((balance) => balance.asset === rules.quoteAsset)?.free ?? "0");
    if (maximumEntryAmount > available * 0.995) {
      throw new UserFacingError(`Your available ${rules.quoteAsset} balance is below the configured buy limit.`);
    }
    if (bot.dailyDayKey === currentUtcDay() && Number(bot.dailyRealizedPnl) <= -Number(settings.maxDailyLoss)) {
      throw new UserFacingError("Today’s loss limit has already been reached. The bot cannot restart until the next UTC day.");
    }
    const [pending] = await db.select({ id: tradeEvent.id }).from(tradeEvent)
      .where(and(eq(tradeEvent.botId, bot.id), eq(tradeEvent.status, "PENDING")))
      .limit(1);
    if (pending) throw new UserFacingError("A recent order needs review in Binance.US before the bot can restart.");
    await setBotEnabled(user.id, true, null);
    revalidatePath("/");
    return { ok: true, message: "Trading started. Keep the dashboard open while it monitors the market." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "The bot could not start. Review your account and try again.") };
  }
}

export async function pauseBot(): Promise<ActionResult> {
  try {
    const user = await requireOwner();
    await setBotEnabled(user.id, false, null);
    revalidatePath("/");
    return { ok: true, message: "The bot is paused. Any open position remains on Binance.US." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "The bot could not be paused. Refresh and try again.") };
  }
}

export async function closePosition(): Promise<ActionResult> {
  try {
    const user = await requireOwner();
    if (!hasBinanceCredentials()) throw new UserFacingError("Secure Binance.US access is not connected yet.");
    const bot = await getBotRow(user.id);
    if (Number(bot.currentPositionQty) <= 0) throw new UserFacingError("There is no open position tracked by this bot.");
    const [pending] = await db.select({ id: tradeEvent.id }).from(tradeEvent)
      .where(and(eq(tradeEvent.botId, bot.id), eq(tradeEvent.status, "PENDING")))
      .limit(1);
    if (pending) throw new UserFacingError("A recent order needs review before another order can be sent.");
    if (bot.enabled) await setBotEnabled(user.id, false, null);
    const message = await executeSignal({ ...bot, enabled: false }, "SELL", "Manual close", Date.now(), 0);
    revalidatePath("/");
    revalidatePath("/orders");
    return { ok: !message.includes("paused"), message };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "The position could not be closed. Check Binance.US before retrying.") };
  }
}

export async function confirmNoPendingOrder(): Promise<ActionResult> {
  try {
    const user = await requireOwner();
    if (!hasBinanceCredentials()) throw new UserFacingError("Secure Binance.US access is not connected yet.");
    const bot = await getBotRow(user.id);
    const [pending] = await db.select().from(tradeEvent)
      .where(and(eq(tradeEvent.botId, bot.id), eq(tradeEvent.status, "PENDING")))
      .orderBy(desc(tradeEvent.createdAt))
      .limit(1);
    if (!pending) return { ok: true, message: "There is no pending order to review." };

    const order = await findOrder(pending.symbol, pending.clientOrderId);
    if (order) {
      if (order.status === "FILLED" || order.status === "PARTIALLY_FILLED") {
        const message = await applyOrderFill(bot, pending, order);
        await setBotEnabled(user.id, false, "A recovered exchange order was applied. Review the position before restarting.");
        revalidatePath("/");
        revalidatePath("/orders");
        return { ok: false, message: `${message} The bot remains paused.` };
      }
      await db.update(tradeEvent)
        .set({ exchangeOrderId: order.orderId, status: order.status })
        .where(eq(tradeEvent.clientOrderId, pending.clientOrderId));
      await setBotEnabled(user.id, false, "A recent order did not complete as expected. Review Binance.US before restarting.");
      revalidatePath("/");
      revalidatePath("/orders");
      return { ok: false, message: "The exchange found the order, but it did not fill. Trading remains paused for review." };
    }

    await db.update(tradeEvent)
      .set({ status: "NOT_FOUND_CONFIRMED" })
      .where(eq(tradeEvent.clientOrderId, pending.clientOrderId));
    await setBotEnabled(user.id, false, null);
    revalidatePath("/");
    revalidatePath("/orders");
    return { ok: true, message: "Binance.US found no matching order. The bot remains paused; review your balance before restarting." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "The order could not be verified. Keep the bot paused and check Binance.US.") };
  }
}

export async function runBotTick(): Promise<ActionResult> {
  let ownerId: string | null = null;
  try {
    const user = await requireOwner();
    ownerId = user.id;
    const bot = await getBotRow(user.id);
    const pendingMessage = await reconcilePendingOrder(bot);
    if (pendingMessage) {
      revalidatePath("/");
      revalidatePath("/orders");
      return { ok: false, message: pendingMessage };
    }
    if (!bot.enabled) return { ok: true, message: "Bot is paused." };
    const settings = readSettings(bot);
    if (!hasBinanceCredentials()) {
      await setBotEnabled(user.id, false, "Secure Binance.US access is not connected.");
      return { ok: false, message: "Secure Binance.US access is not connected; the bot is paused." };
    }

    const now = Date.now();
    const candles = await getCandles(bot.symbol, bot.interval, Math.max(120, bot.slowPeriod + 2));
    const closedCandles = candles.filter((candle) => candle.closeTime < now);
    if (closedCandles.length < bot.slowPeriod + 1) {
      return { ok: true, message: "Waiting for enough completed market candles." };
    }
    const latest = closedCandles[closedCandles.length - 1];
    if (!latest || String(latest.closeTime) === bot.lastProcessedCandle) {
      await db.update(tradingBot)
        .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
        .where(eq(tradingBot.id, bot.id));
      return { ok: true, message: "No new completed candle yet." };
    }

    const dayKey = currentUtcDay();
    const currentPnl = bot.dailyDayKey === dayKey ? Number(bot.dailyRealizedPnl) : 0;
    const maxLoss = Number(settings.maxDailyLoss);
    const positionQty = Number(bot.currentPositionQty);
    const avgEntry = positionQty > 0 ? Number(bot.currentPositionCost) / positionQty : 0;
    const closes = closedCandles.map((candle) => candle.close);
    let signal = crossoverSignal(closes, settings.fastPeriod, settings.slowPeriod);
    let reason = signal === "BUY" ? "Fast average crossed above slow average" : "Fast average crossed below slow average";

    if (currentPnl <= -maxLoss) {
      if (positionQty > 0) {
        signal = "SELL";
        reason = "Daily realized loss limit reached";
      } else {
        await claimCandle(bot, latest.closeTime, dayKey);
        await setBotEnabled(user.id, false, "The daily realized loss limit was reached. Trading is paused until the next UTC day.");
        revalidatePath("/");
        return { ok: false, message: "The daily loss limit was reached; the bot is paused." };
      }
    } else if (positionQty > 0 && avgEntry > 0 && latest.close <= avgEntry * (1 - Number(settings.stopLossPercent) / 100)) {
      signal = "SELL";
      reason = "Configured stop-loss reached";
    } else if (positionQty > 0 && signal === "BUY") {
      signal = null;
    } else if (positionQty <= 0 && signal === "SELL") {
      signal = null;
    }

    if (signal === "BUY" && (bot.dailyDayKey === dayKey ? bot.dailyTradeCount : 0) >= maxDailyEntries) {
      signal = null;
      reason = "Daily entry limit reached";
    }

    const claimed = await claimCandle(bot, latest.closeTime, dayKey);
    if (!claimed) return { ok: true, message: "This candle has already been checked." };
    if (!signal) {
      await db.update(tradingBot)
        .set({ lastError: null, updatedAt: new Date() })
        .where(eq(tradingBot.id, bot.id));
      revalidatePath("/");
      return { ok: true, message: reason || "No trading signal on the latest completed candle." };
    }

    const message = await executeSignal(bot, signal, reason, latest.closeTime, latest.close);
    revalidatePath("/");
    revalidatePath("/orders");
    return { ok: !message.toLowerCase().includes("paused"), message };
  } catch (error) {
    if (ownerId) await setBotEnabled(ownerId, false, "Market check failed. Trading is paused for review.").catch(() => undefined);
    return { ok: false, message: getErrorMessage(error, "Market check failed. Trading has been paused for review.") };
  }
}
