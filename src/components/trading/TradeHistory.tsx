import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TradeEventView } from "@/types/trading";

interface TradeHistoryProps {
  events: TradeEventView[];
  compact?: boolean;
}

function formatNumber(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(amount)
    : "—";
}

function quoteAsset(symbol: string): string {
  if (symbol.endsWith("USDT")) return "USDT";
  if (symbol.endsWith("USD")) return "USD";
  return "quote";
}

function statusClass(status: string): string {
  if (status === "FILLED") return "bg-[var(--market-up)]/10 text-[var(--market-up)]";
  if (status === "PENDING" || status === "PARTIALLY_FILLED") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

export default function TradeHistory({ events, compact = false }: TradeHistoryProps) {
  const visibleEvents = compact ? events.slice(0, 6) : events;

  if (!visibleEvents.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-5 text-center">
        <p className="text-sm font-medium">No bot orders yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">When a configured signal places a real Binance.US order, its fill and status will appear here.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date · UTC</TableHead>
            <TableHead>Market</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Avg. fill</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Gross P&amp;L</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleEvents.map((event) => {
            const isBuy = event.side === "BUY";
            const pnl = event.realizedPnl === null ? null : Number(event.realizedPnl);
            return (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }).format(new Date(event.createdAt))}
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold">{event.symbol}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 font-medium ${isBuy ? "text-[var(--market-up)]" : "text-[var(--market-down)]"}`}>
                    {isBuy ? <ArrowDownRight aria-hidden="true" size={15} /> : <ArrowUpRight aria-hidden="true" size={15} />}
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                  <span className="mt-0.5 block max-w-48 truncate text-xs text-muted-foreground">{event.signal}</span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatNumber(event.quantity)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatNumber(event.price)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatNumber(event.quoteAmount)} <span className="text-muted-foreground">{quoteAsset(event.symbol)}</span>
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${pnl === null ? "text-muted-foreground" : pnl >= 0 ? "text-[var(--market-up)]" : "text-[var(--market-down)]"}`}>
                  {pnl === null ? "—" : `${pnl >= 0 ? "+" : "−"}${formatNumber(String(Math.abs(pnl)))}`}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(event.status)}`}>
                    {event.status.replaceAll("_", " ")}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
