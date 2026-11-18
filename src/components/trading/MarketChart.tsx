"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CandlePoint } from "@/types/trading";

interface MarketChartProps {
  candles: CandlePoint[];
  interval: string;
  symbol: string;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

export default function MarketChart({ candles, interval, symbol }: MarketChartProps) {
  const latest = candles.at(-1);
  const first = candles[0];
  const change = latest && first && first.close !== 0
    ? ((latest.close - first.close) / first.close) * 100
    : null;
  const positive = change === null || change >= 0;

  return (
    <figure aria-label={`${symbol || "Market"} price chart`} className="min-w-0">
      {candles.length > 1 ? (
        <>
          <figcaption className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Latest completed candle</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums">
                {latest ? formatPrice(latest.close) : "—"}
              </p>
            </div>
            <p className={`font-mono text-sm tabular-nums ${positive ? "text-[var(--market-up)]" : "text-[var(--market-down)]"}`}>
              {change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
              <span className="ml-2 text-xs text-muted-foreground">last {candles.length} candles · {interval}</span>
            </p>
          </figcaption>
          <div className="h-[250px] w-full sm:h-[310px]" role="img" aria-label={`Price movement for ${symbol} over ${candles.length} completed ${interval} candles`}>
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={candles} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  minTickGap={35}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  domain={["dataMin", "dataMax"]}
                  orientation="right"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number) => formatPrice(value)}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatPrice(Number(value)), "Close"]}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                />
                <Area
                  dataKey="close"
                  fill="var(--chart-1)"
                  fillOpacity={0.08}
                  isAnimationActive={false}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">
            {latest && first ? `Price moved from ${formatPrice(first.close)} to ${formatPrice(latest.close)} over the displayed candles.` : ""}
          </p>
        </>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-6 text-center sm:h-[310px]">
          <p className="text-sm font-medium">Market chart will appear here</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {symbol ? "Waiting for completed Binance.US candles." : "Choose a market in Strategy to see its live price history."}
          </p>
        </div>
      )}
    </figure>
  );
}
