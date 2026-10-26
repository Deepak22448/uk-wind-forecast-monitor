"""Pick, for each target hour, the latest forecast that was available at decision time.

Decision rule: the buyer decides on day D-1 at `cutoff_hour` (London local time) for
delivery day D. Only forecasts with publishTime <= that cutoff may be used, otherwise
we would be scoring a forecast nobody could have acted on (leakage).
"""
import pandas as pd

LONDON = "Europe/London"
DEFAULT_CUTOFF_HOUR = 9  # buyer decides at 09:00 London on D-1 unless told otherwise


def cutoff_for(targets: pd.DatetimeIndex, cutoff_hour: int) -> pd.DatetimeIndex:
    """UTC cutoff instant for each UTC target: (London delivery date - 1 day) at cutoff_hour London time."""
    local = targets.tz_convert(LONDON)
    naive = local.tz_localize(None).normalize() - pd.offsets.Hour(24 - cutoff_hour)
    return naive.tz_localize(LONDON, ambiguous=False, nonexistent="shift_forward").tz_convert("UTC")


def select_forecasts(forecasts: pd.DataFrame, targets: pd.DatetimeIndex, cutoff_hour: int = DEFAULT_CUTOFF_HOUR) -> pd.DataFrame:
    """One row per target: startTime, publishTime, generation_forecast, horizon_hours.

    Targets with no eligible forecast are kept with NaN so callers can count coverage.
    """
    t = pd.DataFrame({"startTime": targets, "cutoff": cutoff_for(targets, cutoff_hour)})
    eligible = (
        t.merge(forecasts, on="startTime", how="left")
        .query("publishTime <= cutoff")
        .sort_values("publishTime")
        .groupby("startTime", as_index=False)
        .last()[["startTime", "publishTime", "generation"]]
        .rename(columns={"generation": "generation_forecast"})
    )
    out = t[["startTime"]].merge(eligible, on="startTime", how="left")
    out["horizon_hours"] = (out["startTime"] - out["publishTime"]).dt.total_seconds() / 3600
    return out
