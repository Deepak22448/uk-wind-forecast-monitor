"""Forecast-accuracy metrics. Pure functions over a comparison frame.

Input columns: startTime (UTC), generation_forecast, generation (actual), horizon_hours.
Error = forecast - actual, so positive error / bias means the forecast over-predicts wind.
"""
import pandas as pd

from app.selection import LONDON

HORIZON_BUCKET_HOURS = 6


def _scored(df: pd.DataFrame) -> pd.DataFrame:
    d = df.dropna(subset=["generation_forecast", "generation"]).copy()
    d["error"] = d["generation_forecast"] - d["generation"]
    d["abs_error"] = d["error"].abs()
    return d


def summary(df: pd.DataFrame) -> dict:
    d = _scored(df)
    out = {"n": len(d), "n_missing": int(df["generation_forecast"].isna().sum())}
    if d.empty:
        return {**out, **dict.fromkeys(["mae", "rmse", "bias", "mape", "p50", "p90", "p95"])}
    nonzero = d[d["generation"] != 0]
    return {
        **out,
        "mae": float(d["abs_error"].mean()),
        "rmse": float((d["error"] ** 2).mean() ** 0.5),
        "bias": float(d["error"].mean()),
        "mape": float((nonzero["abs_error"] / nonzero["generation"]).mean() * 100) if len(nonzero) else None,
        "p50": float(d["abs_error"].quantile(0.50)),
        "p90": float(d["abs_error"].quantile(0.90)),
        "p95": float(d["abs_error"].quantile(0.95)),
    }


def _group(d: pd.DataFrame, key) -> pd.DataFrame:
    return d.groupby(key).agg(n=("error", "size"), mae=("abs_error", "mean"), bias=("error", "mean")).reset_index()


def by_hour_of_day(df: pd.DataFrame) -> pd.DataFrame:
    d = _scored(df)
    d["hour"] = d["startTime"].dt.tz_convert(LONDON).dt.hour
    return _group(d, "hour").sort_values("hour").reset_index(drop=True)


def by_horizon(df: pd.DataFrame) -> pd.DataFrame:
    d = _scored(df).dropna(subset=["horizon_hours"])
    d["horizon_bucket_start"] = (d["horizon_hours"] // HORIZON_BUCKET_HOURS * HORIZON_BUCKET_HOURS).astype(int)
    return _group(d, "horizon_bucket_start").sort_values("horizon_bucket_start").reset_index(drop=True)
