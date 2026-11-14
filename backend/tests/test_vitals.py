# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Constantes en directo y avisos tempranos (reglas fijas sobre la línea base de cada persona)."""
import pytest
import main
import station
import vitals

T = 1_800_000_000.0  # instante fijo: las series son deterministas


@pytest.fixture(autouse=True)
def clean():
    vitals.reset()
    yield
    vitals.reset()


def doc():
    return main.crew_doc()


def alerts_for(snap, cid):
    return [a for a in snap["alerts"] if a["crew_id"] == cid]


def test_normal_crew_has_no_alerts():
    s = vitals.snapshot(doc(), now=T)
    assert {c["id"] for c in s["crew"]} == {"lena", "marco", "noor", "kenji"}
    assert s["alerts"] == [] and all(c["status"] == "ok" for c in s["crew"])
    assert s["simulated"] is True and "baseline" in s["method"]["en"]


def test_deterioration_warns_early_then_escalates():
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    assert alerts_for(vitals.snapshot(doc(), now=T + 20), "marco") == []          # aún dentro de lo normal
    early = vitals.snapshot(doc(), now=T + 60)
    a = alerts_for(early, "marco")
    assert a and a[0]["level"] == "watch" and a[0]["rule"].startswith("hr_")    # primer aviso: solo el pulso, al minuto
    late = vitals.snapshot(doc(), now=T + 200)
    a = alerts_for(late, "marco")
    assert a and a[0]["level"] == "warning"
    assert {"hr_bpm", "rr_brpm", "spo2_pct"} <= set(a[0]["metrics"])
    assert "Marco" in a[0]["text_en"] and "usual" in a[0]["text_en"]
    assert alerts_for(late, "lena") == []                                        # los demás, sin aviso


def test_exercise_is_not_an_alert():
    vitals.set_scenario("kenji", "exercise", now=T)
    s = vitals.snapshot(doc(), now=T + 200)
    k = next(c for c in s["crew"] if c["id"] == "kenji")
    assert k["now"]["hr_bpm"] > 100 and k["now"]["activity"] == 2 and alerts_for(s, "kenji") == []


def test_collapse_is_alarm():
    vitals.set_scenario("marco", "collapse", now=T)
    s = vitals.snapshot(doc(), now=T + 20)
    a = alerts_for(s, "marco")
    assert a and a[0]["level"] == "alarm" and a[0]["rule"] == "no_pulse"


def test_alert_becomes_one_station_event():
    vitals.set_scenario("marco", "collapse", now=T)
    before = len([e for e in station.events() if e["type"] == "no_pulse"])
    vitals.snapshot(doc(), now=T + 20); vitals.snapshot(doc(), now=T + 30)
    after = [e for e in station.events() if e["type"] == "no_pulse"]
    assert len(after) == before + 1                                               # una sola vez, no en cada consulta


def test_endpoints(client):
    v = client.get("/api/vitals").json()
    assert len(v["crew"]) == 4 and "series" not in v["crew"][0]
    one = client.get("/api/vitals/marco").json()
    assert len(one["series"]) == vitals.WINDOW_S // vitals.STEP_S
    assert client.get("/api/vitals/nadie").status_code == 404
    assert client.post("/api/vitals/scenario", json={"crew_id": "marco", "kind": "deterioration"}).json()["ok"]
    assert client.post("/api/vitals/scenario", json={"crew_id": "marco", "kind": "volar"}).status_code == 400
    st = client.get("/api/station").json()
    assert all("vitals" in c for c in st["crew"])


@pytest.mark.parametrize("msg,who", [("Metis, how is the crew?", None), ("How's Marco doing?", "Marco"), ("status report", None),
                                    ("How is the queue?", None)])
def test_chat_crew_status_is_a_rule(client, msg, who):
    d = client.post("/api/metis/chat", json={"message": msg, "crew_id": "noor"}).json()   # Noor = CMO: lo ve todo
    assert d["source"] == "rule" and d["ai_generated"] is False
    assert (who or "Lena") in d["text"] and "heart rate" in d["text"]


def test_chat_status_reports_warning(client):
    vitals.set_scenario("marco", "collapse")
    d = client.post("/api/metis/chat", json={"message": "how is Marco?", "crew_id": "noor"}).json()
    assert "No pulse" in d["text"]


def test_no_false_alarms_over_two_hours():
    """Constantes normales durante 2 h (una consulta por minuto): ningún aviso para nadie."""
    for m in range(120):
        s = vitals.snapshot(doc(), now=T + 60 * m)
        assert s["alerts"] == [], (m, s["alerts"])


def test_station_marks_watch():
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    v = vitals.snapshot(doc(), now=T + 60)
    assert next(c for c in v["crew"] if c["id"] == "marco")["status"] == "watch"


# ---- Protocolo: primero el afectado; el equipo solo si no contesta, pide ayuda o pierde el pulso ----

def check(snap, cid):
    return next((c for c in snap["checks"] if c["crew_id"] == cid), None)


def crew_alerts_since(n):
    return [e for e in station.events()[: max(0, len(station.events()) - n)] if e["type"] == "crew_alert"]


def test_affected_person_is_asked_first():
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    n = len(station.events())
    s = vitals.snapshot(doc(), now=T + 60)
    c = check(s, "marco")
    assert c["state"] == "asking" and c["advice_en"].startswith("Marco, ") and "Are you okay?" in c["advice_en"]
    assert "rest" in c["advice_en"] and crew_alerts_since(n) == []                    # nadie más avisado todavía


def test_no_answer_escalates_to_crew_with_instructions():
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    n = len(station.events())
    vitals.snapshot(doc(), now=T + 60)
    s = vitals.snapshot(doc(), now=T + 60 + vitals.CHECKIN_TIMEOUT_S)
    c = check(s, "marco")
    assert c["state"] == "escalated" and c["reason"] == "no_answer"
    assert c["instructions_en"].startswith("Go to Marco now.") and "not answering" in c["instructions_en"]
    assert len(crew_alerts_since(n)) == 1


def test_ok_answer_does_not_escalate():
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    vitals.snapshot(doc(), now=T + 60)
    r = vitals.checkin("marco", "Yeah, I'm fine, no problem", now=T + 65)
    assert r["answer"] == "ok"
    s = vitals.snapshot(doc(), now=T + 70 + vitals.CHECKIN_TIMEOUT_S)
    assert check(s, "marco")["state"] in ("asking",)            # sigue vigilando; no ha avisado a nadie


def test_worse_level_asks_again():
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    vitals.snapshot(doc(), now=T + 60)
    vitals.checkin("marco", "I'm okay", now=T + 62)
    s = vitals.snapshot(doc(), now=T + 120)                     # pasa a «warning»
    c = check(s, "marco")
    assert c["level"] == "warning" and c["state"] == "asking" and c["answer"] is None and "worse" in c["advice_en"]


@pytest.mark.parametrize("said", ["Help", "Alert the crew", "No", "I'm not okay", "call the team", "I feel worse", "avisa al equipo"])
def test_help_escalates_now(said):
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    vitals.snapshot(doc(), now=T + 60)
    assert vitals.checkin("marco", said, now=T + 61)["answer"] == "help", said
    c = check(vitals.snapshot(doc(), now=T + 62), "marco")
    assert c["state"] == "escalated" and c["reason"] == "help"


@pytest.mark.parametrize("said", ["what?", "I don't know", "[BLANK_AUDIO]"])
def test_unclear_answer_is_not_ok(said):
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    vitals.snapshot(doc(), now=T + 60)
    r = vitals.checkin("marco", said, now=T + 61)
    assert r["answer"] is None and "Are you okay" in r["say_en"]


def test_no_pulse_escalates_immediately_without_asking():
    vitals.set_scenario("marco", "collapse", now=T)
    c = check(vitals.snapshot(doc(), now=T + 10), "marco")
    assert c["state"] == "escalated" and c["reason"] == "no_pulse" and c["instructions_en"].startswith("Emergency. Go to Marco now")


def test_checkin_endpoint(client):
    vitals.set_scenario("marco", "deterioration", ramp_s=30)
    import time as _t
    vitals.snapshot(doc(), now=_t.time() + 60)
    r = client.post("/api/vitals/checkin", json={"crew_id": "marco", "text": "help me"}).json()
    assert r["answer"] == "help" and "alerting the crew" in r["say_en"]


@pytest.mark.parametrize("said,want", [("Jess.", "ok"), ("Know.", "help"), ("Now.", "help")])
def test_checkin_fuzzy(said, want):
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    vitals.snapshot(doc(), now=T + 60)
    assert vitals.checkin("marco", said, now=T + 61)["answer"] == want
