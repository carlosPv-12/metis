# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Registros de bienestar en el backend: se guardan, cada uno ve lo suyo y Tierra solo lo que se le envía o el resumen
que esa persona eligió. Cuestionario diario (formato RST de NASA + Samn-Perelli) y PHQ-4 cada 14 días."""
import json

import pytest

import wellbeing

OK = {"sleep_hours": 7, "sleep_quality": 7, "fatigue": 3, "stress": 3, "workload": 5, "crew": 8, "mood": 7}
BAD = {"sleep_hours": 4.5, "sleep_quality": 3, "fatigue": 6, "stress": 8, "workload": 9, "crew": 3, "mood": 2}
PHQ_POS = {"phq_nervous": 2, "phq_worry": 2, "phq_interest": 2, "phq_down": 2}
PHQ_NEG = {"phq_nervous": 0, "phq_worry": 1, "phq_interest": 0, "phq_down": 1}


@pytest.fixture(autouse=True)
def limpio(client):
    client.post("/api/wellbeing/reset")
    yield
    client.post("/api/wellbeing/reset")


def add(client, crew="lena", answers=OK, **kw):
    r = client.post("/api/wellbeing/checkins", json={"crew_id": crew, "answers": answers, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def test_guardar_y_leer_el_propio(client):
    c = add(client, tags=["tired"], note="long EVA prep")
    assert c["shared"] is False and c["note"] == "long EVA prep" and c["instrument"] == "metis_daily_v2"
    assert c["answers"]["sleep_hours"] == 7 and isinstance(c["answers"]["sleep_hours"], int)
    mine = client.get("/api/wellbeing/checkins", params={"crew_id": "lena"}).json()
    assert [x["id"] for x in mine] == [c["id"]] and mine[0]["note"] == "long EVA prep"


def test_horas_de_sueno_con_decimales(client):
    assert add(client, answers=BAD)["answers"]["sleep_hours"] == 4.5


def test_se_guarda_en_disco_y_sobrevive_a_un_reinicio(client):
    c = add(client)
    saved = json.loads(wellbeing.FILE.read_text("utf-8"))
    assert any(x["id"] == c["id"] for x in saved["checkins"])
    wellbeing._state = None                      # como si el backend arrancara de nuevo
    assert wellbeing.get(c["id"])["answers"] == OK


def test_tierra_no_ve_los_privados(client):
    add(client, note="secret")
    assert client.get("/api/wellbeing/checkins", params={"crew_id": "lena", "viewer": "ground"}).json() == []


def test_otro_tripulante_no_puede_leerlos(client):
    add(client)
    for who in ("marco", "noor", "kenji"):          # compañero, CMO y comandante
        for path in ("checkins", "risks", "advice"):
            assert client.get(f"/api/wellbeing/{path}", params={"crew_id": "lena", "viewer": who}).status_code == 403


def test_enviar_a_tierra_sin_nota_y_con_nota(client):
    c = add(client, note="miss my kids", share=True)
    g = client.get("/api/wellbeing/checkins", params={"crew_id": "lena", "viewer": "ground"}).json()
    assert len(g) == 1 and "note" not in g[0] and g[0]["answers"] == OK
    client.post(f"/api/wellbeing/checkins/{c['id']}/share", json={"with_note": True})
    g = client.get("/api/wellbeing/checkins", params={"crew_id": "lena", "viewer": "ground"}).json()
    assert g[0]["note"] == "miss my kids"


def test_enviar_crea_un_paquete_para_el_cirujano_una_sola_vez(client):
    c = add(client, crew="marco", tags=["homesick"])
    def paquetes():
        return [e for e in client.get("/api/station/events").json()
                if e["type"] == "send_flight_surgeon" and (e.get("payload") or {}).get("checkin_id") == c["id"]]
    assert paquetes() == []
    client.post(f"/api/wellbeing/checkins/{c['id']}/share", json={})
    client.post(f"/api/wellbeing/checkins/{c['id']}/share", json={"with_note": True})   # reenviar no duplica
    p = paquetes()
    assert len(p) == 1
    assert p[0]["payload"]["text_en"].startswith("Wellbeing check-in from Marco: sleep 7 h, sleep quality 7/10, fatigue 3/7")
    assert "missing home" in p[0]["payload"]["text_en"]


@pytest.mark.parametrize("answers", [
    {"mood": 4},                                          # faltan preguntas
    {**OK, "fatigue": 8}, {**OK, "fatigue": 0},           # Samn-Perelli es 1-7
    {**OK, "stress": 11}, {**OK, "sleep_hours": -1},      # fuera de escala
    {**OK, "extra": 3},                                   # pregunta que no existe
])
def test_respuestas_invalidas(client, answers):
    assert client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": answers}).status_code in (400, 422)


def test_etiqueta_tripulante_y_cuestionario_desconocidos(client):
    assert client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK, "tags": ["nope"]}).status_code == 400
    assert client.post("/api/wellbeing/checkins", json={"crew_id": "nadie", "answers": OK}).status_code == 404
    assert client.post("/api/wellbeing/checkins", json={"crew_id": "lena", "answers": OK, "instrument": "bdi"}).status_code == 400


def test_phq4_puntuacion_y_cada_14_dias(client):
    assert client.get("/api/wellbeing/instrument", params={"crew_id": "lena"}).json()["phq4_due"] is True
    c = add(client, answers=PHQ_POS, instrument="phq4")
    assert c["scores"] == {"total": 8, "band": "moderate", "gad2": 4, "phq2": 4, "anxiety_positive": True, "mood_positive": True}
    assert client.get("/api/wellbeing/instrument", params={"crew_id": "lena"}).json()["phq4_due"] is False
    assert wellbeing.phq4_due("lena", now_ms=c["ts"] + 14 * 864e5) is True
    with pytest.raises(ValueError):
        wellbeing.validate("phq4", {**PHQ_NEG, "phq_down": 4}, [])          # PHQ-4 es 0-3


def test_consejos_dependen_de_las_respuestas(client):
    good = add(client)["advice"]
    assert [t["code"] for t in good] == ["ok"]
    bad = add(client, answers=BAD, tags=["homesick"])["advice"]
    codes = [t["code"] for t in bad]
    assert len(bad) <= 3 and codes[0] == "fatigue_high" and "ok" not in codes
    assert all(t["source"]["url"].startswith("https://") for t in bad)
    assert "4.5 h" in next(t["en"] for t in bad if t["code"] == "sleep_short")
    flows = [t["flow"] for t in bad if t["flow"]]
    assert len(flows) == len(set(flows))                 # como mucho un consejo por triaje sugerido


def test_phq2_positivo_va_primero_y_ofrece_el_triaje_de_animo(client):
    add(client, answers=PHQ_POS, instrument="phq4")
    tips = client.get("/api/wellbeing/advice", params={"crew_id": "lena"}).json()
    assert tips[0]["code"] == "phq2" and tips[0]["flow"] == "persistent_low_mood"


def test_tierra_recibe_solo_el_resumen_elegido(client):
    add(client, answers=BAD, note="private")             # privado: no se envía
    client.put("/api/wellbeing/share", json={"crew_id": "lena", "level": "signals"})
    g = client.get("/api/wellbeing/risks", params={"crew_id": "lena", "viewer": "ground"}).json()
    assert g["overall"] == "high" and g["areas"] and all(set(a) == {"id", "level"} for a in g["areas"])
    assert "risks" not in g and "answers" not in json.dumps(g) and "private" not in json.dumps(g)
    client.put("/api/wellbeing/share", json={"crew_id": "lena", "level": "summary"})
    g = client.get("/api/wellbeing/risks", params={"crew_id": "lena", "viewer": "ground"}).json()
    assert set(g) == {"crew_id", "share_level", "overall", "trend"}
    client.put("/api/wellbeing/share", json={"crew_id": "lena", "level": "none"})
    g = client.get("/api/wellbeing/risks", params={"crew_id": "lena", "viewer": "ground"}).json()
    assert set(g) == {"crew_id", "share_level", "severe_flag"} and g["severe_flag"] is True


def test_el_propio_tripulante_ve_los_motivos(client):
    add(client, answers=BAD)
    r = client.get("/api/wellbeing/risks", params={"crew_id": "lena"}).json()["risks"]
    fat = next(x for x in r if x["id"] == "fatigue")
    assert fat["level"] == "high" and {"code": "answer", "q": "fatigue", "value": 6} in fat["why"]


def test_nivel_de_lo_que_ve_tierra(client):
    assert client.get("/api/wellbeing/share", params={"crew_id": "kenji"}).json()["level"] == "none"   # valor de partida
    assert client.put("/api/wellbeing/share", json={"crew_id": "kenji", "level": "signals"}).json()["level"] == "signals"
    assert client.get("/api/wellbeing/share", params={"crew_id": "kenji"}).json()["level"] == "signals"
    assert client.put("/api/wellbeing/share", json={"crew_id": "kenji", "level": "todo"}).status_code == 400


def test_se_queda_con_los_ultimos_de_cada_persona(client, monkeypatch):
    monkeypatch.setattr(wellbeing, "MAX_PER_CREW", 3)
    ids = [add(client)["id"] for _ in range(5)]
    add(client, crew="marco")
    mine = [x["id"] for x in client.get("/api/wellbeing/checkins", params={"crew_id": "lena"}).json()]
    assert mine == list(reversed(ids[-3:]))
    assert len(client.get("/api/wellbeing/checkins", params={"crew_id": "marco"}).json()) == 1
