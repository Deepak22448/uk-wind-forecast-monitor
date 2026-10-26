from datetime import date, datetime

from pydantic import BaseModel


class Meta(BaseModel):
    first_day: date  # first London delivery day with data
    last_day: date
    default_cutoff_hour: int


class SeriesPoint(BaseModel):
    start_time: datetime  # UTC, start of the hourly target slot
    actual: float | None
    forecast: float | None  # None when nothing was published before the cutoff
    publish_time: datetime | None
    horizon_hours: float | None
    error: float | None  # forecast - actual; positive = over-forecast


class Summary(BaseModel):
    n: int
    n_missing: int
    mae: float | None
    rmse: float | None
    bias: float | None
    mape: float | None  # percent
    p50: float | None  # percentiles of absolute error, MW
    p90: float | None
    p95: float | None


class HourBucket(BaseModel):
    hour: int  # London local hour
    n: int
    mae: float
    bias: float


class HorizonBucket(BaseModel):
    horizon_bucket_start: int  # hours; bucket is [start, start + 6)
    n: int
    mae: float
    bias: float


class MetricsResponse(BaseModel):
    summary: Summary
    by_hour: list[HourBucket]
    by_horizon: list[HorizonBucket]
