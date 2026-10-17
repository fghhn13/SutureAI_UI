from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.seed import DEMO_PASSWORD


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        data_dir=tmp_path,
        worker_enabled=False,  # tests drive the pipeline explicitly
        mock_scoring_delay_s=0,
        mock_report_delay_s=0,
        demo_analysis_s=0,
    )


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


def login(client: TestClient, email: str = "alex@demo.local") -> dict:
    res = client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture
def alex(client) -> TestClient:
    login(client)
    return client
