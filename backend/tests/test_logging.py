import json
import logging

from app.main import JsonFormatter, request_id


def test_json_formatter_emits_parseable_line_with_request_id_and_extras():
    record = logging.LogRecord("wind", logging.INFO, __file__, 1, "request", None, None)
    record.extra_fields = {"status": 200, "path": "/health"}
    token = request_id.set("abc123")
    try:
        out = json.loads(JsonFormatter().format(record))
    finally:
        request_id.reset(token)
    assert out == {"level": "INFO", "msg": "request", "request_id": "abc123", "status": 200, "path": "/health"}
