"""Build the forecast-vs-actual frame for a window of delivery days.

Alignment (decision A): WINDFOR is hourly, so we score at on-the-hour slots and take the
actual at HH:00 (no averaging with HH:30). Change here if that assumption is revisited.
"""
import pandas as pd

from app.selection import DEFAULT_CUTOFF_HOUR, LONDON, select_forecasts


def compare(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    start: pd.Timestamp,
    end: pd.Timestamp,
    cutoff_hour: int = DEFAULT_CUTOFF_HOUR,
) -> pd.DataFrame:
    """Hourly rows for London delivery dates start..end inclusive (tz-naive dates)."""
    lo = start.tz_localize(LONDON).tz_convert("UTC")
    hi = (end + pd.offsets.Day(1)).tz_localize(LONDON).tz_convert("UTC")
    a = actuals[(actuals.startTime >= lo) & (actuals.startTime < hi) & (actuals.startTime.dt.minute == 0)]
    targets = pd.DatetimeIndex(sorted(a.startTime))
    sel = select_forecasts(forecasts, targets, cutoff_hour)
    return sel.merge(a, on="startTime")
