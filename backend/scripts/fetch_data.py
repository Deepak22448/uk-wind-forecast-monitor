"""Download the January 2026 snapshot of Elexon wind data into backend/data/*.parquet.

Scope: decisions are made on day D (Jan 1..31 2026) for delivery day D+1, so we need
forecasts published 2025-12-31..2026-01-31 and actuals for delivery days 2026-01-02..2026-02-01.

Run: python scripts/fetch_data.py
"""
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CHUNK_DAYS = 3  # keep each request small; stream endpoints cap the window


def _get(dataset: str, params: dict) -> list[dict]:
    r = requests.get(f"{BASE}/{dataset}/stream", params=params, timeout=120)
    r.raise_for_status()
    return r.json()


def _daterange(start: date, end: date, step: int):
    d = start
    while d <= end:
        yield d, min(d + timedelta(days=step - 1), end)
        d += timedelta(days=step)


def fetch_actuals(start: date, end: date) -> pd.DataFrame:
    rows: list[dict] = []
    for a, b in _daterange(start, end, CHUNK_DAYS):
        rows += _get("FUELHH", {"settlementDateFrom": a.isoformat(),
                                "settlementDateTo": b.isoformat(), "fuelType": "WIND"})
    df = pd.DataFrame(rows)[["startTime", "generation"]]
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    return df.drop_duplicates("startTime").sort_values("startTime").reset_index(drop=True)


def fetch_forecasts(start: date, end: date) -> pd.DataFrame:
    rows: list[dict] = []
    for a, b in _daterange(start, end, CHUNK_DAYS):
        rows += _get("WINDFOR", {"publishDateTimeFrom": f"{a.isoformat()}T00:00:00Z",
                                 "publishDateTimeTo": f"{(b + timedelta(days=1)).isoformat()}T00:00:00Z"})
    df = pd.DataFrame(rows)[["publishTime", "startTime", "generation"]]
    for c in ("publishTime", "startTime"):
        df[c] = pd.to_datetime(df[c], utc=True)
    return (df.drop_duplicates(["publishTime", "startTime"])
              .sort_values(["startTime", "publishTime"]).reset_index(drop=True))


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    actuals = fetch_actuals(date(2026, 1, 2), date(2026, 2, 1))
    forecasts = fetch_forecasts(date(2025, 12, 31), date(2026, 1, 31))
    actuals.to_parquet(DATA_DIR / "wind_actuals.parquet", index=False)
    forecasts.to_parquet(DATA_DIR / "wind_forecasts.parquet", index=False)
    print(f"actuals:   {len(actuals):>6} rows  {actuals.startTime.min()} -> {actuals.startTime.max()}")
    print(f"forecasts: {len(forecasts):>6} rows  {forecasts.publishTime.min()} -> {forecasts.publishTime.max()}")


if __name__ == "__main__":
    main()
