import math

import pandas as pd

from app.metrics import by_hour_of_day, by_horizon, summary


def df(rows):
    """rows: (startTime_utc, forecast, actual, horizon_hours)"""
    return pd.DataFrame(
        [(pd.Timestamp(t, tz="UTC"), f, a, h) for t, f, a, h in rows],
        columns=["startTime", "generation_forecast", "generation", "horizon_hours"],
    )


BASE = df([
    ("2026-01-02T00:00", 110, 100, 16.5),  # +10
    ("2026-01-02T01:00", 90, 100, 17.5),   # -10
    ("2026-01-02T02:00", 130, 100, 18.5),  # +30
    ("2026-01-02T03:00", 100, 100, 19.5),  # 0
])


def test_summary_basic():
    s = summary(BASE)
    assert s["n"] == 4 and s["n_missing"] == 0
    assert s["mae"] == 12.5
    assert s["bias"] == 7.5  # positive = forecast over-predicts
    assert math.isclose(s["rmse"], math.sqrt((100 + 100 + 900 + 0) / 4))


def test_summary_percentiles_of_absolute_error():
    s = summary(BASE)
    assert s["p50"] == 10.0  # abs errors 0,10,10,30 -> median 10
    assert s["p95"] > s["p90"] > s["p50"]


def test_summary_counts_missing_forecasts_and_excludes_from_metrics():
    d = pd.concat([BASE, df([("2026-01-02T04:00", None, 100, None)])], ignore_index=True)
    s = summary(d)
    assert s["n"] == 4 and s["n_missing"] == 1 and s["mae"] == 12.5


def test_summary_mape_ignores_zero_actuals():
    d = df([("2026-01-02T00:00", 10, 0, 16.5), ("2026-01-02T01:00", 110, 100, 17.5)])
    assert math.isclose(summary(d)["mape"], 10.0)  # only the second row counts


def test_summary_empty_returns_nones_not_crash():
    s = summary(df([]))
    assert s["n"] == 0 and s["mae"] is None and s["bias"] is None


def test_by_hour_of_day_uses_london_time():
    # 23:00 UTC in July is 00:00 BST -> hour 0
    d = df([("2026-07-01T23:00", 110, 100, 20.0)])
    out = by_hour_of_day(d)
    assert out.iloc[0]["hour"] == 0 and out.iloc[0]["mae"] == 10


def test_by_hour_of_day_groups_and_sorts():
    out = by_hour_of_day(BASE)
    assert out["hour"].tolist() == [0, 1, 2, 3]
    assert out.set_index("hour").loc[2, "bias"] == 30


def test_by_horizon_buckets_of_six_hours():
    d = df([
        ("2026-01-02T00:00", 110, 100, 16.5),  # bucket 12
        ("2026-01-02T01:00", 120, 100, 17.9),  # bucket 12
        ("2026-01-02T08:00", 150, 100, 24.0),  # bucket 24
    ])
    out = by_horizon(d).set_index("horizon_bucket_start")
    assert out.loc[12, "mae"] == 15 and out.loc[12, "n"] == 2
    assert out.loc[24, "mae"] == 50
