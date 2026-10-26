import pandas as pd

from app.selection import cutoff_for, select_forecasts


def ts(s: str) -> pd.Timestamp:
    return pd.Timestamp(s, tz="UTC")


def fc(rows):
    """rows: (publishTime, startTime, generation)"""
    return pd.DataFrame(
        [(ts(p), ts(s), g) for p, s, g in rows],
        columns=["publishTime", "startTime", "generation"],
    )


def pick(forecasts, target, hour=9):
    out = select_forecasts(forecasts, pd.DatetimeIndex([ts(target)]), hour)
    return out.iloc[0]


def test_cutoff_is_previous_day_at_hour_london_winter():
    # Jan: London == UTC
    assert cutoff_for(pd.DatetimeIndex([ts("2026-01-15T14:00")]), 9)[0] == ts("2026-01-14T09:00")


def test_cutoff_respects_bst_offset():
    # Jul: London == UTC+1, so 09:00 local is 08:00 UTC
    assert cutoff_for(pd.DatetimeIndex([ts("2026-07-15T14:00")]), 9)[0] == ts("2026-07-14T08:00")


def test_cutoff_uses_london_delivery_date_not_utc_date():
    # 23:30 UTC on 14 Jul is 00:30 BST on 15 Jul -> delivery day is the 15th, cutoff is 14th 08:00 UTC
    assert cutoff_for(pd.DatetimeIndex([ts("2026-07-14T23:30")]), 9)[0] == ts("2026-07-14T08:00")


def test_picks_latest_publish_at_or_before_cutoff():
    f = fc([
        ("2026-01-14T02:30", "2026-01-15T12:00", 100),
        ("2026-01-14T07:30", "2026-01-15T12:00", 200),  # latest before 09:00
        ("2026-01-14T11:30", "2026-01-15T12:00", 300),  # after cutoff
    ])
    r = pick(f, "2026-01-15T12:00")
    assert r.generation_forecast == 200
    assert r.publishTime == ts("2026-01-14T07:30")


def test_no_leakage_of_forecast_published_after_cutoff():
    f = fc([("2026-01-14T09:30", "2026-01-15T12:00", 999)])
    assert pd.isna(pick(f, "2026-01-15T12:00").generation_forecast)


def test_publish_exactly_at_cutoff_is_included():
    f = fc([("2026-01-14T09:00", "2026-01-15T12:00", 150)])
    assert pick(f, "2026-01-15T12:00").generation_forecast == 150


def test_cutoff_hour_is_configurable():
    f = fc([
        ("2026-01-14T07:30", "2026-01-15T12:00", 200),
        ("2026-01-14T11:30", "2026-01-15T12:00", 300),
    ])
    assert pick(f, "2026-01-15T12:00", hour=12).generation_forecast == 300


def test_ignores_forecasts_for_other_target_hours():
    f = fc([("2026-01-14T07:30", "2026-01-15T13:00", 555)])
    assert pd.isna(pick(f, "2026-01-15T12:00").generation_forecast)


def test_missing_target_returns_nan_row_not_dropped():
    out = select_forecasts(
        fc([("2026-01-14T07:30", "2026-01-15T12:00", 1)]),
        pd.DatetimeIndex([ts("2026-01-15T12:00"), ts("2026-01-15T13:00")]),
        9,
    )
    assert len(out) == 2 and out.generation_forecast.isna().tolist() == [False, True]


def test_duplicate_rows_do_not_duplicate_output():
    f = fc([
        ("2026-01-14T07:30", "2026-01-15T12:00", 200),
        ("2026-01-14T07:30", "2026-01-15T12:00", 200),
    ])
    out = select_forecasts(f, pd.DatetimeIndex([ts("2026-01-15T12:00")]), 9)
    assert len(out) == 1


def test_horizon_hours_is_target_minus_publish():
    f = fc([("2026-01-14T07:30", "2026-01-15T12:00", 200)])
    assert pick(f, "2026-01-15T12:00").horizon_hours == 28.5
