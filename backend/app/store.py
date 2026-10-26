"""Load the committed Elexon snapshot once per process."""
import os
from datetime import date
from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.selection import LONDON

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[1] / "data"))


@lru_cache(maxsize=1)
def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    """(actuals, forecasts), both UTC-indexed by startTime columns."""
    return (
        pd.read_parquet(DATA_DIR / "wind_actuals.parquet"),
        pd.read_parquet(DATA_DIR / "wind_forecasts.parquet"),
    )


@lru_cache(maxsize=1)
def bounds() -> tuple[date, date]:
    """First and last London delivery day present in the actuals."""
    days = load()[0]["startTime"].dt.tz_convert(LONDON).dt.date
    return days.min(), days.max()
