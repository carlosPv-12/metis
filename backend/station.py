# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Centralita (cuadro de mandos del hábitat), registro de eventos en memoria y grafo de conocimiento.
Todo es SIMULADO salvo las fuentes citadas. Sin base de datos: al reiniciar se pierden los eventos."""
import datetime, itertools, os, random, threading

import mission

RANGE_MAX_S = 1200
COMMS_SOURCES = [
    {"title": "NASA HRP, Hazard: Distance from Earth (challenge Resources): communication delay of up to 20 minutes one way",
     "url": "https://www.nasa.gov/hrp/hazard-distance-from-earth/", "verified": True, "primary": True},
    {"title": "NASA HRP, HERA crew navigates communication delays (analog: up to five minutes each way)",
     "url": "https://www.nasa.gov/image-article/houston-do-you-copy-hera-crew-navigates-communication-delays-2/", "verified": True, "primary": False},
    {"title": "Hinkelbein et al. 2020, CPR in microgravity guideline, Recommendation 21: Mars time delay 3-23 min",
     "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7607644/", "verified": True, "primary": False},
]
METRIC_LABEL = {"resting_hr_bpm": ("resting heart rate", "pulso en reposo"), "hrv_ms": ("heart-rate variability (HRV)", "variabilidad cardiaca (VFC)"),
                "sleep_h": ("sleep", "sueño"), "co2_night_peak_mmhg": ("bunk CO2 at night", "CO2 nocturno de la litera"), "mood_1_5": ("mood", "ánimo")}


def streaks(c):
    """Noches seguidas (hasta hoy) fuera de la banda personal, por métrica. Calculado de los datos, no a mano."""
    out = {}
    for m, b in c["baseline"].items():
        k = 0
        for d in reversed(c["days"]):
            if b["band_low"] <= d[m] <= b["band_high"]:
                break
            k += 1
        if k:
            out[m] = k
    return out


def _n(k, lang):
    if lang == "en":
        return "1 night" if k == 1 else f"{k} nights in a row"
    return "1 noche" if k == 1 else f"{k} noches seguidas"


def baseline_text(c, lang):
    st = streaks(c)
    parts = [f"{METRIC_LABEL[m][0 if lang == 'en' else 1]} ({_n(k, lang)})" for m, k in sorted(st.items(), key=lambda x: -x[1])]
    if not parts:
        return f"{c['name']}: within personal baseline" if lang == "en" else f"{c['name']}: dentro de su línea base personal"
    return (f"{c['name']}: outside personal band: " if lang == "en" else f"{c['name']}: fuera de su banda personal: ") + "; ".join(parts)


MMHG_TO_PPM = 1e6 / 760.0  # supone presión total de cabina de 760 mmHg (1 atm); conversión nuestra, no de NASA

LOCATION = {"lena": "Crew quarters", "marco": "Lab", "noor": "Galley", "kenji": "Node"}
EXTRA_CREW = {  # tripulantes 3 y 4 de respaldo, por si crew_lena.json aún no los trae
    "noor": {"name": "Noor", "role_en": "Crew Medical Officer (fictional)", "role_es": "Oficial médica de tripulación (ficticia)", "hr": 61, "sleep_h": 6.4},
    "kenji": {"name": "Kenji", "role_en": "Commander (fictional)", "role_es": "Comandante (ficticio)", "hr": 57, "sleep_h": 6.2},
}
MEDKIT = [  # equipo citado en la guía de RCP en microgravedad; cantidades simuladas; sin fármacos inventados
    ("aed", "AED (automated external defibrillator)", "Desfibrilador externo automático (DEA)", 1, 1, "Hinkelbein 2020, Rec. 11"),
    ("aed_pads", "AED pads, long shelf-life (spare sets)", "Parches del DEA de larga caducidad (juegos de repuesto)", 3, 2, "Hinkelbein 2020, Rec. 11"),
    ("cmrs", "Crew Medical Restraint System", "Sistema de sujeción médica de tripulación", 1, 1, "Hinkelbein 2020, Rec. 3, 8, 10"),
    ("sga", "Supraglottic airway device", "Dispositivo supraglótico para vía aérea", 2, 1, "Hinkelbein 2020, Rec. 6"),
    ("suction", "Manual suction device", "Aspirador manual", 1, 1, "Hinkelbein 2020, Rec. 9"),
    ("pulse_ox", "Pulse oximeter", "Pulsioxímetro", 2, 1, "simulated"),
    ("bp_cuff", "Blood pressure cuff", "Tensiómetro", 1, 1, "simulated"),
    ("med_pack", "Medication pack (contents per flight surgeon list)", "Paquete de medicación (contenido según la lista del cirujano de vuelo)", 1, 1, "simulated; contents not modeled"),
]

_events = []
_ids = itertools.count(1)
_lock = threading.Lock()


def _now():
    return datetime.datetime.now(datetime.timezone.utc)


def _iso(t):
    return t.isoformat(timespec="seconds")


DEFAULT_TEXT = {
    "surgeon_notice": ("Notice to the flight surgeon queued (delayed link)", "Aviso al cirujano de vuelo en cola (enlace con retraso)"),
    "triage_summary": ("Triage summary sent to the flight surgeon", "Resumen de triaje enviado al cirujano de vuelo"),
    "triage_started": ("Triage started", "Triaje iniciado"),
    "triage_result": ("Triage result reached", "Triaje completado"),
    "cmo_alert": ("Crew Medical Officer alerted", "Oficial médico de tripulación avisado"),
    "crew_alert": ("Crew alerted", "Tripulación avisada"),
    "earth_message": ("Message to Earth queued", "Mensaje a Tierra en cola"),
}


def add_event(type_, crew_id=None, payload=None, text_en=None, text_es=None):
    payload = dict(payload or {})
    den, des = DEFAULT_TEXT.get(type_, (type_.replace("_", " "), type_.replace("_", " ")))
    text_en = text_en or payload.get("text_en") or den
    text_es = text_es or payload.get("text_es") or des
    t = _now()
    ev = {"id": next(_ids), "ts": _iso(t), "type": type_, "crew_id": crew_id, "payload": payload,
          "text_en": text_en, "text_es": text_es}
    if type_ in TO_EARTH or type_ in TO_SHIP:
        d = payload.get("delay_s", mission.delay_s())     # retraso del entorno elegido; None = sin enlace
        ev["direction"] = "to_earth" if type_ in TO_EARTH else "to_ship"
        if d is None:
            ev["queued"] = True                              # sin enlace: espera en cola hasta que vuelva
        else:
            _send(ev, t, float(d))
    with _lock:
        _events.append(ev)
        del _events[:-300]
    return _with_countdown(ev)


TO_EARTH = ("surgeon_notice", "triage_summary", "earth_message", "send_flight_surgeon")
TO_SHIP = ("surgeon_reply", "ground_message")          # de Tierra a la nave: mismo retraso, misma cola sin enlace


def _send(ev, t, d):
    ev["delay_s"] = d
    ev["sent_ts"] = _iso(t)
    ev["arrives_ts"] = _iso(t + datetime.timedelta(seconds=d))
    ev["reply_earliest_ts"] = _iso(t + datetime.timedelta(seconds=2 * d))


def release_queued():
    """Vuelve el enlace: los paquetes en cola salen ahora, con el retraso del nuevo entorno."""
    d = mission.delay_s()
    if d is None:
        return 0
    t, n = _now(), 0
    with _lock:
        for ev in _events:
            if ev.pop("queued", False):
                _send(ev, t, d); n += 1
    return n


def _with_countdown(ev):
    if ev.get("queued"):
        return {**ev, "status": "queued_no_link", "arrives_in_s": None, "reply_in_s": None}
    if "arrives_ts" not in ev:
        return ev
    now = _now()
    a = datetime.datetime.fromisoformat(ev["arrives_ts"]); r = datetime.datetime.fromisoformat(ev["reply_earliest_ts"])
    e = dict(ev)
    e["arrives_in_s"] = max(0, int((a - now).total_seconds()))
    e["reply_in_s"] = max(0, int((r - now).total_seconds()))
    if ev.get("direction") == "to_ship":
        e["status"] = "in_transit" if e["arrives_in_s"] > 0 else "delivered"
        e["reply_in_s"] = None
        return e
    e["status"] = "in_transit" if e["arrives_in_s"] > 0 else ("delivered_awaiting_reply" if e["reply_in_s"] > 0 else "reply_window_open")
    return e


def mark(event_id, **fields):
    """Anota algo en un evento ya guardado (p. ej. que la aptitud de una respuesta ya se aplicó)."""
    with _lock:
        for ev in _events:
            if ev["id"] == event_id:
                ev.setdefault("payload", {}).update(fields)
                return True
    return False


def events():
    with _lock:
        return [_with_countdown(e) for e in reversed(_events)]


def seed(crew_doc):
    if _events:
        return
    lena = crew_doc["crew"].get("lena")
    add_event("daily_check", "lena", {}, "Metis daily check-in with Lena completed", "Metis completó el chequeo diario con Lena")
    if lena and lena["today_out_of_band"]:
        add_event("baseline_alert", "lena", {"metrics": lena["today_out_of_band"], "nights": streaks(lena)},
                  baseline_text(lena, "en"), baseline_text(lena, "es"))


def station(crew_doc):
    rng = random.Random(112)
    crew = []
    for cid, c in crew_doc["crew"].items():
        t = c["days"][-1]
        oob = c["today_out_of_band"]
        crew.append({"id": cid, "name": c["name"], "role": c["role"], "role_en": c.get("role_en", c["role"]), "role_es": c["role"],
                     "status": "watch" if len(oob) >= 2 else ("ok" if not oob else "watch"), "location": LOCATION.get(cid, "Lab"),
                     "hr": t["resting_hr_bpm"], "sleep_h": t["sleep_h"], "alerts": oob, "simulated": True,
                     "note_en": (f"{len(oob)} metrics outside personal band" if oob else "Within personal baseline"),
                     "note_es": (f"{len(oob)} métricas fuera de su banda personal" if oob else "Dentro de su línea base personal")})
    for cid, c in EXTRA_CREW.items():
        if cid in crew_doc["crew"]:  # ya tiene datos completos en crew_lena.json: no duplicar
            continue
        crew.append({"id": cid, "name": c["name"], "role": c["role_es"], "role_en": c["role_en"], "role_es": c["role_es"], "status": "ok",
                     "location": "Node" if cid == "kenji" else "Galley", "hr": c["hr"], "sleep_h": c["sleep_h"], "alerts": [], "simulated": True,
                     "note_en": "Within personal baseline (simple generated data)", "note_es": "Dentro de su línea base personal (datos generados sencillos)"})
    lena = crew_doc["crew"].get("lena")
    bunk = lena["days"][-1]["co2_night_peak_mmhg"] if lena else 2.4
    env = []
    for mod_en, mod_es, co2 in (("Crew quarters (bunks)", "Camarotes (literas)", bunk), ("Galley", "Cocina", 2.1), ("Lab", "Laboratorio", 2.3), ("Node", "Nodo", 1.9)):
        env.append({"module": mod_en, "module_en": mod_en, "module_es": mod_es, "co2_mmhg": round(co2, 2), "co2_ppm": int(round(co2 * MMHG_TO_PPM, -1)),
                    "temp_c": round(rng.uniform(21.5, 23.5), 1), "rh_pct": int(rng.uniform(38, 52)), "simulated": True,
                    "over_limit": co2 > 3.0})
    alerts = []
    if lena and lena["today_out_of_band"]:
        alerts.append({"id": "lena_baseline", "level": "watch", "crew_id": "lena",
                       "text_en": baseline_text(lena, "en"), "text_es": baseline_text(lena, "es"), "nights": streaks(lena)})
    for e in env:
        if e["over_limit"]:
            alerts.append({"id": "co2_" + e["module_en"].split()[0].lower(), "level": "watch", "crew_id": None,
                           "text_en": f"{e['module_en']}: night CO2 peak {e['co2_mmhg']} mmHg, above the 3 mmHg design limit (1-hour average)",
                           "text_es": f"{e['module_es']}: pico nocturno de CO2 de {e['co2_mmhg']} mmHg, por encima del límite de diseño de 3 mmHg (media de 1 h)"})
    headsets = [{"crew_id": c["id"], "name": "Metis earpiece", "battery_pct": b, "link": l, "worn": w, "simulated": True}
                for c, (b, l, w) in zip(crew, [(78, "ok", True), (64, "ok", True), (91, "ok", True), (23, "weak", False)])]
    medkit = [{"id": i, "item_en": en, "item_es": es, "item": en, "qty": q, "min": m, "low": q < m, "source": s, "simulated": True}
              for i, en, es, q, m, s in MEDKIT]
    ev = events()
    packet = next((e for e in ev if "arrives_ts" in e or e.get("queued")), None)
    m = mission.get()
    d = m["one_way_delay_s"]
    return {"mission_day": lena["days"][-1]["mission_day"] if lena else 112, "simulated": True, "crew": crew, "alerts": alerts,
            "environment": env, "co2_unit_note": "ppm = mmHg / 760 x 1e6, assuming 760 mmHg cabin pressure (our conversion)",
            # one_way_delay_s sigue siendo un número (0 sin enlace) para no romper pantallas; «link» dice si hay enlace.
            "comms": {"one_way_delay_s": d if d is not None else 0, "round_trip_s": 2 * d if d is not None else 0, "link": m["link"],
                      "env": m["env"], "env_label_en": m["label_en"], "env_label_es": m["label_es"],
                      "scenario_en": f"{m['label_en']}, mission day 112. {m['note_en']} (NASA HRP: up to 20 minutes one way on a Mars mission)",
                      "scenario_es": f"{m['label_es']}, día 112. {m['note_es']} (NASA HRP: hasta 20 minutos por sentido en una misión a Marte)",
                      "range_max_s": RANGE_MAX_S, "scenario_value": True, "mars_range_min": [3, 23], "sources": COMMS_SOURCES},
            "headsets": headsets, "medkit": medkit, "packet": packet, "events": ev[:20]}


def graph(crew_doc, tree):
    N, E = [], []
    def n(i, t, en, es): N.append({"id": i, "type": t, "label_en": en, "label_es": es})
    def e(s, t, r): E.append({"source": s, "target": t, "relation": r})
    n("station", "hub", "Habitat hub (station console)", "Centralita del hábitat")
    n("earth", "ground", "Earth: flight surgeon", "Tierra: cirujano de vuelo")
    e("station", "earth", "delayed_link")
    people = [(cid, c["name"]) for cid, c in crew_doc["crew"].items()] + [(k, v["name"]) for k, v in EXTRA_CREW.items() if k not in crew_doc["crew"]]
    for cid, name in people:
        n(f"crew:{cid}", "crew", name, name)
        n(f"earpiece:{cid}", "device", f"{name}'s Metis earpiece", f"Auricular Metis de {name}")
        n(f"metis:{cid}", "ai", f"Metis ({name})", f"Metis ({name})")
        e(f"crew:{cid}", f"earpiece:{cid}", "wears"); e(f"earpiece:{cid}", f"metis:{cid}", "talks_to")
        e(f"metis:{cid}", f"crew:{cid}", "learns_baseline_of"); e(f"metis:{cid}", "station", "syncs_with")
    e("crew:noor", "station", "is_cmo_for")
    for i, en, es in (("sym:chest_pain", "Chest pain or pressure", "Dolor u opresión torácica"), ("sym:collapse", "Collapse", "Desplome"),
                      ("sym:short_sleep", "Short sleep", "Sueño corto"), ("sym:high_co2", "High cabin CO2", "CO2 de cabina alto"),
                      ("sym:headache", "Headache", "Cefalea"), ("sym:fatigue", "Fatigue", "Fatiga"), ("sym:high_rhr", "Resting HR above baseline", "Pulso en reposo sobre la línea base")):
        n(i, "symptom", en, es)
    for fid, f in tree["flows"].items():
        n(f"protocol:{fid}", "protocol", f["title_en"], f["title_es"])
        srcs = {s for nd in f["nodes"].values() for s in nd.get("sources", [])}
        for s in srcs:
            e(f"protocol:{fid}", f"src:{s}", "cites")
    e("sym:collapse", "protocol:companion_collapse", "triggers"); e("sym:chest_pain", "protocol:self_chest_pressure", "triggers")
    e("sym:chest_pain", "protocol:companion_collapse", "triggers")
    e("sym:high_co2", "sym:headache", "may_cause"); e("sym:high_co2", "sym:fatigue", "may_cause"); e("sym:high_co2", "sym:short_sleep", "may_worsen")
    e("sym:high_co2", "src:co2_tb004", "evidence"); e("sym:short_sleep", "src:sleep_barger", "evidence")
    lena = crew_doc["crew"].get("lena", {})
    for m, s in (("sleep_h", "sym:short_sleep"), ("co2_night_peak_mmhg", "sym:high_co2"), ("resting_hr_bpm", "sym:high_rhr")):
        if m in lena.get("today_out_of_band", []):
            e("metis:lena", s, "flags")
    for i, en, es, *_ in MEDKIT:
        n(f"med:{i}", "medication" if i == "med_pack" else "equipment", en, es)
        e("station", f"med:{i}", "stocks")
    for i in ("aed", "aed_pads", "cmrs", "sga", "suction"):
        e("protocol:companion_collapse", f"med:{i}", "uses")
    e("protocol:self_chest_pressure", "med:pulse_ox", "uses"); e("protocol:companion_collapse", "med:med_pack", "only_via_flight_surgeon")
    for s, v in tree["sources"].items():
        n(f"src:{s}", "source", v["title"], v["title"])
    n("src:hrp_hazards", "source", "NASA HRP, 5 Hazards of Human Spaceflight (Resources tab)", "NASA HRP, 5 peligros del vuelo espacial (pestaña Resources)")
    n("src:osd569", "source", "NASA OSDR OSD-569, Inspiration4 blood counts (real data)", "NASA OSDR OSD-569, hemogramas de Inspiration4 (datos reales)")
    e("earth", "src:hrp_hazards", "distance_hazard"); e("metis:lena", "src:osd569", "blood_baseline_demo")
    e("sym:high_rhr", "src:hrp_cardiac", "evidence"); e("station", "src:std3001_v1", "requires_2_cmos")
    return {"nodes": N, "edges": E, "simulated": True}
