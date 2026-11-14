# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Estado de la nave, filtro de CO2 ligado al sueño (con privacidad) y botiquín con planes preaprobados."""
import pytest
import roles
import ship


@pytest.fixture(autouse=True)
def clean():
    roles.reset()
    yield
    roles.reset()


def test_systems_and_sources(client):
    s = client.get("/api/ship").json()
    ids = {x["id"] for x in s["systems"]}
    assert {"o2", "pressure", "co2_quarters", "co2_cabin", "water", "power", "radiation"} <= ids
    assert all(x["simulated"] and x["source"] for x in s["systems"])
    power = next(x for x in s["systems"] if x["id"] == "power")
    assert power["verified"] is False                                   # sin fuente: marcado como supuesto
    o2 = next(x for x in s["systems"] if x["id"] == "o2")
    assert o2["verified"] is True and o2["status"] == "ok" and o2["nominal"] == {"low": 146, "high": 178}


def test_co2_filter_is_watch_and_ship_alert_for_everyone(client):
    s = client.get("/api/ship").json()
    co2 = next(x for x in s["systems"] if x["id"] == "co2_quarters")
    assert co2["status"] == "watch" and co2["value"] > 3 and s["worst_status"] == "watch"
    st = client.get("/api/station?viewer=marco").json()                  # un tripulante cualquiera ve la nave
    assert any(a["id"] == "ship:co2_quarters" for a in st["alerts"]) and st["ship"]["worst_status"] == "watch"
    assert not any(str(a.get("id", "")).startswith("co2_") for a in st["alerts"])   # sin duplicar el aviso antiguo


def test_radiation_dose():
    import main
    rad = next(x for x in ship.systems(main.crew_doc(), []) if x["id"] == "radiation")
    assert rad["value"] == pytest.approx(112 * 1.8) and "600 mSv" in rad["note_en"] and rad["status"] == "ok"


@pytest.mark.parametrize("viewer,sees", [("lena", True), ("noor", True), ("ground", True), ("marco", False), ("kenji", False)])
def test_co2_sleep_link_only_for_who_can_see_lena(client, viewer, sees):
    link = client.get(f"/api/ship?viewer={viewer}").json()["co2_sleep_link"]
    assert (link is not None) == sees
    if link:
        assert link["nights_over_limit"] > 0 and link["sleep_h_over_limit"] < link["sleep_h_other"] and "not a diagnosis" in link["text_en"]


def test_meds_inventory():
    m = ship.meds()
    assert m["no_doses"] and len(m["inventory"]) >= 8
    sleep = next(x for x in m["inventory"] if x["id"] == "sleep_aid")
    assert sleep["expires_before_mission_end"] and sleep["verified_category"]          # categoría de la lista de Orion
    assert any(x["low"] for x in m["inventory"]) and "expire before the end" in m["summary_en"]


@pytest.mark.parametrize("msg,plan", [("What pill can I take for my headache?", "headache"),
                                      ("Can I take something to sleep?", "sleep"),
                                      ("What medicine for motion sickness?", "nausea"),
                                      ("Any painkiller for my back pain?", "back_pain")])
def test_chat_reads_preapproved_plan(client, msg, plan):
    d = client.post("/api/metis/chat", json={"message": msg, "crew_id": "lena"}).json()
    assert d["source"] == "rule" and d["plan"] == plan and d["ai_generated"] is False
    assert "pre-flight card" in d["text"] and "Example plan" in d["note"]


def test_no_drug_names_or_doses_in_plans():
    import llm
    for p in ship.PLANS.values():
        assert not llm.FORBIDDEN.search(p["en"]), p["en"]


def test_medication_without_condition_keeps_old_rule(client):
    d = client.post("/api/metis/chat", json={"message": "What pill should I take?", "crew_id": "lena"}).json()
    assert d["source"] == "rule" and "plan" not in d and "can't recommend medication" in d["text"]


@pytest.mark.parametrize("msg", ["Metis, how is the ship?", "ship status", "How's the station?"])
def test_chat_ship_status(client, msg):
    d = client.post("/api/metis/chat", json={"message": msg, "crew_id": "marco"}).json()
    assert d["source"] == "rule" and "CO2 removal: crew quarters" in d["text"] and "radiation" in d["text"]
