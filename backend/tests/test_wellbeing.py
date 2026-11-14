# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Registros de bienestar en el backend: se guardan, cada uno ve lo suyo y Tierra solo lo que se le envía."""
import json

import pytest

import wellbeing

OK = {"mood": 4, "energy": 2, "stress": 3, "sleep": 2, "connected": 4}


@pytest.fixture(autouse=True)
def limpio(client):
    client.post("/api/wellbeing/reset")
    yield
    client.post("/api/wellbeing/reset")


def test_guardar_y_leer_el_propio(client):
    r = client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK, "tags": ["tired"], "note": "long EVA prep"})
    assert r.status_code == 200
    c = r.json()
    assert c["shared"] is False and c["note"] == "long EVA prep" and c["instrument"] == wellbeing.INSTRUMENT["id"]
    mine = client.get("/api/wellbeing/checkins", params={"crew_id": "lena"}).json()
    assert [x["id"] for x in mine] == [c["id"]] and mine[0]["note"] == "long EVA prep"


def test_se_guarda_en_disco_y_sobrevive_a_un_reinicio(client):
    c = client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK}).json()
    saved = json.loads(wellbeing.FILE.read_text("utf-8"))
    assert any(x["id"] == c["id"] for x in saved["checkins"])
    wellbeing._state = None                      # como si el backend arrancara de nuevo
    assert wellbeing.get(c["id"])["answers"] == OK


def test_tierra_no_ve_los_privados(client):
    client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK, "note": "secret"})
    assert client.get("/api/wellbeing/checkins", params={"crew_id": "lena", "viewer": "ground"}).json() == []


def test_otro_tripulante_no_puede_leerlos(client):
    client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK})
    for who in ("marco", "noor", "kenji"):          # compañero, CMO y comandante
        assert client.get("/api/wellbeing/checkins", params={"crew_id": "lena", "viewer": who}).status_code == 403


def test_enviar_a_tierra_sin_nota_y_con_nota(client):
    c = client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK, "note": "miss my kids", "share": True}).json()
    g = client.get("/api/wellbeing/checkins", params={"crew_id": "lena", "viewer": "ground"}).json()
    assert len(g) == 1 and "note" not in g[0] and g[0]["answers"] == OK
    client.post(f"/api/wellbeing/checkins/{c['id']}/share", json={"with_note": True})
    g = client.get("/api/wellbeing/checkins", params={"crew_id": "lena", "viewer": "ground"}).json()
    assert g[0]["note"] == "miss my kids"


def test_enviar_crea_un_paquete_para_el_cirujano_una_sola_vez(client):
    c = client.post("/api/wellbeing/checkins", json={"crew_id": "marco", "answers": OK, "tags": ["homesick"]}).json()
    def paquetes():
        return [e for e in client.get("/api/station/events").json()
                if e["type"] == "send_flight_surgeon" and (e.get("payload") or {}).get("checkin_id") == c["id"]]
    assert paquetes() == []
    client.post(f"/api/wellbeing/checkins/{c['id']}/share", json={})
    client.post(f"/api/wellbeing/checkins/{c['id']}/share", json={"with_note": True})   # reenviar no duplica
    p = paquetes()
    assert len(p) == 1
    assert p[0]["payload"]["text_en"].startswith("Wellbeing check-in from Marco: mood 4/5")
    assert "missing home" in p[0]["payload"]["text_en"]


@pytest.mark.parametrize("answers", [
    {"mood": 4},                                      # faltan preguntas
    {**OK, "mood": 6}, {**OK, "mood": 0},             # fuera de escala
    {**OK, "extra": 3},                               # pregunta que no existe
])
def test_respuestas_invalidas(client, answers):
    assert client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": answers}).status_code in (400, 422)


def test_etiqueta_y_tripulante_desconocidos(client):
    assert client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK, "tags": ["nope"]}).status_code == 400
    assert client.post("/api/wellbeing/checkins", json={"crew_id": "nadie", "answers": OK}).status_code == 404


def test_nivel_de_lo_que_ve_tierra(client):
    assert client.get("/api/wellbeing/share", params={"crew_id": "kenji"}).json()["level"] == "none"   # valor de partida
    assert client.put("/api/wellbeing/share", json={"crew_id": "kenji", "level": "signals"}).json()["level"] == "signals"
    assert client.get("/api/wellbeing/share", params={"crew_id": "kenji"}).json()["level"] == "signals"
    assert client.put("/api/wellbeing/share", json={"crew_id": "kenji", "level": "todo"}).status_code == 400


def test_se_queda_con_los_ultimos_de_cada_persona(client, monkeypatch):
    monkeypatch.setattr(wellbeing, "MAX_PER_CREW", 3)
    ids = [client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK}).json()["id"] for _ in range(5)]
    client.post("/api/wellbeing/checkins", json={"crew_id": "marco", "answers": OK})
    mine = [x["id"] for x in client.get("/api/wellbeing/checkins", params={"crew_id": "lena"}).json()]
    assert mine == list(reversed(ids[-3:]))
    assert len(client.get("/api/wellbeing/checkins", params={"crew_id": "marco"}).json()) == 1
