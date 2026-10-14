from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import login


def student_id(client: TestClient, email: str) -> int:
    login(client, email)
    return client.get("/api/auth/me").json()["id"]


def latest_report_id(client: TestClient) -> str:
    return client.get("/api/reports").json()[0]["sessionId"]


def test_instructors_only_see_their_cohorts(client):
    alex_id = student_id(client, "alex@demo.local")
    alex_session = latest_report_id(client)
    assert client.get("/api/instructor/cohorts").status_code == 403

    login(client, "chen@demo.local")
    assert [c["id"] for c in client.get("/api/instructor/cohorts").json()] == ["group-a", "group-b"]
    assert client.get(f"/api/instructor/students/{alex_id}").status_code == 200
    assert client.get(f"/api/reports/{alex_session}").status_code == 200
    assert client.get(f"/api/reports?studentId={alex_id}").status_code == 200

    login(client, "patel@demo.local")  # teaches Group B only; Alex is in Group A
    assert [c["id"] for c in client.get("/api/instructor/cohorts").json()] == ["group-b"]
    assert client.get("/api/instructor/cohorts/group-a").status_code == 404
    assert client.get(f"/api/instructor/students/{alex_id}").status_code == 404
    assert client.get(f"/api/reports/{alex_session}").status_code == 404
    assert client.get(f"/api/reports?studentId={alex_id}").status_code == 404


def test_students_cannot_list_other_students_reports(client):
    jordan_id = student_id(client, "jordan@demo.local")
    login(client, "alex@demo.local")
    assert client.get(f"/api/reports?studentId={jordan_id}").status_code == 404


def test_cohort_overview_flags_students(client):
    login(client, "chen@demo.local")
    a = client.get("/api/instructor/cohorts/group-a").json()
    assert a["kpis"]["students"] == 4
    kinds = {(x["studentName"], x["kind"]) for x in a["attention"]}
    assert ("Priya Shah", "declining") in kinds
    assert ("Priya Shah", "clarification") in kinds
    assert ("Lee Wong", "inactive") in kinds
    assert a["attention"][0]["severity"] == "high"
    roster = {r["name"]: r for r in a["students"]}
    assert roster["Sam Taylor"]["recentChange"] > 0
    assert set(roster["Sam Taylor"]["dimensionAverages"]) == set(a["dimensions"])

    b = client.get("/api/instructor/cohorts/group-b").json()
    kinds = {(x["studentName"], x["kind"]) for x in b["attention"]}
    assert ("Noah Brown", "inactive") in kinds
    assert ("Mia Garcia", "failed") in kinds


def test_student_detail(client):
    sam_id = student_id(client, "sam@demo.local")
    login(client, "chen@demo.local")
    d = client.get(f"/api/instructor/students/{sam_id}").json()
    assert d["student"]["cohort"]["id"] == "group-a"
    assert len(d["scoreSeries"]) == 10
    assert set(d["scoreSeries"][0]["dimensions"]) == set(d["dimensions"])
    assert d["sessions"][0]["recordedAt"] >= d["sessions"][-1]["recordedAt"]


def test_review_flow(client):
    login(client, "noah@demo.local")
    assert client.get("/api/reports").json() == []

    login(client, "sam@demo.local")
    sid = latest_report_id(client)
    report = client.get(f"/api/reports/{sid}").json()
    assert report["review"] is None
    assert report["meta"]["canReview"] is False
    assert client.put(f"/api/reports/{sid}/review", json={"finalScore": 90}).status_code == 403

    login(client, "chen@demo.local")
    pending_before = client.get("/api/instructor/reviews?filter=pending").json()["counts"]["pending"]
    assert sid in {i["sessionId"] for i in client.get("/api/instructor/reviews").json()["items"]}

    draft = client.put(
        f"/api/reports/{sid}/review",
        json={"finalScore": 70, "comment": "Draft", "teachingFocus": ["pacing"]},
    ).json()
    assert draft["review"]["status"] == "draft"
    assert draft["meta"]["canReview"] is True

    login(client, "sam@demo.local")
    assert client.get(f"/api/reports/{sid}").json()["review"] is None  # drafts are private

    login(client, "chen@demo.local")
    ai = draft["meta"]["aiScore"]
    done = client.put(
        f"/api/reports/{sid}/review",
        json={"finalScore": ai + 4, "comment": "Nice recovery.", "teachingFocus": ["pacing", " "], "complete": True},
    ).json()
    assert done["review"]["status"] == "completed"
    assert done["review"]["alignment"] == "adjusted"
    assert done["review"]["teachingFocus"] == ["pacing"]
    counts = client.get("/api/instructor/reviews").json()["counts"]
    assert counts["pending"] == pending_before - 1

    login(client, "sam@demo.local")
    seen = client.get(f"/api/reports/{sid}").json()
    assert seen["review"]["finalScore"] == ai + 4
    assert seen["review"]["instructorName"] == "Dr. Chen"
    assert seen["status"] == "Reviewed"
    dash = client.get("/api/dashboard").json()
    assert dash["history"][0]["instructorStatus"] == "Reviewed"


def test_clarification_flow(client):
    login(client, "sam@demo.local")
    sid = latest_report_id(client)
    assert client.post(f"/api/reports/{sid}/feedback", json={"kind": "clarify"}).status_code == 409
    fb = client.post(
        f"/api/reports/{sid}/feedback",
        json={"kind": "clarify", "message": "Was 0:42 really a pause?", "referencedClip": "0:42 - Long pause"},
    ).json()["feedback"]
    assert fb["status"] == "open"

    login(client, "chen@demo.local")
    assert client.post(f"/api/reports/{sid}/feedback", json={"kind": "accept"}).status_code == 403
    queue = client.get("/api/instructor/reviews?filter=clarifications").json()["items"]
    assert sid in {i["sessionId"] for i in queue}
    resolved = client.post(
        f"/api/reports/{sid}/feedback/response", json={"response": "Yes — 3.1s idle before insertion."}
    ).json()["feedback"]
    assert resolved["status"] == "resolved"
    assert resolved["respondedBy"] == "Dr. Chen"

    login(client, "sam@demo.local")
    assert client.get(f"/api/reports/{sid}").json()["feedback"]["response"].startswith("Yes")
    # Already answered: the student can't overwrite it.
    assert client.post(f"/api/reports/{sid}/feedback", json={"kind": "accept"}).status_code == 409


def test_personal_note_is_private(client):
    login(client, "sam@demo.local")
    sid = latest_report_id(client)
    assert client.put(f"/api/reports/{sid}/note", json={"note": "Felt rushed."}).json()["personalNote"] == "Felt rushed."

    login(client, "chen@demo.local")
    assert client.get(f"/api/reports/{sid}").json()["personalNote"] is None
    assert client.put(f"/api/reports/{sid}/note", json={"note": "x"}).status_code == 403
