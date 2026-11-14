# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Roles a bordo y Tierra: tripulante (solo lo suyo), comandante (rasgos principales), CMO y Tierra (todo)."""
import pytest
import roles
import vitals


@pytest.fixture(autouse=True)
def clean():
    roles.reset(); vitals.reset()
    yield
    roles.reset(); vitals.reset()


def test_defaults(client):
    d = client.get("/api/roles").json()
    assert d["roles"] == {"lena": "crew", "marco": "crew", "noor": "cmo", "kenji": "commander"}
    assert d["permissions"]["commander"]["others"] == "summary" and d["permissions"]["cmo"]["others"] == "full"


def test_crew_sees_only_self(client):
    st = client.get("/api/station?viewer=lena").json()
    assert [c["id"] for c in st["crew"]] == ["lena"] and st["viewer"]["role"] == "crew"
    assert client.get("/api/crew/marco?viewer=lena").status_code == 403
    assert client.get("/api/crew/lena?viewer=lena").json()["access"] == "full"
    v = client.get("/api/vitals?viewer=lena").json()
    assert [c["id"] for c in v["crew"]] == ["lena"]


def test_commander_sees_main_traits_only(client):
    st = client.get("/api/station?viewer=kenji").json()
    marco = next(c for c in st["crew"] if c["id"] == "marco")
    assert marco["access"] == "summary" and "sleep_h" not in marco and "alerts" not in marco
    assert set(marco["vitals"]) <= {"t", "hr_bpm", "spo2_pct", "pulse", "activity"} and "fitness" in marco
    d = client.get("/api/crew/marco?viewer=kenji").json()
    assert d["access"] == "summary" and "days" not in d and "baseline" not in d
    assert next(c for c in st["crew"] if c["id"] == "kenji")["access"] == "full"   # lo suyo, completo


@pytest.mark.parametrize("viewer", ["noor", "ground"])
def test_cmo_and_ground_see_everything(client, viewer):
    st = client.get(f"/api/station?viewer={viewer}").json()
    assert len(st["crew"]) == 4 and all(c["access"] == "full" for c in st["crew"])
    d = client.get(f"/api/crew/marco?viewer={viewer}").json()
    assert len(d["days"]) == 30 and "baseline" in d


def test_no_viewer_keeps_old_behaviour(client):
    st = client.get("/api/station").json()
    assert len(st["crew"]) == 4 and "viewer" not in st
    assert client.get("/api/station?viewer=nadie").status_code == 400


def test_role_is_configurable(client):
    client.put("/api/roles", json={"crew_id": "lena", "role": "cmo"})
    assert len(client.get("/api/station?viewer=lena").json()["crew"]) == 4
    assert client.put("/api/roles", json={"crew_id": "lena", "role": "rey"}).status_code == 400
    client.post("/api/roles/reset")
    assert len(client.get("/api/station?viewer=lena").json()["crew"]) == 1


def test_emergency_reaches_everyone_but_early_warnings_stay_private(client):
    T = 1_800_000_000.0
    import main
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    snap = vitals.snapshot(main.crew_doc(), now=T + 60)                       # aviso temprano, aún preguntando a Marco
    lena = roles.filter_vitals(snap, "lena")
    assert lena["checks"] == [] and lena["alerts"] == []                     # Lena no ve la salud de Marco
    kenji = roles.filter_vitals(snap, "kenji")
    assert kenji["checks"] == [] and kenji["alerts"] and "medical officer" in kenji["alerts"][0]["text_en"]   # sin detalle
    noor = roles.filter_vitals(snap, "noor")
    assert noor["checks"] and "usual" in noor["alerts"][0]["text_en"]         # el CMO, con detalle
    esc = vitals.snapshot(main.crew_doc(), now=T + 60 + vitals.CHECKIN_TIMEOUT_S)
    lena = roles.filter_vitals(esc, "lena")
    assert lena["checks"] and lena["checks"][0]["instructions_en"].startswith("Go to Marco now")   # emergencia: a todos


def test_chat_respects_roles(client):
    d = client.post("/api/metis/chat", json={"message": "How is Marco?", "crew_id": "lena"}).json()
    assert "only share your own" in d["text"]
    d = client.post("/api/metis/chat", json={"message": "How is the crew?", "crew_id": "lena"}).json()
    assert d["text"].startswith("Lena:") and "Marco" not in d["text"]
    d = client.post("/api/metis/chat", json={"message": "How is the crew?", "crew_id": "kenji"}).json()
    assert "Marco: heart rate" in d["text"] and "breathing" not in d["text"].split("Marco:")[1].split(".")[0]


def test_fitness_only_cmo_or_ground(client):
    assert client.put("/api/crew/marco/fitness", json={"status": "limited", "viewer": "kenji"}).status_code == 403
    assert client.put("/api/crew/marco/fitness", json={"status": "limited", "viewer": "noor"}).json()["status"] == "limited"
    marco = next(c for c in client.get("/api/station?viewer=kenji").json()["crew"] if c["id"] == "marco")
    assert marco["fitness"]["status"] == "limited" and marco["fitness"]["by"] == "cmo"
    assert client.put("/api/crew/marco/fitness", json={"status": "unfit", "viewer": "ground"}).json()["by"] == "ground"


def test_escalated_emergency_shows_banner_for_everyone():
    T = 1_800_000_000.0
    import main
    vitals.set_scenario("marco", "deterioration", ramp_s=180, now=T)
    vitals.snapshot(main.crew_doc(), now=T + 60)
    esc = vitals.snapshot(main.crew_doc(), now=T + 60 + vitals.CHECKIN_TIMEOUT_S)
    a = roles.filter_vitals(esc, "lena")["alerts"]
    assert len(a) == 1 and a[0]["text_en"].startswith("Go to Marco now")


def test_commander_note_follows_fitness(client):
    client.put("/api/crew/marco/fitness", json={"status": "limited", "viewer": "noor"})
    marco = next(c for c in client.get("/api/station?viewer=kenji").json()["crew"] if c["id"] == "marco")
    assert marco["note_en"].startswith("Limited duty.")
