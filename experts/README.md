# QUANT AI SMC PRO COMPLETE — MT5 Expert Advisor

`QuantAiSmcPro.mq5` is a MetaTrader 5 Expert Advisor that implements the
QUANT AI SMC PRO COMPLETE specification:

- Smart Money Concepts: BOS, CHOCH, Order Blocks, Fair Value Gaps,
  Liquidity Sweeps
- Fibonacci 61.8 / 70.5 / 78.6 discount zone
- Quantitative candle math: range, body strength, buy/sell pressure,
  rejection ratio
- Momentum: `Close[1] - Close[1+N]`
- Z-Score over a rolling MA window
- Composite **AI Score** with the spec's exact point table; entries fire
  on `AI Score ≥ 12`
- Risk-based lot sizing (`Risk / (SL × TickValue)`) with ATR stop
  (`SL = Bid - ATR × 1.5`) and RR-based take profit
- On-chart real-time dashboard + visual signals (arrow, entry/SL/TP lines)
- **Journal push**: every closed position with the EA's magic number is
  POSTed to the Jnayen Trading Journal API (`/api/trades`) the moment it
  closes.

## Install

1. Copy `QuantAiSmcPro.mq5` into your MetaTrader 5 data folder:
   `MQL5\Experts\` (open it from MT5 with *File → Open Data Folder*).
2. Open MetaEditor (F4 in MT5) and compile — there should be no errors.
3. Drag the EA onto a chart of your preferred symbol / timeframe
   (M15 recommended, per spec).

## Required MT5 settings

The EA uses `WebRequest()` to push trades to your journal API. You must
whitelist the journal URL:

- *Tools → Options → Expert Advisors*
- Check **Allow WebRequest for listed URL**
- Add the base URL you set in `InpApiUrl`
  (e.g. `https://journal.example.com`)

Also enable **Allow algorithmic trading** in the EA's settings dialog if
you want live execution.

## Inputs

| Group | Input | Default | Meaning |
|---|---|---|---|
| Risk & Execution | `InpRiskPercent` | `1.0` | Risk per trade (% of equity) |
| | `InpRR` | `2.5` | Reward-to-risk |
| | `InpATRPeriod` | `14` | ATR period |
| | `InpATRMultiplier` | `1.5` | SL = Bid − ATR × this |
| | `InpAIScoreEntry` | `12` | Min AI score to open BUY |
| | `InpMagicNumber` | `20260521` | Identifies this EA's trades |
| | `InpMaxSpreadPoints` | `50` | Skip entry if spread > this |
| Analysis | `InpMAPeriod` | `20` | MA used for Z-Score |
| | `InpZScoreLookback` | `50` | Bars for stdev |
| | `InpMomentumOffset` | `5` | `Close[1] − Close[1+N]` |
| | `InpStructureLookback` | `60` | SMC swing lookback |
| | `InpFractalSize` | `2` | Bars each side of swing |
| Journal Push | `InpPushToJournal` | `true` | Enable journal POST on close |
| | `InpApiUrl` | `https://YOUR_DOMAIN/api` | Base URL (no `/trades`) |
| | `InpApiToken` | *(empty)* | Bearer token from `/settings` |

## How journal push works

1. On `OnTradeTransaction(DEAL_ADD)`, the EA filters for deals tagged
   with its magic number where `DEAL_ENTRY == OUT`.
2. It loads the closed position's full deal history, aggregates
   profit / commission / swap, and reads open/close times and prices.
3. It POSTs a single trade payload to `${InpApiUrl}/trades` with
   `Authorization: Bearer ${InpApiToken}`.
4. The journal's `UNIQUE(user_id, ticket)` constraint deduplicates if
   the same trade is pushed twice (409 response, logged but ignored).

## Limitations (strict to the spec)

This build intentionally excludes future improvements from the spec
("Améliorations Futures") — no Trailing Stop, no Break Even, no
Telegram bridge, no Multi-Timeframe AI, no LSTM, no Monte Carlo. The EA
is BUY-only by design (per the spec's "Conditions d'Entrée" section).

## Recommended markets / TFs

- Symbols: `XAUUSD`, `EURUSD`, `GBPUSD`, `NASDAQ`, `BTCUSD`
- Timeframe: `M15` for entries; structure references higher TFs only
  implicitly through swing detection
