//+------------------------------------------------------------------+
//|                                            QuantAiSmcPro.mq5     |
//|                               Built for jnayen-journal-v2        |
//|                                                                  |
//|   QUANT AI SMC PRO COMPLETE                                      |
//|   Expert Advisor: Smart Money Concepts + Fibonacci +             |
//|   Candle Math + Momentum + Z-Score + Probabilistic AI Score +    |
//|   ATR Risk Management + Real-Time Dashboard + Visual Signals.    |
//|                                                                  |
//|   Every closed position with this magic number is pushed to the  |
//|   Jnayen Trading Journal REST API (POST /api/trades).            |
//+------------------------------------------------------------------+
#property copyright   "Built by jnayzn. Personal use."
#property link        "https://github.com/jnayzn/jnayen-journal-v2"
#property version     "1.00"
#property description "QUANT AI SMC PRO COMPLETE - SMC + Fibonacci + Quant + Journal push"
#property strict

#include <Trade/Trade.mqh>

//==================================================================
//  INPUT PARAMETERS
//==================================================================
input group  "── Risk & Execution ──"
input double   InpRiskPercent       = 1.0;        // Risk per trade (% of equity)
input double   InpRR                = 2.5;        // Reward-to-risk ratio
input int      InpATRPeriod         = 14;         // ATR period
input double   InpATRMultiplier     = 1.5;        // SL = Bid - ATR * this
input int      InpAIScoreEntry      = 12;         // Min AI score to open BUY
input int      InpMagicNumber       = 20260521;   // Magic number tag
input int      InpMaxSpreadPoints   = 50;         // Max spread (points) allowed at entry
input ulong    InpDeviationPoints   = 20;         // Max slippage in points

input group  "── Analysis ──"
input int      InpMAPeriod          = 20;         // MA period (Z-Score baseline)
input int      InpZScoreLookback    = 50;         // Bars for stdev / MA
input int      InpMomentumOffset    = 5;          // Close[1] - Close[1+N]
input int      InpStructureLookback = 60;         // SMC swing lookback
input int      InpFractalSize       = 2;          // Bars each side of swing fractal
input double   InpStrongCandleMin   = 0.70;       // Body/Range threshold
input double   InpBuyPressureMin    = 0.60;       // (Close-Low)/Range threshold
input double   InpZScoreExtreme     = 2.0;        // |Z| > this = extreme

input group  "── Visuals ──"
input bool     InpShowDashboard     = true;       // Draw on-chart dashboard
input bool     InpDrawSignals       = true;       // Draw arrows + entry/SL/TP lines
input color    InpEntryColor        = clrDodgerBlue;
input color    InpSlColor           = clrCrimson;
input color    InpTpColor           = clrLimeGreen;
input color    InpDashFg            = clrWhite;
input color    InpDashBg            = clrBlack;

input group  "── Journal Push ──"
input bool     InpPushToJournal     = true;       // POST closed trades to journal
input string   InpApiUrl            = "https://YOUR_DOMAIN/api"; // Base URL (no trailing slash, no /trades)
input string   InpApiToken          = "";         // Bearer token from /settings page
input int      InpWebTimeoutMs      = 8000;       // WebRequest timeout (ms)

//==================================================================
//  GLOBALS
//==================================================================
CTrade         trade;
int            atrHandle  = INVALID_HANDLE;
int            maHandle   = INVALID_HANDLE;
datetime       lastBarTime = 0;
string         dashPrefix = "QAISMC_DASH_";
string         signalPrefix = "QAISMC_SIG_";
int            digits;
double         pointSize;

// Retry queue for journal pushes that failed (e.g. transient network issues)
ulong          gPendingTickets[];
datetime       gLastRetryAt   = 0;
const int      kMaxRetryQueue = 50;
const int      kRetryEverySec = 30;

//------------------------------------------------------------------+
//  SUPPORT STRUCTS
//------------------------------------------------------------------+
struct CandleStats
{
   double  range;
   double  body;
   double  upperWick;
   double  lowerWick;
   double  strength;       // body / range
   double  buyPressure;    // (close - low) / range
   double  sellPressure;   // (high - close) / range
   double  rejection;      // (max wick) / body
   bool    isBullish;
};

struct FibLevels
{
   double  swingLow;
   double  swingHigh;
   double  fib618;
   double  fib705;
   double  fib786;
   bool    valid;
};

struct SmcFlags
{
   bool  bosBullish;
   bool  bosBearish;
   bool  chochBullish;
   bool  chochBearish;
   bool  liqSweepBullish;
   bool  liqSweepBearish;
   bool  orderBlockBullish;
   bool  orderBlockBearish;
   bool  fvgBullish;
   bool  fvgBearish;
};

struct ScoreBreakdown
{
   int   buyScore;
   int   sellScore;
   double probBuy;
   double probSell;

   bool  bosBull, chochBull, obBull, fvgBull, fibZone;
   bool  strongCandle, buyPressure, momentumUp, zOversold, sweepBull;

   bool  bosBear, chochBear, obBear, fvgBear;
   bool  sellPressure, momentumDown, zOverbought, sweepBear;
};

//==================================================================
//  EVENT HANDLERS
//==================================================================
int OnInit()
{
   if(InpRiskPercent <= 0.0 || InpRR <= 0.0)
   {
      Print("[QAISMC] Invalid risk inputs (RiskPercent or RR <= 0)");
      return(INIT_PARAMETERS_INCORRECT);
   }
   if(InpATRPeriod < 2 || InpMAPeriod < 2 || InpZScoreLookback < InpMAPeriod)
   {
      Print("[QAISMC] Invalid analysis periods");
      return(INIT_PARAMETERS_INCORRECT);
   }

   digits    = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   pointSize = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   atrHandle = iATR(_Symbol, _Period, InpATRPeriod);
   maHandle  = iMA(_Symbol, _Period, InpMAPeriod, 0, MODE_SMA, PRICE_CLOSE);
   if(atrHandle == INVALID_HANDLE || maHandle == INVALID_HANDLE)
   {
      Print("[QAISMC] Failed to create indicator handles");
      return(INIT_FAILED);
   }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(_Symbol);

   if(InpShowDashboard)
      CreateDashboardSkeleton();

   if(InpPushToJournal)
   {
      if(StringLen(InpApiToken) == 0 || StringFind(InpApiUrl, "YOUR_DOMAIN") >= 0)
         Print("[QAISMC] WARN: Journal push enabled but API URL / token look unset");
      Print("[QAISMC] Remember to whitelist ", InpApiUrl,
            " in Tools > Options > Expert Advisors > Allow WebRequest");
   }

   Print("[QAISMC] Initialized on ", _Symbol, " ", EnumToString(_Period),
         " magic=", InpMagicNumber);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(atrHandle != INVALID_HANDLE) IndicatorRelease(atrHandle);
   if(maHandle  != INVALID_HANDLE) IndicatorRelease(maHandle);

   ObjectsDeleteAll(0, dashPrefix);
   ObjectsDeleteAll(0, signalPrefix);
   ChartRedraw(0);
}

void OnTick()
{
   datetime curBarTime = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   bool isNewBar = (curBarTime != lastBarTime);
   if(isNewBar) lastBarTime = curBarTime;

   // Retry any journal pushes that previously failed with a network error.
   if(InpPushToJournal && ArraySize(gPendingTickets) > 0 &&
      (TimeCurrent() - gLastRetryAt) >= kRetryEverySec)
   {
      RetryPendingPushes();
      gLastRetryAt = TimeCurrent();
   }

   // Heavy analysis only on new bar; entry attempt always (uses cached state)
   static bool           firstRun = true;
   static int            cachedScore = 0;
   static ScoreBreakdown cachedBreak;
   static SmcFlags       cachedSmc;
   static FibLevels      cachedFib;
   static double         cachedMomentum = 0.0, cachedZ = 0.0, cachedAtr = 0.0;
   static CandleStats    cachedCandle;
   static bool           cachedFibInZone = false;

   if(isNewBar || firstRun)
   {
      if(!AnalyzeCandle(1, cachedCandle))               return;
      if(!DetectSmc(cachedSmc))                         return;
      if(!CalculateFib(cachedFib, cachedFibInZone))     return;
      if(!CalculateMomentum(cachedMomentum))            return;
      if(!CalculateZScore(cachedZ))                     return;
      if(!ReadATR(cachedAtr))                           return;

      CalculateAIScore(cachedCandle, cachedSmc, cachedFibInZone,
                       cachedMomentum, cachedZ,
                       cachedScore, cachedBreak);

      if(InpShowDashboard)
         UpdateDashboard(cachedScore, cachedBreak, cachedSmc, cachedFib,
                         cachedMomentum, cachedZ, cachedAtr);

      firstRun = false; // only flip after a successful pass
   }

   // Entry pipeline
   if(cachedBreak.buyScore >= InpAIScoreEntry && CountOurPositions() == 0)
   {
      if(SpreadAcceptable())
         TryExecuteBuy(cachedAtr, cachedBreak.buyScore, cachedBreak);
   }
}

//------------------------------------------------------------------+
//  TRADE TRANSACTION → JOURNAL PUSH
//------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest&     request,
                        const MqlTradeResult&      result)
{
   if(!InpPushToJournal) return;
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(trans.deal == 0) return;

   if(!HistoryDealSelect(trans.deal)) return;
   long entryType = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   long magic     = HistoryDealGetInteger(trans.deal, DEAL_MAGIC);
   if(magic != InpMagicNumber) return;
   if(entryType != DEAL_ENTRY_OUT && entryType != DEAL_ENTRY_OUT_BY) return;

   ulong positionId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
   if(positionId == 0) return;

   // Gate push on FULL closure. A partial close also fires DEAL_ENTRY_OUT but
   // leaves the position open with reduced volume — pushing here would lock
   // in partial PnL/closeTime since later attempts would 409 on the journal's
   // UNIQUE(user_id,ticket).
   if(IsPositionStillOpen(positionId)) return;

   if(!PushClosedPositionToJournal(positionId))
      EnqueuePendingPush(positionId);
}

//==================================================================
//  ANALYSIS MODULES
//==================================================================

//---- Candle math: range, body, strength, pressures, rejection ----
bool AnalyzeCandle(int shift, CandleStats &out)
{
   double o = iOpen (_Symbol, _Period, shift);
   double h = iHigh (_Symbol, _Period, shift);
   double l = iLow  (_Symbol, _Period, shift);
   double c = iClose(_Symbol, _Period, shift);
   if(h <= 0.0 || l <= 0.0) return false;

   out.range      = h - l;
   out.body       = MathAbs(c - o);
   out.upperWick  = h - MathMax(o, c);
   out.lowerWick  = MathMin(o, c) - l;
   out.isBullish  = c > o;

   if(out.range <= 0.0)
   {
      out.strength = 0.0;
      out.buyPressure  = 0.0;
      out.sellPressure = 0.0;
   }
   else
   {
      out.strength     = out.body / out.range;
      out.buyPressure  = (c - l) / out.range;
      out.sellPressure = (h - c) / out.range;
   }
   out.rejection = (out.body > 0.0) ? MathMax(out.upperWick, out.lowerWick) / out.body : 0.0;
   return true;
}

//---- Generic fractal swing scan over [from, from+lookback] -------
//     Returns the most recent qualified swing in the window.
bool FindSwingHigh(int from, int lookback, int frac, int &outIdx, double &outPrice)
{
   for(int i = from; i <= from + lookback; ++i)
   {
      bool isSwing = true;
      double hi = iHigh(_Symbol, _Period, i);
      for(int k = 1; k <= frac && isSwing; ++k)
      {
         if(iHigh(_Symbol, _Period, i - k) >= hi) isSwing = false;
         if(iHigh(_Symbol, _Period, i + k) >= hi) isSwing = false;
      }
      if(isSwing) { outIdx = i; outPrice = hi; return true; }
   }
   return false;
}

bool FindSwingLow(int from, int lookback, int frac, int &outIdx, double &outPrice)
{
   for(int i = from; i <= from + lookback; ++i)
   {
      bool isSwing = true;
      double lo = iLow(_Symbol, _Period, i);
      for(int k = 1; k <= frac && isSwing; ++k)
      {
         if(iLow(_Symbol, _Period, i - k) <= lo) isSwing = false;
         if(iLow(_Symbol, _Period, i + k) <= lo) isSwing = false;
      }
      if(isSwing) { outIdx = i; outPrice = lo; return true; }
   }
   return false;
}

//---- SMC detection: BOS / CHOCH / Liquidity Sweep / OB / FVG -----
bool DetectSmc(SmcFlags &f)
{
   ZeroMemory(f);

   int    swH1Idx = 0, swH2Idx = 0, swL1Idx = 0, swL2Idx = 0;
   double swH1 = 0.0, swH2 = 0.0, swL1 = 0.0, swL2 = 0.0;

   if(!FindSwingHigh(InpFractalSize + 1, InpStructureLookback,
                     InpFractalSize, swH1Idx, swH1))     return true;
   if(!FindSwingLow (InpFractalSize + 1, InpStructureLookback,
                     InpFractalSize, swL1Idx, swL1))     return true;
   FindSwingHigh(swH1Idx + 1, InpStructureLookback, InpFractalSize, swH2Idx, swH2);
   FindSwingLow (swL1Idx + 1, InpStructureLookback, InpFractalSize, swL2Idx, swL2);

   double closeLast = iClose(_Symbol, _Period, 1);
   double highLast  = iHigh (_Symbol, _Period, 1);
   double lowLast   = iLow  (_Symbol, _Period, 1);

   //--- BOS: last closed bar closes beyond most recent swing
   f.bosBullish = (swH1 > 0.0 && closeLast > swH1);
   f.bosBearish = (swL1 > 0.0 && closeLast < swL1);

   //--- CHOCH: structure shift. Bullish: lower-low sequence then break
   //    above a prior swing high. Bearish: mirror.
   if(swL2 > 0.0 && swL1 > 0.0 && swH1 > 0.0)
      f.chochBullish = (swL1 < swL2) && (closeLast > swH1);
   if(swH2 > 0.0 && swH1 > 0.0 && swL1 > 0.0)
      f.chochBearish = (swH1 > swH2) && (closeLast < swL1);

   //--- Liquidity sweep: wick pierces swing then closes back
   f.liqSweepBullish = (swL1 > 0.0 && lowLast  < swL1 && closeLast > swL1);
   f.liqSweepBearish = (swH1 > 0.0 && highLast > swH1 && closeLast < swH1);

   //--- Bullish FVG (3-bar): high[3] < low[1]
   double h3 = iHigh(_Symbol, _Period, 3);
   double l1 = iLow (_Symbol, _Period, 1);
   double l3 = iLow (_Symbol, _Period, 3);
   double h1 = iHigh(_Symbol, _Period, 1);
   if(h3 > 0.0 && l1 > 0.0 && h3 < l1)
   {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      f.fvgBullish = (bid >= h3 && bid <= l1);
   }
   if(l3 > 0.0 && h1 > 0.0 && l3 > h1)
   {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      f.fvgBearish = (bid <= l3 && bid >= h1);
   }

   //--- Order block: last opposite-color candle before the impulse that
   //    triggered BOS. Tested for proximity (within 1 ATR-equivalent body).
   if(f.bosBullish)
   {
      for(int i = 2; i <= 10; ++i)
      {
         double oi = iOpen (_Symbol, _Period, i);
         double ci = iClose(_Symbol, _Period, i);
         if(ci < oi) // bearish candle
         {
            double lo = MathMin(oi, ci);
            double hi = MathMax(oi, ci);
            double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            f.orderBlockBullish = (bid >= lo - (hi - lo) && bid <= hi + (hi - lo));
            break;
         }
      }
   }
   if(f.bosBearish)
   {
      for(int i = 2; i <= 10; ++i)
      {
         double oi = iOpen (_Symbol, _Period, i);
         double ci = iClose(_Symbol, _Period, i);
         if(ci > oi)
         {
            double lo = MathMin(oi, ci);
            double hi = MathMax(oi, ci);
            double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            f.orderBlockBearish = (bid >= lo - (hi - lo) && bid <= hi + (hi - lo));
            break;
         }
      }
   }

   return true;
}

//---- Fibonacci 61.8 / 70.5 / 78.6 of last swingLow → swingHigh ---
bool CalculateFib(FibLevels &lev, bool &priceInZone)
{
   ZeroMemory(lev);
   priceInZone = false;

   int hiBar = iHighest(_Symbol, _Period, MODE_HIGH, InpStructureLookback, 1);
   int loBar = iLowest (_Symbol, _Period, MODE_LOW , InpStructureLookback, 1);
   if(hiBar < 0 || loBar < 0) return false;

   double hi = iHigh(_Symbol, _Period, hiBar);
   double lo = iLow (_Symbol, _Period, loBar);
   if(hi <= lo) return true; // no usable up-leg

   lev.swingHigh = hi;
   lev.swingLow  = lo;
   double range = hi - lo;
   lev.fib618 = hi - 0.618 * range;
   lev.fib705 = hi - 0.705 * range;
   lev.fib786 = hi - 0.786 * range;
   lev.valid  = true;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   // "In zone" if price has retraced into the 61.8–78.6 discount block
   priceInZone = (bid <= lev.fib618 && bid >= lev.fib786 && loBar > hiBar);
   return true;
}

//---- Momentum: Close[1] - Close[1+N] -----------------------------
bool CalculateMomentum(double &m)
{
   double c1 = iClose(_Symbol, _Period, 1);
   double cN = iClose(_Symbol, _Period, 1 + InpMomentumOffset);
   if(c1 <= 0.0 || cN <= 0.0) return false;
   m = c1 - cN;
   return true;
}

//---- Z-Score: (price - MA) / stdev -------------------------------
bool CalculateZScore(double &z)
{
   double maBuf[];
   ArraySetAsSeries(maBuf, true);
   if(CopyBuffer(maHandle, 0, 0, InpZScoreLookback + 2, maBuf) <= 0) return false;

   double closes[];
   ArraySetAsSeries(closes, true);
   if(CopyClose(_Symbol, _Period, 0, InpZScoreLookback + 2, closes) <= 0) return false;

   double price = closes[1];
   double ma    = maBuf[1];

   double sum = 0.0;
   for(int i = 1; i <= InpZScoreLookback; ++i)
      sum += (closes[i] - ma) * (closes[i] - ma);
   double variance = sum / (double)InpZScoreLookback;
   double stdev    = MathSqrt(variance);
   if(stdev <= 0.0) { z = 0.0; return true; }

   z = (price - ma) / stdev;
   return true;
}

bool ReadATR(double &atr)
{
   double buf[];
   ArraySetAsSeries(buf, true);
   if(CopyBuffer(atrHandle, 0, 0, 2, buf) <= 0) return false;
   atr = buf[1];
   return (atr > 0.0);
}

//==================================================================
//  AI SCORE
//==================================================================
void CalculateAIScore(const CandleStats &candle,
                     const SmcFlags    &smc,
                     bool               fibInZone,
                     double             momentum,
                     double             zScore,
                     int               &totalScore,
                     ScoreBreakdown    &b)
{
   ZeroMemory(b);

   b.bosBull       = smc.bosBullish;
   b.chochBull     = smc.chochBullish;
   b.obBull        = smc.orderBlockBullish;
   b.fvgBull       = smc.fvgBullish;
   b.fibZone       = fibInZone;
   b.strongCandle  = candle.strength >= InpStrongCandleMin;
   b.buyPressure   = candle.buyPressure >= InpBuyPressureMin;
   b.momentumUp    = momentum > 0.0;
   b.zOversold     = zScore <= -InpZScoreExtreme;
   b.sweepBull     = smc.liqSweepBullish;

   int s = 0;
   if(b.bosBull)      s += 2;
   if(b.chochBull)    s += 2;
   if(b.obBull)       s += 2;
   if(b.fvgBull)      s += 2;
   if(b.fibZone)      s += 2;
   if(b.strongCandle) s += 1;
   if(b.buyPressure)  s += 1;
   if(b.momentumUp)   s += 1;
   if(b.zOversold)    s += 2;
   if(b.sweepBull)    s += 2;
   b.buyScore = s;

   //--- Sell mirror (dashboard only)
   b.bosBear       = smc.bosBearish;
   b.chochBear     = smc.chochBearish;
   b.obBear        = smc.orderBlockBearish;
   b.fvgBear       = smc.fvgBearish;
   b.sellPressure  = candle.sellPressure >= InpBuyPressureMin;
   b.momentumDown  = momentum < 0.0;
   b.zOverbought   = zScore >= InpZScoreExtreme;
   b.sweepBear     = smc.liqSweepBearish;

   int ss = 0;
   if(b.bosBear)        ss += 2;
   if(b.chochBear)      ss += 2;
   if(b.obBear)         ss += 2;
   if(b.fvgBear)        ss += 2;
   if(b.fibZone)        ss += 2;          // discount zone counts for SELL too in spec
   if(b.strongCandle)   ss += 1;
   if(b.sellPressure)   ss += 1;
   if(b.momentumDown)   ss += 1;
   if(b.zOverbought)    ss += 2;
   if(b.sweepBear)      ss += 2;
   b.sellScore = ss;

   const double maxScore = 17.0;
   b.probBuy  = 100.0 * (double)b.buyScore  / maxScore;
   b.probSell = 100.0 * (double)b.sellScore / maxScore;
   totalScore = b.buyScore;
}

//==================================================================
//  RISK MANAGEMENT
//==================================================================
double CalculateLot(double slDistancePrice)
{
   if(slDistancePrice <= 0.0) return 0.0;

   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskMoney  = equity * InpRiskPercent / 100.0;
   double tickValue  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize   = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickValue <= 0.0 || tickSize <= 0.0) return 0.0;

   double moneyPerLot = (slDistancePrice / tickSize) * tickValue;
   if(moneyPerLot <= 0.0) return 0.0;

   double lot = riskMoney / moneyPerLot;

   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double stepLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(stepLot > 0.0) lot = MathFloor(lot / stepLot) * stepLot;
   lot = MathMax(minLot, MathMin(maxLot, lot));
   return NormalizeDouble(lot, 2);
}

//==================================================================
//  EXECUTION
//==================================================================
bool SpreadAcceptable()
{
   long spreadPoints = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   return (spreadPoints > 0 && spreadPoints <= (long)InpMaxSpreadPoints);
}

int CountOurPositions()
{
   int count = 0;
   int total = PositionsTotal();
   for(int i = 0; i < total; ++i)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) == InpMagicNumber &&
         PositionGetString(POSITION_SYMBOL) == _Symbol)
         ++count;
   }
   return count;
}

bool TryExecuteBuy(double atr, int aiScore, const ScoreBreakdown &b)
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(ask <= 0.0 || bid <= 0.0 || atr <= 0.0) return false;

   double sl = NormalizeDouble(bid - atr * InpATRMultiplier, digits);
   if(sl >= ask) return false;
   double slDistance = ask - sl;
   double tp = NormalizeDouble(ask + slDistance * InpRR, digits);

   double lot = CalculateLot(slDistance);
   if(lot <= 0.0)
   {
      Print("[QAISMC] Lot=0, skipping entry");
      return false;
   }

   long stopLevel = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double minDist = stopLevel * pointSize;
   if((ask - sl) < minDist || (tp - ask) < minDist)
   {
      Print("[QAISMC] SL/TP closer than stop level (", stopLevel, " pts), skip");
      return false;
   }

   string comment = StringFormat("QAISMC AIS=%d", aiScore);
   bool ok = trade.Buy(lot, _Symbol, ask, sl, tp, comment);
   if(!ok)
   {
      Print("[QAISMC] Buy failed: retcode=", trade.ResultRetcode(),
            " desc=", trade.ResultRetcodeDescription());
      return false;
   }

   if(InpDrawSignals)
      DrawSignal(ask, sl, tp, (datetime)TimeCurrent());

   Print("[QAISMC] BUY ", lot, " @", DoubleToString(ask, digits),
         " SL=", DoubleToString(sl, digits),
         " TP=", DoubleToString(tp, digits),
         " AIScore=", aiScore,
         " ProbBuy=", DoubleToString(b.probBuy, 1), "%");
   return true;
}

//==================================================================
//  VISUAL SIGNALS
//==================================================================
void DrawSignal(double entry, double sl, double tp, datetime t)
{
   string arrowName = signalPrefix + "ARROW_" + IntegerToString((long)t);
   string entryName = signalPrefix + "ENTRY_" + IntegerToString((long)t);
   string slName    = signalPrefix + "SL_"    + IntegerToString((long)t);
   string tpName    = signalPrefix + "TP_"    + IntegerToString((long)t);

   if(ObjectCreate(0, arrowName, OBJ_ARROW_UP, 0, t, entry))
   {
      ObjectSetInteger(0, arrowName, OBJPROP_COLOR, InpEntryColor);
      ObjectSetInteger(0, arrowName, OBJPROP_WIDTH, 2);
   }

   datetime t2 = t + PeriodSeconds(_Period) * 30;

   if(ObjectCreate(0, entryName, OBJ_TREND, 0, t, entry, t2, entry))
   {
      ObjectSetInteger(0, entryName, OBJPROP_COLOR, InpEntryColor);
      ObjectSetInteger(0, entryName, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetInteger(0, entryName, OBJPROP_RAY_RIGHT, false);
   }
   if(ObjectCreate(0, slName, OBJ_TREND, 0, t, sl, t2, sl))
   {
      ObjectSetInteger(0, slName, OBJPROP_COLOR, InpSlColor);
      ObjectSetInteger(0, slName, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, slName, OBJPROP_RAY_RIGHT, false);
   }
   if(ObjectCreate(0, tpName, OBJ_TREND, 0, t, tp, t2, tp))
   {
      ObjectSetInteger(0, tpName, OBJPROP_COLOR, InpTpColor);
      ObjectSetInteger(0, tpName, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, tpName, OBJPROP_RAY_RIGHT, false);
   }
   ChartRedraw(0);
}

//==================================================================
//  DASHBOARD
//==================================================================
void CreateDashboardSkeleton()
{
   string bg = dashPrefix + "BG";
   if(ObjectFind(0, bg) < 0)
   {
      ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, 20);
      ObjectSetInteger(0, bg, OBJPROP_XSIZE, 280);
      ObjectSetInteger(0, bg, OBJPROP_YSIZE, 420);
      ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, InpDashBg);
      ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, bg, OBJPROP_COLOR, clrDarkSlateGray);
      ObjectSetInteger(0, bg, OBJPROP_BACK, true);
      ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
   }
}

void SetDashLine(int row, const string &text, color clr)
{
   string name = dashPrefix + "L" + IntegerToString(row);
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 20);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 9);
      ObjectSetString (0, name, OBJPROP_FONT, "Consolas");
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   }
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 30 + row * 18);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetString (0, name, OBJPROP_TEXT, text);
}

string YesNo(bool v) { return v ? "Y" : "N"; }
color  Flag(bool v)  { return v ? clrLimeGreen : clrSilver; }

void UpdateDashboard(int aiScore,
                     const ScoreBreakdown &b,
                     const SmcFlags &smc,
                     const FibLevels &fib,
                     double momentum,
                     double zScore,
                     double atr)
{
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   string trend = (aiScore >= InpAIScoreEntry) ? "BUY"
                : (b.sellScore >= InpAIScoreEntry) ? "SELL" : "NEUTRAL";
   color trendColor = (trend == "BUY")  ? clrLimeGreen
                    : (trend == "SELL") ? clrRed : clrSilver;

   int row = 0;
   SetDashLine(row++, "QUANT AI SMC PRO COMPLETE",        clrGold);
   SetDashLine(row++, "Symbol  : " + _Symbol,             InpDashFg);
   SetDashLine(row++, "Trend   : " + trend,               trendColor);
   SetDashLine(row++, StringFormat("AI Score: %d / 17", aiScore), InpDashFg);
   SetDashLine(row++, StringFormat("ProbBUY : %5.1f %%", b.probBuy),  clrLimeGreen);
   SetDashLine(row++, StringFormat("ProbSELL: %5.1f %%", b.probSell), clrTomato);
   SetDashLine(row++, StringFormat("Momentum: %.*f", digits, momentum),
                                                          (momentum >= 0 ? clrLimeGreen : clrTomato));
   SetDashLine(row++, StringFormat("Z-Score : %.2f", zScore),
                                                          (MathAbs(zScore) >= InpZScoreExtreme ? clrGold : InpDashFg));
   SetDashLine(row++, StringFormat("ATR(%d) : %.*f", InpATRPeriod, digits, atr), InpDashFg);

   if(fib.valid)
   {
      SetDashLine(row++, StringFormat("Fib61.8 : %.*f", digits, fib.fib618), InpDashFg);
      SetDashLine(row++, StringFormat("Fib70.5 : %.*f", digits, fib.fib705), InpDashFg);
      SetDashLine(row++, StringFormat("Fib78.6 : %.*f", digits, fib.fib786), InpDashFg);
   }
   else
   {
      SetDashLine(row++, "Fib     : n/a", InpDashFg);
      SetDashLine(row++, "", InpDashFg);
      SetDashLine(row++, "", InpDashFg);
   }

   //--- Hypothetical entry plan (BUY)
   double slPlan = NormalizeDouble(bid - atr * InpATRMultiplier, digits);
   double tpPlan = NormalizeDouble(bid + (bid - slPlan) * InpRR, digits);
   SetDashLine(row++, StringFormat("Entry   : %.*f", digits, bid),    InpEntryColor);
   SetDashLine(row++, StringFormat("StopLoss: %.*f", digits, slPlan), InpSlColor);
   SetDashLine(row++, StringFormat("TakePft : %.*f", digits, tpPlan), InpTpColor);

   SetDashLine(row++, "BOS     : "       + YesNo(b.bosBull)     + " / " + YesNo(b.bosBear),     Flag(b.bosBull || b.bosBear));
   SetDashLine(row++, "CHOCH   : "       + YesNo(b.chochBull)   + " / " + YesNo(b.chochBear),   Flag(b.chochBull || b.chochBear));
   SetDashLine(row++, "FVG     : "       + YesNo(b.fvgBull)     + " / " + YesNo(b.fvgBear),     Flag(b.fvgBull || b.fvgBear));
   SetDashLine(row++, "OrderBlk: "       + YesNo(b.obBull)      + " / " + YesNo(b.obBear),      Flag(b.obBull || b.obBear));
   SetDashLine(row++, "LiqSweep: "       + YesNo(b.sweepBull)   + " / " + YesNo(b.sweepBear),   Flag(b.sweepBull || b.sweepBear));

   ChartRedraw(0);
}

//==================================================================
//  JOURNAL PUSH
//==================================================================

//---- Convert broker datetime → ISO 8601 UTC (best-effort).
//     Uses current broker↔GMT offset; for trades pushed at close
//     (which this EA always does), drift across DST is negligible.
string BrokerEpochToIsoUtc(datetime brokerTime)
{
   int offset = (int)(TimeTradeServer() - TimeGMT());
   datetime utc = (datetime)((long)brokerTime - offset);
   MqlDateTime dt;
   TimeToStruct(utc, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       dt.year, dt.mon, dt.day,
                       dt.hour, dt.min, dt.sec);
}

string JsonEscape(string s)
{
   string r = "";
   int n = StringLen(s);
   for(int i = 0; i < n; ++i)
   {
      ushort ch = StringGetCharacter(s, i);
      if(ch == '"' || ch == '\\')
      {
         r += "\\";
         r += ShortToString(ch);
      }
      else if(ch == '\n') r += "\\n";
      else if(ch == '\r') r += "\\r";
      else if(ch == '\t') r += "\\t";
      else if(ch < 0x20) r += StringFormat("\\u%04x", ch);
      else r += ShortToString(ch);
   }
   return r;
}

//---- Returns true on definitive success or duplicate (do not retry).
//     Returns false only on transient errors (queue for retry).
bool PushClosedPositionToJournal(ulong positionId)
{
   if(!HistorySelectByPosition(positionId)) return true; // nothing to push
   int dealsTotal = HistoryDealsTotal();
   if(dealsTotal < 2) return true;

   //--- Aggregates across ALL entry and exit fills (handles split fills /
   //    scale-ins / partial closes correctly).
   double entryVolumeSum   = 0.0;
   double entryPxVolumeSum = 0.0; // sum(price_i * volume_i) for weighted avg
   double exitVolumeSum    = 0.0;
   double exitPxVolumeSum  = 0.0;
   double profit     = 0.0;
   double commission = 0.0;
   double swap       = 0.0;
   datetime openT  = 0;
   datetime closeT = 0;
   string symbol = "";
   string side   = "";
   string entryComment = "";

   for(int i = 0; i < dealsTotal; ++i)
   {
      ulong dt = HistoryDealGetTicket(i);
      if(dt == 0) continue;
      datetime dtime = (datetime)HistoryDealGetInteger(dt, DEAL_TIME);
      long     entry = HistoryDealGetInteger(dt, DEAL_ENTRY);
      long     dtype = HistoryDealGetInteger(dt, DEAL_TYPE);
      double   dprice= HistoryDealGetDouble (dt, DEAL_PRICE);
      double   dvol  = HistoryDealGetDouble (dt, DEAL_VOLUME);
      string   dsym  = HistoryDealGetString (dt, DEAL_SYMBOL);

      profit     += HistoryDealGetDouble(dt, DEAL_PROFIT);
      commission += HistoryDealGetDouble(dt, DEAL_COMMISSION);
      swap       += HistoryDealGetDouble(dt, DEAL_SWAP);

      if(entry == DEAL_ENTRY_IN)
      {
         entryVolumeSum   += dvol;
         entryPxVolumeSum += dprice * dvol;
         if(openT == 0 || dtime < openT) openT = dtime;
         if(symbol == "")
         {
            symbol       = dsym;
            side         = (dtype == DEAL_TYPE_BUY) ? "BUY" : "SELL";
            entryComment = HistoryDealGetString(dt, DEAL_COMMENT);
         }
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
      {
         exitVolumeSum   += dvol;
         exitPxVolumeSum += dprice * dvol;
         if(dtime > closeT) closeT = dtime;
      }
   }

   if(entryVolumeSum <= 0.0 || exitVolumeSum <= 0.0) return true;
   if(symbol == "" || side == "") return true;

   double openPrice  = entryPxVolumeSum / entryVolumeSum;
   double closePrice = exitPxVolumeSum  / exitVolumeSum;

   string notes = (StringLen(entryComment) > 0) ? entryComment : "QAISMC";

   string body = "{";
   body += "\"ticket\":\""     + IntegerToString((long)positionId) + "\",";
   body += "\"symbol\":\""     + JsonEscape(symbol) + "\",";
   body += "\"side\":\""       + side + "\",";
   body += "\"volume\":"        + DoubleToString(entryVolumeSum, 2) + ",";
   body += "\"openPrice\":"     + DoubleToString(openPrice, digits) + ",";
   body += "\"closePrice\":"    + DoubleToString(closePrice, digits)+ ",";
   body += "\"openTime\":\""    + BrokerEpochToIsoUtc(openT)  + "\",";
   body += "\"closeTime\":\""   + BrokerEpochToIsoUtc(closeT) + "\",";
   body += "\"profit\":"        + DoubleToString(profit, 2)     + ",";
   body += "\"commission\":"    + DoubleToString(commission, 2) + ",";
   body += "\"swap\":"          + DoubleToString(swap, 2)       + ",";
   body += "\"magicNumber\":"   + IntegerToString(InpMagicNumber)+ ",";
   body += "\"notes\":\""       + JsonEscape(notes)             + "\"";
   body += "}";

   return SendTradeToJournal(body, positionId);
}

//---- Returns true if the trade was accepted (201) or already known (409),
//     so the caller should NOT retry. Returns false only for transient
//     network failures (WebRequest -1) that warrant a retry.
bool SendTradeToJournal(const string &body, ulong positionId)
{
   string url = InpApiUrl;
   if(StringLen(url) == 0) return true; // misconfigured — don't loop
   if(StringSubstr(url, StringLen(url) - 1, 1) == "/")
      url = StringSubstr(url, 0, StringLen(url) - 1);
   url += "/trades";

   string headers = "Content-Type: application/json\r\n";
   headers += "Authorization: Bearer " + InpApiToken + "\r\n";

   char data[]; StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   if(ArraySize(data) > 0 && data[ArraySize(data) - 1] == 0)
      ArrayResize(data, ArraySize(data) - 1); // strip trailing NUL

   char result[];
   string resultHeaders;

   ResetLastError();
   int code = WebRequest("POST", url, headers, InpWebTimeoutMs,
                         data, result, resultHeaders);

   if(code == -1)
   {
      int err = GetLastError();
      Print("[QAISMC] WebRequest failed err=", err,
            " ticket=", positionId,
            " (add ", InpApiUrl,
            " to Tools > Options > Expert Advisors > Allow WebRequest)");
      return false; // transient — caller should retry
   }

   string resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code == 201)
   {
      Print("[QAISMC] Journal: pushed ticket=", positionId);
      return true;
   }
   if(code == 409)
   {
      Print("[QAISMC] Journal: duplicate ticket=", positionId, " (ok)");
      return true;
   }
   // 4xx (other) / 5xx: server rejected. Retrying with same body won't help.
   Print("[QAISMC] Journal HTTP ", code, " ticket=", positionId,
         " body=", resp);
   return true;
}

//==================================================================
//  POSITION STATE + RETRY QUEUE HELPERS
//==================================================================
bool IsPositionStillOpen(ulong positionId)
{
   int total = PositionsTotal();
   for(int i = 0; i < total; ++i)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if((ulong)PositionGetInteger(POSITION_IDENTIFIER) == positionId) return true;
   }
   return false;
}

void EnqueuePendingPush(ulong positionId)
{
   int n = ArraySize(gPendingTickets);
   //--- dedup: avoid stacking the same ticket twice
   for(int i = 0; i < n; ++i)
      if(gPendingTickets[i] == positionId) return;

   if(n >= kMaxRetryQueue)
   {
      Print("[QAISMC] Retry queue full (", kMaxRetryQueue,
            "), dropping oldest pending ticket=", gPendingTickets[0]);
      //--- shift left by one
      for(int j = 0; j < n - 1; ++j) gPendingTickets[j] = gPendingTickets[j+1];
      n--;
      ArrayResize(gPendingTickets, n);
   }
   ArrayResize(gPendingTickets, n + 1);
   gPendingTickets[n] = positionId;
   Print("[QAISMC] Queued ticket=", positionId, " for retry (queue=", n + 1, ")");
}

void RetryPendingPushes()
{
   int n = ArraySize(gPendingTickets);
   if(n == 0) return;

   //--- Process only ONE ticket per retry cycle so OnTick is never blocked
   //    by a chain of WebRequest timeouts. With kRetryEverySec=30, each
   //    queued ticket gets a fresh attempt at least every 30s * queueDepth.
   //    LIFO so most recent trades clear first when connectivity returns.
   ulong pid = gPendingTickets[n - 1];
   bool ok = PushClosedPositionToJournal(pid);
   if(ok)
      ArrayResize(gPendingTickets, n - 1);
}

//+------------------------------------------------------------------+
//  END
//+------------------------------------------------------------------+
