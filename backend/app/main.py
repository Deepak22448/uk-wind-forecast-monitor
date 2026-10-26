import json
import logging
import os
import time
import uuid
from contextvars import ContextVar
from datetime import date

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from app import metrics, store
from app.compare import compare
from app.schemas import Meta, MetricsResponse, SeriesPoint
from app.selection import DEFAULT_CUTOFF_HOUR

request_id: ContextVar[str] = ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {"level": record.levelname, "msg": record.getMessage(), "request_id": request_id.get()}
        entry.update(getattr(record, "extra_fields", {}))
        return json.dumps(entry)


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
log = logging.getLogger("wind")
log.addHandler(handler)
log.setLevel(logging.INFO)
log.propagate = False

app = FastAPI(title="UK Wind Forecast Monitor", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o],
    allow_methods=["GET"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def access_log(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request_id.set(rid)
    t0 = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    log.info("request", extra={"extra_fields": {
        "method": request.method, "path": request.url.path, "status": response.status_code,
        "ms": round((time.perf_counter() - t0) * 1000, 1)}})
    return response


def window(
    start: date = Query(..., description="First London delivery day, YYYY-MM-DD"),
    end: date = Query(..., description="Last London delivery day, inclusive"),
    cutoff_hour: int = Query(DEFAULT_CUTOFF_HOUR, ge=0, le=23, description="D-1 decision hour, London time"),
) -> pd.DataFrame:
    first, last = store.bounds()
    if start > end:
        raise HTTPException(422, "start must be <= end")
    if start < first or end > last:
        raise HTTPException(422, f"dates must be within {first}..{last}")
    actuals, forecasts = store.load()
    return compare(actuals, forecasts, pd.Timestamp(start), pd.Timestamp(end), cutoff_hour)


def _nullable(v):
    return None if pd.isna(v) else v


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta", response_model=Meta)
def meta() -> Meta:
    first, last = store.bounds()
    return Meta(first_day=first, last_day=last, default_cutoff_hour=DEFAULT_CUTOFF_HOUR)


@app.get("/api/series", response_model=list[SeriesPoint])
def series(df: pd.DataFrame = Depends(window)) -> list[SeriesPoint]:
    return [
        SeriesPoint(
            start_time=r.startTime,
            actual=_nullable(r.generation),
            forecast=_nullable(r.generation_forecast),
            publish_time=_nullable(r.publishTime),
            horizon_hours=_nullable(r.horizon_hours),
            error=_nullable(r.generation_forecast - r.generation),
        )
        for r in df.itertuples()
    ]


@app.get("/api/metrics", response_model=MetricsResponse)
def get_metrics(df: pd.DataFrame = Depends(window)) -> MetricsResponse:
    return MetricsResponse(
        summary=metrics.summary(df),
        by_hour=metrics.by_hour_of_day(df).to_dict("records"),
        by_horizon=metrics.by_horizon(df).to_dict("records"),
    )
