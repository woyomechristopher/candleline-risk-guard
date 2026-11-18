<!-- OWNER: Build (with the user) · READERS: every agent · READ THIS FIRST -->
# Candleline

**One-liner:** An owner-controlled Binance.US spot-trading dashboard with an automated moving-average strategy and explicit risk limits.

## Goal
Let one account owner configure, monitor, pause, and review a real spot-trading bot without exposing exchange credentials in the app.

## Target users
The owner of this workspace who trades eligible Binance.US spot markets.

## Status
- Stage: building
- Live URL: —
- Repo: —

## What exists today
<!-- Kept current by the Build agent after each build -->
- Owner-only overview, strategy setup, and order history screens.
- Binance.US market data and signed spot-market order integration.
- Moving-average crossover signals, spend-per-buy limit, stop-loss, daily realized-loss stop, and a five-entry daily cap.
- Saved strategy and order history, pending-order recovery, and a visible-session monitor.
- Exchange credentials remain server-side; the app never sends withdrawals or uses leverage.

## Constraints / must-nots
Trading requires the owner’s Binance.US credentials and matching sign-in email. The monitor only checks markets while the Overview remains open; loss limits are not guarantees and displayed realized P&L excludes fees. Never present sample data or investment performance as real.
