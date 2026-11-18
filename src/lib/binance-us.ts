import "server-only";

import { createHmac, createHash } from "node:crypto";

const API_BASE = "https://api.binance.us";

export class BinanceUsError extends Error {
  constructor(message: string, readonly code: number | null = null) {
    super(message);
    this.name = "BinanceUsError";
  }
}

export interface BinanceCandle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface BinanceAccount {
  canTrade: boolean;
  balances: BinanceBalance[];
}

export interface BinanceSymbolRules {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  minNotional: number;
  quantityStep: number;
  quoteOrderQtyMarketAllowed: boolean;
}

export interface BinanceOrder {
  orderId: string;
  clientOrderId: string;
  status: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills: Array<{ price: string; qty: string }>;
}

export function hasBinanceCredentials(): boolean {
  return Boolean(process.env.BINANCE_US_API_KEY && process.env.BINANCE_US_API_SECRET);
}

function requireCredentials(): { apiKey: string; secret: string } {
  const apiKey = process.env.BINANCE_US_API_KEY;
  const secret = process.env.BINANCE_US_API_SECRET;
  if (!apiKey || !secret) {
    throw new BinanceUsError("Secure exchange access is not connected yet.");
  }
  return { apiKey, secret };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exchangeMessage(code: number | undefined): string {
  if (code === -2014 || code === -2015) {
    return "Binance.US rejected the key or its permissions. Check that spot trading is enabled and withdrawals are disabled.";
  }
  if (code === -1021) {
    return "The exchange clock could not be matched. Wait a moment and try again.";
  }
  if (code === -1013 || code === -1111) {
    return "The order does not meet this market’s size or precision rules.";
  }
  if (code === -2010) {
    return "The exchange could not place this order. Check the available balance and market minimum.";
  }
  return "Binance.US could not complete the request. Trading has been paused.";
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.code === "number" ? payload.code : undefined;
    throw new BinanceUsError(exchangeMessage(code), code ?? null);
  }
  return payload as T;
}

async function publicGet(path: string, parameters: Record<string, string>): Promise<unknown> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return await readResponse<unknown>(response);
  } catch (error) {
    if (error instanceof BinanceUsError) throw error;
    throw new BinanceUsError("Binance.US market data is temporarily unavailable.");
  }
}

async function signedRequest<T>(
  method: "GET" | "POST",
  path: string,
  parameters: Record<string, string>,
): Promise<T> {
  const { apiKey, secret } = requireCredentials();
  const query = new URLSearchParams(parameters);
  query.set("timestamp", Date.now().toString());
  query.set("recvWindow", "5000");
  const signature = createHmac("sha256", secret).update(query.toString()).digest("hex");
  query.set("signature", signature);

  try {
    const response = await fetch(`${API_BASE}${path}?${query.toString()}`, {
      method,
      cache: "no-store",
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    return await readResponse<T>(response);
  } catch (error) {
    if (error instanceof BinanceUsError) throw error;
    throw new BinanceUsError("The exchange response was interrupted. Trading has been paused for review.");
  }
}

export async function getCandles(
  symbol: string,
  interval: string,
  limit = 120,
): Promise<BinanceCandle[]> {
  const payload = await publicGet("/api/v3/klines", {
    symbol,
    interval,
    limit: String(limit),
  });
  if (!Array.isArray(payload)) throw new BinanceUsError("Binance.US returned unexpected market data.");

  return payload.flatMap((row): BinanceCandle[] => {
    if (!Array.isArray(row) || row.length < 7) return [];
    const values = row as unknown[];
    const parsed = {
      openTime: Number(values[0]),
      open: Number(values[1]),
      high: Number(values[2]),
      low: Number(values[3]),
      close: Number(values[4]),
      volume: Number(values[5]),
      closeTime: Number(values[6]),
    };
    return Object.values(parsed).every(Number.isFinite) ? [parsed] : [];
  });
}

export async function getSymbolRules(symbol: string): Promise<BinanceSymbolRules | null> {
  const payload = await publicGet("/api/v3/exchangeInfo", { symbol });
  if (!isRecord(payload) || !Array.isArray(payload.symbols)) return null;
  const found = payload.symbols.find((item) => isRecord(item) && item.symbol === symbol);
  if (!isRecord(found) || !Array.isArray(found.filters)) return null;

  let minNotional = 0;
  let quantityStep = 0;
  for (const filter of found.filters) {
    if (!isRecord(filter)) continue;
    if (filter.filterType === "MIN_NOTIONAL" || filter.filterType === "NOTIONAL") {
      minNotional = Number(filter.minNotional ?? filter.minNotionalValue ?? 0);
    }
    if (filter.filterType === "LOT_SIZE" || filter.filterType === "MARKET_LOT_SIZE") {
      const step = Number(filter.stepSize ?? 0);
      if (Number.isFinite(step) && step > 0) quantityStep = step;
    }
  }

  if (
    typeof found.symbol !== "string" ||
    typeof found.status !== "string" ||
    typeof found.baseAsset !== "string" ||
    typeof found.quoteAsset !== "string"
  ) {
    return null;
  }
  return {
    symbol: found.symbol,
    status: found.status,
    baseAsset: found.baseAsset,
    quoteAsset: found.quoteAsset,
    minNotional,
    quantityStep,
    quoteOrderQtyMarketAllowed: found.quoteOrderQtyMarketAllowed === true,
  };
}

export async function getAccount(): Promise<BinanceAccount> {
  const payload = await signedRequest<unknown>("GET", "/api/v3/account", {});
  if (
    !isRecord(payload) ||
    typeof payload.canTrade !== "boolean" ||
    !Array.isArray(payload.balances)
  ) {
    throw new BinanceUsError("Binance.US returned unexpected account details.");
  }
  const balances = payload.balances.flatMap((entry): BinanceBalance[] => {
    if (!isRecord(entry) || typeof entry.asset !== "string") return [];
    return [{
      asset: entry.asset,
      free: typeof entry.free === "string" ? entry.free : "0",
      locked: typeof entry.locked === "string" ? entry.locked : "0",
    }];
  });
  return { canTrade: payload.canTrade, balances };
}

function parseOrder(payload: unknown): BinanceOrder {
  if (!isRecord(payload)) throw new BinanceUsError("The exchange returned an unreadable order response.");
  const orderId = payload.orderId;
  const clientOrderId = payload.clientOrderId;
  const status = payload.status;
  const executedQty = payload.executedQty;
  const quoteQty = payload.cummulativeQuoteQty;
  if (
    (typeof orderId !== "string" && typeof orderId !== "number") ||
    typeof clientOrderId !== "string" ||
    typeof status !== "string" ||
    typeof executedQty !== "string" ||
    typeof quoteQty !== "string"
  ) {
    throw new BinanceUsError("The exchange returned an incomplete order response. Trading has been paused.");
  }
  const fills = Array.isArray(payload.fills)
    ? payload.fills.flatMap((fill): Array<{ price: string; qty: string }> => {
        if (!isRecord(fill) || typeof fill.price !== "string" || typeof fill.qty !== "string") return [];
        return [{ price: fill.price, qty: fill.qty }];
      })
    : [];
  return { orderId: String(orderId), clientOrderId, status, executedQty, cummulativeQuoteQty: quoteQty, fills };
}

export async function placeMarketOrder(input: {
  symbol: string;
  side: "BUY" | "SELL";
  clientOrderId: string;
  quoteOrderQty?: string;
  quantity?: string;
}): Promise<BinanceOrder> {
  const parameters: Record<string, string> = {
    symbol: input.symbol,
    side: input.side,
    type: "MARKET",
    newClientOrderId: input.clientOrderId,
    newOrderRespType: "FULL",
  };
  if (input.side === "BUY" && input.quoteOrderQty) parameters.quoteOrderQty = input.quoteOrderQty;
  if (input.side === "SELL" && input.quantity) parameters.quantity = input.quantity;
  if (!parameters.quoteOrderQty && !parameters.quantity) {
    throw new BinanceUsError("The order is missing its approved trade amount.");
  }
  return parseOrder(await signedRequest<unknown>("POST", "/api/v3/order", parameters));
}

export async function findOrder(symbol: string, clientOrderId: string): Promise<BinanceOrder | null> {
  try {
    return parseOrder(await signedRequest<unknown>("GET", "/api/v3/order", {
      symbol,
      origClientOrderId: clientOrderId,
    }));
  } catch (error) {
    if (error instanceof BinanceUsError && error.code === -2013) return null;
    throw error;
  }
}

export function makeClientOrderId(botId: string, candleTime: number, side: "BUY" | "SELL"): string {
  const digest = createHash("sha256").update(`${botId}:${candleTime}:${side}`).digest("hex").slice(0, 28);
  return `cl${digest}`;
}
