from __future__ import annotations

from fastapi.testclient import TestClient

from app.models import SessionStatus, TrainingSession
from tests.conftest import login

FAKE_MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 4096


def upload(client: TestClient, session_id: str, data: bytes = FAKE_MP4, name="run.mp4", mime="video/mp4"):
    return client.post(
        f"/api/sessions/{session_id}/video",
        files={"file": (name, data, mime)},
        data={"durationSeconds": "95.5"},
    )


def new_session(client: TestClient, task_id: str = "simple-suturing") -> dict:
    res = client.post("/api/sessions", json={"taskId": task_id})
    assert res.status_code == 201, res.text
    return res.json()


def test_auth_flow(client):
    assert client.get("/api/auth/me").status_code == 401
    bad = client.post("/api/auth/login", json={"email": "alex@demo.local", "password": "nope"})
    assert bad.status_code == 401

    user = login(client, "ALEX@demo.local")
    assert user["displayName"] == "Alex Rivera"
    assert client.get("/api/auth/me").json()["email"] == "alex@demo.local"

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_training_flow_end_to_end(alex, app):
    tasks = alex.get("/api/tasks").json()
    assert {t["id"] for t in tasks} >= {"simple-suturing", "knot-tying"}

    s = new_session(alex)
    assert s["status"] == "created"

    res = upload(alex, s["id"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "uploaded"
    assert body["video"]["sizeBytes"] == len(FAKE_MP4)
    assert body["video"]["durationS"] == 95.5

    # Report is not available before processing.
    assert alex.get(f"/api/reports/{s['id']}").status_code == 404

    app.state.pipeline.run_until_idle()

    done = alex.get(f"/api/sessions/{s['id']}").json()
    assert done["status"] == "ready"
    assert isinstance(done["overallScore"], int)

    report = alex.get(f"/api/reports/{s['id']}").json()
    assert report["overallScore"] == done["overallScore"]
    assert report["evidenceVideoUrl"] == f"/api/sessions/{s['id']}/video"
    assert len(report["dimensions"]) == 5
    assert all(e["timeSeconds"] <= 95.5 for e in report["timeline"])
    assert report["delta"] != "—"  # seeded history gives a previous score

    listed = alex.get("/api/reports").json()
    assert listed[0]["sessionId"] == s["id"]

    video = alex.get(f"/api/sessions/{s['id']}/video", headers={"Range": "bytes=0-9"})
    assert video.status_code == 206
    assert video.content == FAKE_MP4[:10]


def test_other_students_cannot_see_session(client, app):
    login(client, "alex@demo.local")
    s = new_session(client)
    upload(client, s["id"])
    app.state.pipeline.run_until_idle()

    login(client, "jordan@demo.local")
    assert client.get(f"/api/sessions/{s['id']}").status_code == 404
    assert client.get(f"/api/reports/{s['id']}").status_code == 404
    assert client.get(f"/api/sessions/{s['id']}/video").status_code == 404
    assert all(r["sessionId"] != s["id"] for r in client.get("/api/reports").json())


def test_upload_validation(alex):
    s = new_session(alex)
    assert upload(alex, s["id"], name="notes.txt", mime="text/plain").status_code == 415
    assert upload(alex, s["id"], data=b"").status_code == 422
    # Generic content type but a known extension is accepted.
    assert upload(alex, s["id"], name="clip.mkv", mime="application/octet-stream").status_code == 200
    assert upload(alex, s["id"]).status_code == 409


def test_upload_size_limit(settings, tmp_path):
    from dataclasses import replace

    from app.main import create_app

    small = replace(settings, max_upload_mb=1)
    with TestClient(create_app(small)) as c:
        login(c)
        s = new_session(c)
        res = upload(c, s["id"], data=b"\x00" * (1024 * 1024 + 10))
        assert res.status_code == 413
        assert not any(small.video_dir.iterdir())


def test_failure_and_retry(alex, app):
    pipeline = app.state.pipeline
    real = pipeline.scoring

    class Broken:
        name = "broken"

        def score(self, ctx):
            raise RuntimeError("scoring API unreachable")

    s = new_session(alex)
    upload(alex, s["id"])
    pipeline.scoring = Broken()
    pipeline.run_until_idle()

    failed = alex.get(f"/api/sessions/{s['id']}").json()
    assert failed["status"] == "failed"
    assert "scoring API unreachable" in failed["error"]

    pipeline.scoring = real
    assert alex.post(f"/api/sessions/{s['id']}/retry").json()["status"] == "uploaded"
    pipeline.run_until_idle()
    assert alex.get(f"/api/sessions/{s['id']}").json()["status"] == "ready"
    assert alex.post(f"/api/sessions/{s['id']}/retry").status_code == 409


def test_recover_requeues_in_flight(alex, app):
    s = new_session(alex)
    upload(alex, s["id"])
    with app.state.db.session() as db:
        db.get(TrainingSession, s["id"]).status = SessionStatus.SCORING.value
        db.commit()
    app.state.pipeline.recover()
    assert alex.get(f"/api/sessions/{s['id']}").json()["status"] == "uploaded"


def test_dashboard(alex, app):
    d = alex.get("/api/dashboard").json()
    assert d["studentName"] == "Alex Rivera"
    assert d["currentTask"]["id"] == "simple-suturing"
    assert d["lastReport"]["score"] > 0
    assert len(d["history"]) == 17  # 14 generated + 3 samples
    assert d["trends"]["sessionsCount"] == 17
    cal = d["trainingActivityCalendar"]
    assert sum(day["sessions"] for day in cal["activityByDate"].values()) == 17

    s = new_session(alex)
    upload(alex, s["id"])
    d = alex.get("/api/dashboard").json()
    assert d["inProgress"][0]["sessionId"] == s["id"]
    assert any("being analysed" in n for n in d["notifications"])
