/**
 * The app's database schema.
 *
 * ADD YOUR TABLES AT THE BOTTOM. The four tables above the marker belong to the
 * authentication library: it reads and writes them itself, their column names are
 * part of its contract, and renaming or "tidying" one breaks sign-in in a way that
 * type-checks perfectly and only fails at runtime. Leave them exactly as they are.
 *
 * Anything that belongs to a person gets a `userId` column referencing
 * `user.id` with `onDelete: "cascade"`. That single choice is what makes "delete
 * my account" actually delete someone's data instead of orphaning it — which is
 * a legal obligation, not a nicety.
 *
 * After any change here run `npm run db:push` once to apply it.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Authentication (managed by the auth library — do not modify) ─────────────

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_email_idx").on(t.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("session_token_idx").on(t.token),
    index("session_user_idx").on(t.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

// ─── Your tables go below this line ───────────────────────────────────────────

export const tradingBot = pgTable(
  "trading_bot",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    symbol: text("symbol").notNull().default(""),
    interval: text("interval").notNull().default("15m"),
    fastPeriod: integer("fast_period").notNull().default(9),
    slowPeriod: integer("slow_period").notNull().default(21),
    quoteOrderAmount: text("quote_order_amount").notNull().default(""),
    maxDailyLoss: text("max_daily_loss").notNull().default(""),
    stopLossPercent: text("stop_loss_percent").notNull().default(""),
    currentPositionQty: text("current_position_qty").notNull().default("0"),
    currentPositionCost: text("current_position_cost").notNull().default("0"),
    dailyRealizedPnl: text("daily_realized_pnl").notNull().default("0"),
    dailyTradeCount: integer("daily_trade_count").notNull().default(0),
    dailyDayKey: text("daily_day_key").notNull().default(""),
    lastProcessedCandle: text("last_processed_candle"),
    lastHeartbeatAt: timestamp("last_heartbeat_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trading_bot_user_idx").on(t.userId),
    index("trading_bot_enabled_idx").on(t.enabled),
  ],
);

export const tradeEvent = pgTable(
  "trade_event",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => tradingBot.id, { onDelete: "cascade" }),
    clientOrderId: text("client_order_id").notNull(),
    exchangeOrderId: text("exchange_order_id"),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    signal: text("signal").notNull(),
    status: text("status").notNull(),
    price: text("price").notNull().default("0"),
    quantity: text("quantity").notNull().default("0"),
    quoteAmount: text("quote_amount").notNull().default("0"),
    realizedPnl: text("realized_pnl"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trade_event_client_order_idx").on(t.clientOrderId),
    index("trade_event_user_created_idx").on(t.userId, t.createdAt),
    index("trade_event_bot_created_idx").on(t.botId, t.createdAt),
  ],
);
