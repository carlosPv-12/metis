# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Reglas de seguridad del árbol de triaje (revisión del 14-nov: investigacion/triaje-revision-flujos-nuevos.md y
investigacion/triaje-y-bienestar-referencias.md). Recorre TODOS los caminos de cada flujo."""
import json, pathlib

import pytest

import voice_answer

TREE = json.loads((pathlib.Path(__file__).resolve().parent.parent / "triage_tree.json").read_text("utf-8"))
FLOWS = TREE["flows"]
MIND = [k for k, f in FLOWS.items() if f.get("group") == "mind"]
RISKY = lambda k: k.startswith("risk") or k == "cc_control"


def paths(f, k=None, acc=()):
    k = k or f["start"]
    n = f["nodes"][k]
    if n["type"] == "result":
        yield [*acc, k]
        return
    for o in n["options"]:
        yield from paths(f, o["next"], (*acc, k))


def test_el_cansancio_tiene_su_flujo_y_no_empieza_por_el_riesgo():
    f = FLOWS["fatigue"]
    assert f["group"] == "mind"
    for p in paths(f):
        if any(RISKY(k) for k in p):
            assert "fa_gate" in p, p            # solo tras la puerta de ánimo


@pytest.mark.parametrize("fid", MIND)
def test_la_pregunta_de_riesgo_nunca_va_primero(fid):
    assert not RISKY(FLOWS[fid]["start"])
    assert "harm" not in FLOWS[fid]["start"]


@pytest.mark.parametrize("fid", MIND)
def test_ningun_naranja_de_salud_mental_sin_cribado(fid):
    for p in paths(FLOWS[fid]):
        end = FLOWS[fid]["nodes"][p[-1]]
        if end["level"] == "naranja" and p[-1] != "fa_orange":    # fa_orange: seguridad operativa (tareas críticas)
            assert any(RISKY(k) for k in p[:-1]), " > ".join(p)


def test_animo_bajo_persistente_siempre_pregunta_por_el_riesgo():
    for p in paths(FLOWS["persistent_low_mood"]):
        assert any(RISKY(k) for k in p), p


def test_conflicto_pregunta_primero_por_el_peligro_fisico():
    f = FLOWS["crew_conflict"]
    assert f["start"] == "cc_danger"
    assert f["nodes"]["threat_now"]["level"] == "rojo"
    assert "Stay with them" not in " ".join(f["nodes"]["threat_now"]["steps_en"])   # no «quédate con quien te amenaza»


@pytest.mark.parametrize("fid", MIND)
def test_prefiero_no_decirlo_se_respeta_sin_aviso_automatico(fid):
    for k, n in FLOWS[fid]["nodes"].items():
        if k.startswith("risk") and n["type"] == "question" and k != "risk_plan":
            skip = next(o for o in n["options"] if o["id"] == "skip")
            res = FLOWS[fid]["nodes"][skip["next"]]
            assert res["type"] == "result" and res["escalate"] is False


@pytest.mark.parametrize("fid", MIND)
def test_intencion_plan_o_duda_es_rojo(fid):
    n = FLOWS[fid]["nodes"].get("risk_plan")
    if not n:
        return
    for o in n["options"]:
        lvl = FLOWS[fid]["nodes"][o["next"]]["level"]
        assert lvl == ("naranja" if o["id"] == "no" else "rojo")


@pytest.mark.parametrize("fid", [k for k, f in FLOWS.items() if "air" in f["nodes"]])
def test_humo_fuego_o_toxico_se_pregunta_antes_que_el_resto(fid):
    f = FLOWS[fid]
    assert f["start"] in ("air", "eye_splash")
    if f["start"] == "eye_splash":
        assert next(o["next"] for o in f["nodes"]["eye_splash"]["options"] if o["id"] == "no") == "air"


def test_salpicadura_quimica_y_quemaduras_quimicas_escalan():
    eye = FLOWS["eye_problem"]["nodes"]
    assert eye[next(o["next"] for o in eye["eye_splash"]["options"] if o["id"] == "si")]["level"] == "rojo"
    assert eye[next(o["next"] for o in eye["eye_kind"]["options"] if o["id"] == "impact")]["level"] == "rojo"
    burn = FLOWS["wound_or_burn"]["nodes"]
    assert burn[next(o["next"] for o in burn["burn_cause"]["options"] if o["id"] == "si")]["level"] == "rojo"


def test_cefalea_tras_eva_escala():
    n = FLOWS["strong_headache"]["nodes"]
    assert n[next(o["next"] for o in n["head_flags"]["options"] if o["id"] == "pressure")]["level"] == "rojo"


@pytest.mark.parametrize("fid", list(FLOWS))
def test_no_estoy_seguro_en_una_alarma_va_al_camino_grave(fid):
    nodes = FLOWS[fid]["nodes"]
    for k, n in nodes.items():
        opts = {o["id"]: o["next"] for o in n.get("options", [])}
        if "unsure" in opts and k != "risk_plan":
            # va a la misma rama que la respuesta más grave (en «¿responde?» es el «no»): la de nivel más alto
            rank = lambda nid: {"rojo": 4, "naranja": 3, "amarillo": 2, "verde": 1}.get(nodes[nid].get("level"), 0)
            assert rank(opts["unsure"]) == max(rank(opts["si"]), rank(opts["no"])) > 0, (fid, k)


@pytest.mark.parametrize("dicho,esperado", [
    ("I'm not sure", "unsure"), ("no lo sé", "unsure"), ("I'd rather not say", "skip"), ("prefiero no decirlo", "skip"),
    ("yes", "si"), ("no", "no"),
])
def test_voz_entiende_no_estoy_seguro_y_prefiero_no_decirlo(dicho, esperado):
    opts = [{"id": "si", "label_en": "Yes", "label_es": "Sí"}, {"id": "no", "label_en": "No", "label_es": "No"},
            {"id": "unsure", "label_en": "Not sure", "label_es": "No estoy seguro"}, {"id": "skip", "label_en": "I'd rather not say", "label_es": "Prefiero no decirlo"}]
    assert voice_answer.match_option(dicho, opts) == esperado


def test_voz_sin_esas_opciones_sigue_pidiendo_repetir():
    yn = [{"id": "si", "label_en": "Yes", "label_es": "Sí"}, {"id": "no", "label_en": "No", "label_es": "No"}]
    assert voice_answer.match_option("I'm not sure", yn) is None
