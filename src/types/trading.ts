export type TradingInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface CandlePoint {
  close: number;
  label: string;
  openTime: number;
}

export interface BotSettings {
  enabled: boolean;
  symbol: string;
  interval: TradingInterval;
  fastPeriod: number;
  slowPeriod: number;
  quoteOrderAmount: string;
  maxDailyLoss: string;
  stopLossPercent: string;
  currentPositionQty: string;
  currentPositionCost: string;
  dailyRealizedPnl: string;
  dailyTradeCount: number;
  dailyDayKey: string;
  lastHeartbeatAt: string | null;
  lastError: string | null;
}

export interface TradeEventView {
  id: string;
  symbol: string;
  side: string;
  signal: string;
  status: string;
  price: string;
  quantity: string;
  quoteAmount: string;
  realizedPnl: string | null;
  createdAt: string;
}

export interface BalanceView {
  asset: string;
  free: string;
}

export interface DashboardData {
  bot: BotSettings;
  candles: CandlePoint[];
  pendingOrder: boolean;
  recentTrades: TradeEventView[];
  exchange: {
    credentialsReady: boolean;
    accountReady: boolean;
    canTrade: boolean;
    message: string;
    balances: BalanceView[];
  };
  updatedAt: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}
