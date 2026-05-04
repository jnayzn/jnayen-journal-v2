#!/usr/bin/env python3
"""
Jnayen Trading Journal — MetaTrader 5 → REST API bridge.

Synchronizes closed positions from MetaTrader 5 to the Trading Journal API.

Usage:
    pip install MetaTrader5 requests

    # One-shot sync (last 30 days)
    python tradj_bridge.py \
        --api-url https://YOUR_DOMAIN/api \
        --api-token YOUR_TOKEN \
        --days 30

    # Daemon mode (poll every 15s)
    python tradj_bridge.py \
        --api-url https://YOUR_DOMAIN/api \
        --api-token YOUR_TOKEN \
        --watch --interval 15

    # Dry run (do not POST)
    python tradj_bridge.py ... --dry-run

State is persisted in ~/.tradj_bridge.json so re-runs do not re-import the
same trades. Server enforces UNIQUE(user_id, ticket) so duplicates are
silently skipped on the API side too.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

try:
    import MetaTrader5 as mt5  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - import guard
    mt5 = None  # type: ignore[assignment]

import requests

STATE_PATH = Path.home() / ".tradj_bridge.json"
LOG = logging.getLogger("tradj_bridge")


def load_state() -> Dict[str, Any]:
    if not STATE_PATH.exists():
        return {"highwater": None, "seen_tickets": []}
    try:
        return json.loads(STATE_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        LOG.warning("Could not read state file %s, starting fresh", STATE_PATH)
        return {"highwater": None, "seen_tickets": []}


def save_state(state: Dict[str, Any]) -> None:
    state["seen_tickets"] = list(set(state.get("seen_tickets", [])))[-5000:]
    STATE_PATH.write_text(json.dumps(state, indent=2))


def init_mt5() -> None:
    if mt5 is None:
        raise RuntimeError(
            "MetaTrader5 module is not installed. Run: pip install MetaTrader5"
        )
    if not mt5.initialize():
        raise RuntimeError(f"mt5.initialize() failed: {mt5.last_error()}")


def shutdown_mt5() -> None:
    if mt5 is not None:
        mt5.shutdown()


def fetch_history(since: datetime, until: datetime) -> List[Dict[str, Any]]:
    if mt5 is None:
        return []
    deals = mt5.history_deals_get(since, until)
    if deals is None:
        return []
    # Group "deals" into positions by position_id, take entry/exit pair.
    by_position: Dict[int, List[Any]] = {}
    for d in deals:
        by_position.setdefault(d.position_id, []).append(d)

    trades: List[Dict[str, Any]] = []
    for position_id, items in by_position.items():
        items_sorted = sorted(items, key=lambda x: x.time)
        if len(items_sorted) < 2:
            continue
        entry, exit_ = items_sorted[0], items_sorted[-1]
        side = "BUY" if entry.type == mt5.DEAL_TYPE_BUY else "SELL"
        open_time = datetime.fromtimestamp(entry.time, tz=timezone.utc)
        close_time = datetime.fromtimestamp(exit_.time, tz=timezone.utc)
        profit = sum(getattr(i, "profit", 0.0) for i in items_sorted)
        commission = sum(getattr(i, "commission", 0.0) for i in items_sorted)
        swap = sum(getattr(i, "swap", 0.0) for i in items_sorted)
        trades.append(
            {
                "ticket": str(position_id),
                "symbol": entry.symbol,
                "side": side,
                "volume": float(entry.volume),
                "openPrice": float(entry.price),
                "closePrice": float(exit_.price),
                "openTime": open_time.isoformat(),
                "closeTime": close_time.isoformat(),
                "profit": float(profit),
                "commission": float(commission),
                "swap": float(swap),
                "magicNumber": int(getattr(entry, "magic", 0) or 0),
            }
        )
    return trades


def filter_unseen(
    trades: Iterable[Dict[str, Any]], state: Dict[str, Any]
) -> List[Dict[str, Any]]:
    seen = set(state.get("seen_tickets", []))
    unseen = [t for t in trades if t["ticket"] not in seen]
    return unseen


def push_batch(
    api_url: str,
    api_token: str,
    trades: List[Dict[str, Any]],
    dry_run: bool,
) -> Dict[str, Any]:
    if dry_run:
        LOG.info("[dry-run] would POST %d trades to %s", len(trades), api_url)
        return {"inserted": 0, "skipped": len(trades), "dry_run": True}
    if not trades:
        return {"inserted": 0, "skipped": 0}
    resp = requests.post(
        f"{api_url.rstrip('/')}/trades/import",
        headers={
            "Authorization": f"Token {api_token}",
            "Content-Type": "application/json",
        },
        json=trades,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def sync_once(
    api_url: str,
    api_token: str,
    days: int,
    dry_run: bool,
    advance_state: bool = True,
) -> Dict[str, Any]:
    state = load_state()
    until = datetime.now(timezone.utc)
    if state.get("highwater"):
        since = datetime.fromisoformat(state["highwater"])
    else:
        since = until - timedelta(days=days)
    LOG.info("syncing trades from %s to %s", since.isoformat(), until.isoformat())
    init_mt5()
    try:
        trades = fetch_history(since, until)
    finally:
        shutdown_mt5()
    fresh = filter_unseen(trades, state)
    LOG.info("%d trades fetched (%d new)", len(trades), len(fresh))
    result = push_batch(api_url, api_token, fresh, dry_run)
    if advance_state and not dry_run:
        state["highwater"] = until.isoformat()
        state["seen_tickets"] = list(
            set(state.get("seen_tickets", [])) | {t["ticket"] for t in fresh}
        )
        save_state(state)
    return {**result, "fetched": len(trades), "new": len(fresh)}


def watch(
    api_url: str, api_token: str, interval: int, days: int, dry_run: bool
) -> None:
    LOG.info("watching every %ds (Ctrl-C to stop)", interval)
    while True:
        try:
            res = sync_once(api_url, api_token, days, dry_run, advance_state=not dry_run)
            LOG.info("sync result: %s", res)
        except Exception as exc:  # pylint: disable=broad-except
            LOG.exception("sync failed: %s", exc)
        time.sleep(interval)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument(
        "--api-url",
        default=os.environ.get("TRADJ_API_URL"),
        help="Base URL for the Trading Journal API (e.g. https://x.com/api)",
    )
    parser.add_argument(
        "--api-token",
        default=os.environ.get("TRADJ_API_TOKEN"),
        help="API token (from Settings page in the web app)",
    )
    parser.add_argument(
        "--days", type=int, default=30, help="One-shot lookback window in days"
    )
    parser.add_argument("--watch", action="store_true", help="Daemon mode")
    parser.add_argument(
        "--interval",
        type=int,
        default=15,
        help="Polling interval (seconds) in --watch mode",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Fetch but do not POST or advance state"
    )
    parser.add_argument(
        "--log-level", default="INFO", help="Python logging level (default: INFO)"
    )

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    if not args.api_url or not args.api_token:
        parser.error("--api-url and --api-token are required")

    if args.watch:
        watch(args.api_url, args.api_token, args.interval, args.days, args.dry_run)
        return 0
    res = sync_once(
        args.api_url,
        args.api_token,
        args.days,
        args.dry_run,
        advance_state=not args.dry_run,
    )
    print(json.dumps(res, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
