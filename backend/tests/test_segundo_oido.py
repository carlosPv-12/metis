# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Segundo oído (whisper small) solo para emergencias: cuándo se consulta y cuándo gana. Sin modelos: se simula."""
import pytest
from voice_engine import second_opinion


def small(text, calls=None):
    def f():
        if calls is not None: calls.append(1)
        return text
    return f


@pytest.mark.parametrize("base", ["Marco, have a good day.", "Marco, Chas, Kolaset.", "Meti's, Marco is a love set."])   # 15-nov, voz real
def test_gana_si_ve_la_emergencia_que_base_no_vio(base):
    assert second_opinion(base, "", "en", small("Marco has collapsed.")) == "Marco has collapsed."


def test_no_cambia_nada_si_tampoco_ve_emergencia():
    assert second_opinion("How is the crew?", "", "en", small("How is the crew?")) is None
    assert second_opinion("Meti's, I need help.", "", "en", small("Me, I need help.")) is None     # small pierde «Metis»: manda base


@pytest.mark.parametrize("base,hint,lang", [("", "", "en"), ("[BLANK_AUDIO]", "", "en"), ("Meti's.", "", "en"), ("Yes.", "Yes. No.", "en"),
                                            ("Marco has collapsed.", "", "en"), ("Marco se ha caído", "", "es")])
def test_no_se_consulta_cuando_no_hace_falta(base, hint, lang):
    calls = []
    assert second_opinion(base, hint, lang, small("Marco has collapsed.", calls)) is None and not calls


def test_un_fallo_del_segundo_oido_no_rompe_nada():
    def boom(): raise RuntimeError("sin modelo")
    assert second_opinion("Marco, have a good day.", "", "en", boom) is None
