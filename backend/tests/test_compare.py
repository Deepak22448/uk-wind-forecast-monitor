import pandas as pd

from app.compare import compare


def ts(s):
    return pd.Timestamp(s, tz="UTC")


def test_compare_scores_only_on_the_hour_slots_within_london_day_window():
    actuals = pd.DataFrame({
        "startTime": [ts("2026-01-15T11:30"), ts("2026-01-15T12:00"), ts("2026-01-16T00:00")],
        "generation": [1, 100, 7],
    })
    forecasts = pd.DataFrame({
        "publishTime": [ts("2026-01-14T07:30")], "startTime": [ts("2026-01-15T12:00")], "generation": [120],
    })
    out = compare(actuals, forecasts, pd.Timestamp("2026-01-15"), pd.Timestamp("2026-01-15"))
    assert len(out) == 1  # HH:30 dropped, next London day excluded
    r = out.iloc[0]
    assert r.generation == 100 and r.generation_forecast == 120 and r.horizon_hours == 28.5
