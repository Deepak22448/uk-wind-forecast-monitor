import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
JAN = {"start": "2026-01-02", "end": "2026-01-31"}


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_meta_reports_data_bounds_and_default_cutoff():
    m = client.get("/api/meta").json()
    # decisions made 1..31 Jan -> delivery days 2 Jan..1 Feb
    assert (m["first_day"], m["last_day"]) == ("2026-01-02", "2026-02-01")
    assert m["default_cutoff_hour"] == 9


def test_series_has_one_point_per_hour_and_error_is_forecast_minus_actual():
    pts = client.get("/api/series", params=JAN).json()
    assert len(pts) == 720
    p = pts[0]
    assert p["error"] == pytest.approx(p["forecast"] - p["actual"])
    assert p["horizon_hours"] == 16.5  # published 07:30 D-1 for 00:00 D


def test_metrics_matches_known_january_numbers():
    s = client.get("/api/metrics", params=JAN).json()["summary"]
    assert s["n"] == 720 and s["n_missing"] == 0
    assert s["mae"] == pytest.approx(2057.6, abs=0.1)
    assert s["bias"] == pytest.approx(1772.5, abs=0.1)


def test_metrics_breakdowns_present():
    body = client.get("/api/metrics", params=JAN).json()
    assert len(body["by_hour"]) == 24 and len(body["by_horizon"]) >= 3


def test_cutoff_hour_changes_the_selected_forecast():
    early = client.get("/api/series", params={**JAN, "cutoff_hour": 0}).json()
    late = client.get("/api/series", params={**JAN, "cutoff_hour": 23}).json()
    assert early[0]["publish_time"] != late[0]["publish_time"]
    assert late[0]["horizon_hours"] < early[0]["horizon_hours"]  # later cutoff = fresher forecast


@pytest.mark.parametrize("params", [
    {"start": "2026-01-10", "end": "2026-01-05"},   # start after end
    {"start": "2025-06-01", "end": "2025-06-02"},   # outside data
    {**JAN, "cutoff_hour": 24},                     # bad hour
    {"start": "not-a-date", "end": "2026-01-05"},   # bad format
])
def test_bad_input_is_422(params):
    assert client.get("/api/series", params=params).status_code == 422


def test_request_id_is_generated_and_echoed():
    assert client.get("/health").headers["x-request-id"]
    assert client.get("/health", headers={"x-request-id": "abc123"}).headers["x-request-id"] == "abc123"
