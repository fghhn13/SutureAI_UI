from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
from dataclasses import replace

from fastapi.testclient import TestClient
from sqlalchemy import inspect

from app.config import REPO_ROOT
from app.db import Database
from app.main import create_app
from tests.conftest import login
from tests.test_api import FAKE_MP4, new_session, upload

DEMO_SRC = REPO_ROOT / "server" / "demo"


def run(app, client, name: str, data: bytes = FAKE_MP4) -> tuple[dict, dict]:
    s = new_session(client)
    assert upload(client, s["id"], data=data, name=name).status_code == 200
    app.state.pipeline.run_until_idle()
    return s, client.get(f"/api/sessions/{s['id']}").json()


def test_registered_filename_gets_annotation(alex, app):
    s, done = run(app, alex, "suture_1.mp4")
    assert done["status"] == "ready" and done["progress"] == 1.0
    report = alex.get(f"/api/reports/{s['id']}").json()
    annotation = json.loads((DEMO_SRC / "suture-demo-1.json").read_text(encoding="utf-8"))
    assert report["overallScore"] == annotation["overallScore"]
    assert [e["timeSeconds"] for e in report["timeline"]] == [e["t"] for e in annotation["events"]]
    assert report["timeline"][1]["title"] == "Wrong tool in left hand"
    assert report["summary"] == annotation["narrative"]["summary"]
    accuracy = next(d for d in report["dimensions"] if d["name"] == "Accuracy")
    assert accuracy["explanation"] == annotation["narrative"]["dimensionExplanations"]["Accuracy"]

    with app.state.db.session() as db:
        from app.models import TrainingSession

        assert db.get(TrainingSession, s["id"]).scoring.raw["source"] == "demo:suture-demo-1 (filename)"


def test_registered_hash_matches_any_filename(settings, tmp_path):
    demo_dir = tmp_path / "demo"
    shutil.copytree(DEMO_SRC, demo_dir)
    registry = json.loads((demo_dir / "registry.json").read_text(encoding="utf-8"))
    registry["recordings"][0]["sha256"] = [hashlib.sha256(FAKE_MP4).hexdigest()]
    registry["recordings"][0]["filenames"] = []
    (demo_dir / "registry.json").write_text(json.dumps(registry), encoding="utf-8")

    app = create_app(replace(settings, demo_dir=demo_dir))
    with TestClient(app) as c:
        login(c)
        s, done = run(app, c, "renamed-recording.mp4")
        assert c.get(f"/api/reports/{s['id']}").json()["overallScore"] == 66
        # A different file under the old filename no longer matches (hash-only entry) → mock.
        s2, _ = run(app, c, "suture_1.mp4", data=FAKE_MP4 + b"x")
        annotation = json.loads((demo_dir / "suture-demo-1.json").read_text(encoding="utf-8"))
        assert c.get(f"/api/reports/{s2['id']}").json()["summary"] != annotation["narrative"]["summary"]


def test_reject_mode_fails_unregistered_uploads(settings):
    app = create_app(replace(settings, demo_fallback="reject"))
    with TestClient(app) as c:
        login(c)
        _, done = run(app, c, "my-own-video.mp4")
        assert done["status"] == "failed"
        assert done["error"].startswith("This recording is not a registered demo video")


def test_progress_is_recorded(alex, app):
    s = new_session(alex)
    upload(alex, s["id"])
    assert alex.get(f"/api/sessions/{s['id']}").json()["progress"] == 0.0
    write = app.state.pipeline._progress_writer(s["id"], 0.02, 0.80)
    write(0.5, "track_hands")
    live = alex.get(f"/api/sessions/{s['id']}").json()
    assert live["stage"] == "track_hands" and abs(live["progress"] - 0.41) < 1e-6


def test_old_database_gets_new_columns(tmp_path):
    path = tmp_path / "old.db"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE training_sessions (id VARCHAR(32) PRIMARY KEY, status VARCHAR(20))")
    con.commit()
    con.close()
    db = Database(f"sqlite:///{path.as_posix()}")
    db.create_all()
    cols = {c["name"] for c in inspect(db.engine).get_columns("training_sessions")}
    assert {"progress", "stage"} <= cols
    db.engine.dispose()
