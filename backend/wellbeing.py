# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Registros de bienestar («How I feel»): se guardan a bordo, en el backend, y no solo en el navegador.

Cuestionarios (investigacion/triaje-y-bienestar-referencias.md, sección D):
  · Diario (metis_daily_v2): 7 escalas cortas en el formato del Reaction Self Test que NASA usó en la ISS (escalas de
    0 a 10 de sueño, estrés y carga de trabajo) + fatiga Samn-Perelli de 1 a 7 (USAF, de difusión pública).
    Se interpreta contra la línea base de cada persona, no con cortes clínicos.
  · Cada 14 días: PHQ-4 (Kroenke et al. 2009; Pfizer lo exime de copyright, «free for download and use»).
    PHQ-2 ≥ 3 o GAD-2 ≥ 3 = cribado positivo: se ofrece hablar con el CMO. No es un diagnóstico.

Privacidad (la decide cada tripulante):
  · El propio tripulante ve todos sus registros, con sus notas.
  · Tierra (cirujano de vuelo) solo ve los registros que el tripulante ha enviado, y la nota solo si la incluyó.
  · De lo demás, Tierra recibe como mucho un resumen ya calculado aquí, según el nivel que elija el tripulante
    (none / summary / signals). Nunca las respuestas ni las notas privadas.
  · Nadie más a bordo (comandante, CMO, compañeros) ve los registros: si alguien necesita ayuda, lo pide él.
Se guarda en un JSON fuera del brain (METIS_STATE_DIR, por defecto ~/.local/share/metis/state/)."""
import json, os, pathlib, threading, time, uuid

STATE_DIR = pathlib.Path(os.path.expanduser(os.environ.get("METIS_STATE_DIR", "~/.local/share/metis/state")))
FILE = STATE_DIR / "wellbeing.json"
MAX_PER_CREW = 200
SHARE_LEVELS = ("none", "summary", "signals")
# Cada uno elegiría distinto: valores de partida de los personajes de la demo (los mismos que tenía el frontend).
SHARE_DEFAULT = {"lena": "signals", "marco": "summary", "noor": "summary", "kenji": "none"}

SOURCES = {
    "rst": {"title": "Reaction Self Test on the ISS: 0-10 scales of sleep quality, workload, stress and fatigue (2022)", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197"},
    "samn_perelli": {"title": "Samn & Perelli 1982, USAF School of Aerospace Medicine fatigue checklist (approved for public release)", "url": "https://apps.dtic.mil/sti/pdfs/ADA125319.pdf"},
    "phq4": {"title": "Kroenke et al. 2009, PHQ-4 ultra-brief screener; Pfizer: free for download and use", "url": "https://www.phqscreeners.com/terms"},
    "tb016": {"title": "NASA OCHMO-TB-016 Rev B, Behavioral Health", "url": "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-016-behavioral-health.pdf"},
}

# Cuestionarios activos. Las respuestas se validan contra ellos; cambiarlos aquí cambia lo que acepta la API.
DAILY = {
    "id": "metis_daily_v2", "kind": "daily",
    "note_en": "Daily scales in the format of NASA's in-flight Reaction Self Test, plus the Samn-Perelli fatigue scale. Not a diagnostic test.",
    "sources": ["rst", "samn_perelli"],
    "questions": [
        {"id": "sleep_hours", "min": 0, "max": 14, "en": "How many hours did you sleep last night?", "es": "¿Cuántas horas dormiste anoche?", "low_en": "0 h", "high_en": "14 h"},
        {"id": "sleep_quality", "min": 0, "max": 10, "en": "How well did you sleep?", "es": "¿Qué tal dormiste?", "low_en": "Very badly", "high_en": "Very well", "low_es": "Muy mal", "high_es": "Muy bien"},
        {"id": "fatigue", "min": 1, "max": 7, "en": "How tired do you feel right now?", "es": "¿Cuánto cansancio tienes ahora?",
         "anchors_en": ["Fully alert, wide awake", "Very lively, responsive", "Okay, somewhat fresh", "A little tired, less than fresh",
                        "Moderately tired, let down", "Extremely tired, hard to concentrate", "Completely exhausted"],
         "anchors_es": ["Totalmente despierto y alerta", "Muy activo, con reflejos", "Bien, bastante fresco", "Algo cansado, menos fresco",
                        "Bastante cansado, de bajón", "Muy cansado, cuesta concentrarse", "Totalmente agotado"]},
        {"id": "stress", "min": 0, "max": 10, "en": "How stressed do you feel today?", "es": "¿Cuánto estrés sientes hoy?", "low_en": "Not at all", "high_en": "Extremely", "low_es": "Nada", "high_es": "Muchísimo"},
        {"id": "workload", "min": 0, "max": 10, "en": "How heavy was your workload today?", "es": "¿Cómo de pesada fue hoy tu carga de trabajo?", "low_en": "Very light", "high_en": "Very heavy", "low_es": "Muy ligera", "high_es": "Muy pesada"},
        {"id": "crew", "min": 0, "max": 10, "en": "How are you getting along with the crew today?", "es": "¿Qué tal te llevas hoy con la tripulación?", "low_en": "Very badly", "high_en": "Very well", "low_es": "Muy mal", "high_es": "Muy bien"},
        {"id": "mood", "min": 0, "max": 10, "en": "Overall, how is your mood today?", "es": "En general, ¿qué tal tu ánimo hoy?", "low_en": "Very low", "high_en": "Very good", "low_es": "Muy bajo", "high_es": "Muy bueno"},
    ],
}
PHQ4_OPTS_EN = ["Not at all", "Several days", "More than half the days", "Nearly every day"]
PHQ4_OPTS_ES = ["Nunca", "Varios días", "Más de la mitad de los días", "Casi todos los días"]
PHQ4 = {
    "id": "phq4", "kind": "biweekly", "every_days": 14,
    "note_en": "PHQ-4 (Kroenke et al. 2009). Over the last 2 weeks. Screening only, not a diagnosis.",
    "sources": ["phq4"],
    "intro_en": "Over the last 2 weeks, how often have you been bothered by the following problems?",
    "intro_es": "En las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes problemas?",
    "questions": [
        {"id": "phq_nervous", "min": 0, "max": 3, "en": "Feeling nervous, anxious or on edge", "es": "Sentirte nervioso, ansioso o con los nervios de punta", "anchors_en": PHQ4_OPTS_EN, "anchors_es": PHQ4_OPTS_ES},
        {"id": "phq_worry", "min": 0, "max": 3, "en": "Not being able to stop or control worrying", "es": "No poder dejar de preocuparte o no poder controlar la preocupación", "anchors_en": PHQ4_OPTS_EN, "anchors_es": PHQ4_OPTS_ES},
        {"id": "phq_interest", "min": 0, "max": 3, "en": "Little interest or pleasure in doing things", "es": "Poco interés o placer en hacer las cosas", "anchors_en": PHQ4_OPTS_EN, "anchors_es": PHQ4_OPTS_ES},
        {"id": "phq_down", "min": 0, "max": 3, "en": "Feeling down, depressed or hopeless", "es": "Sentirte decaído, deprimido o sin esperanza", "anchors_en": PHQ4_OPTS_EN, "anchors_es": PHQ4_OPTS_ES},
    ],
}
INSTRUMENTS = {DAILY["id"]: DAILY, PHQ4["id"]: PHQ4}
TAGS = ("homesick", "workload", "crew", "tired", "calm", "focused", "bored", "worried")

_lock = threading.Lock()
_state = None  # {"checkins": [...], "share": {crew_id: level}}


def _load():
    global _state
    if _state is None:
        try:
            _state = json.loads(FILE.read_text("utf-8"))
        except (OSError, ValueError):
            _state = {}
        _state.setdefault("checkins", []); _state.setdefault("share", {})
    return _state


def _save():
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(_state, ensure_ascii=False), "utf-8")
        tmp.replace(FILE)            # escritura atómica: un corte no deja el archivo a medias
    except OSError:
        pass                         # sin disco escribible: sigue en memoria


def reset():
    """Borra todo (tests y modo director)."""
    global _state
    with _lock:
        _state = {"checkins": [], "share": {}}
        _save()


def validate(instrument: str, answers: dict, tags: list):
    ins = INSTRUMENTS.get(instrument)
    if not ins:
        raise ValueError(f"cuestionario desconocido: {instrument}")
    qs = {q["id"]: q for q in ins["questions"]}
    if set(answers) != set(qs):
        raise ValueError(f"respuestas esperadas: {', '.join(qs)}")
    for k, v in answers.items():
        lo, hi = qs[k]["min"], qs[k]["max"]
        if not isinstance(v, (int, float)) or isinstance(v, bool) or not lo <= v <= hi:
            raise ValueError(f"{k}: valor fuera de la escala {lo}-{hi}")
    bad = [t for t in tags if t not in TAGS]
    if bad:
        raise ValueError(f"etiquetas desconocidas: {', '.join(bad)}")


def phq4_scores(answers: dict):
    """PHQ-4: total 0-12; GAD-2 (ansiedad) y PHQ-2 (ánimo) 0-6 cada uno; ≥ 3 = cribado positivo."""
    gad2 = answers["phq_nervous"] + answers["phq_worry"]
    phq2 = answers["phq_interest"] + answers["phq_down"]
    total = gad2 + phq2
    band = "normal" if total <= 2 else "mild" if total <= 5 else "moderate" if total <= 8 else "severe"
    return {"total": total, "band": band, "gad2": gad2, "phq2": phq2, "anxiety_positive": gad2 >= 3, "mood_positive": phq2 >= 3}


def add(crew_id: str, answers: dict, tags: list | None = None, note: str = "", shared: bool = False, note_shared: bool = False,
        instrument: str = DAILY["id"]):
    tags = list(dict.fromkeys(tags or []))
    validate(instrument, answers, tags)
    c = {"id": uuid.uuid4().hex[:12], "ts": int(time.time() * 1000), "crew_id": crew_id, "instrument": instrument,
         "answers": dict(answers), "tags": tags, "note": (note or "").strip()[:2000],
         "shared": bool(shared), "note_shared": bool(shared and note_shared)}
    if instrument == PHQ4["id"]:
        c["scores"] = phq4_scores(answers)
    with _lock:
        s = _load()
        mine = [x for x in s["checkins"] if x["crew_id"] == crew_id]
        if len(mine) >= MAX_PER_CREW:                  # se queda con los últimos de cada persona
            drop = {x["id"] for x in mine[: len(mine) - MAX_PER_CREW + 1]}
            s["checkins"] = [x for x in s["checkins"] if x["id"] not in drop]
        s["checkins"].append(c)
        _save()
    return dict(c)


def get(checkin_id: str):
    with _lock:
        return next((dict(x) for x in _load()["checkins"] if x["id"] == checkin_id), None)


def share(checkin_id: str, with_note: bool = False):
    """El tripulante envía a Tierra un registro que antes era privado. No se puede «des-enviar»."""
    with _lock:
        for x in _load()["checkins"]:
            if x["id"] == checkin_id:
                x["shared"] = True
                x["note_shared"] = x["note_shared"] or bool(with_note)
                _save()
                return dict(x)
    return None


def _for_viewer(c: dict, viewer: str):
    if viewer == c["crew_id"]:
        return dict(c)
    if viewer == "ground" and c["shared"]:
        out = {k: v for k, v in c.items() if k != "note"}
        if c["note_shared"]:
            out["note"] = c["note"]
        return out
    return None


def checkins(crew_id: str, viewer: str):
    """Registros de una persona, del más nuevo al más viejo, filtrados para quien mira."""
    with _lock:
        mine = [x for x in _load()["checkins"] if x["crew_id"] == crew_id]
    return [y for y in (_for_viewer(x, viewer) for x in reversed(mine)) if y]


def _private(crew_id: str):
    """Todos los registros completos de una persona, del más viejo al más nuevo. SOLO para cálculos de este módulo."""
    with _lock:
        return [dict(x) for x in _load()["checkins"] if x["crew_id"] == crew_id]


def phq4_due(crew_id: str, now_ms: int | None = None):
    """¿Toca el PHQ-4? Si nunca se hizo o hace 14 días o más."""
    now_ms = now_ms or int(time.time() * 1000)
    last = next((x for x in reversed(_private(crew_id)) if x["instrument"] == PHQ4["id"]), None)
    return last is None or now_ms - last["ts"] >= PHQ4["every_days"] * 864e5


# ---------- señales: las mismas reglas que computeRisks() de frontend/src/screens/Wellbeing.tsx ----------
RISK_IDS = ("stress", "mood", "fatigue", "sleep", "isolation", "conflict")
RECENT_MS = 3 * 864e5        # un registro diario cuenta 3 días
PHQ_RECENT_MS = 14 * 864e5


def _streak(detail, m, direction):
    b = detail["baseline"][m]; n = 0
    for d in reversed(detail["days"]):
        v = d[m]
        if (v < b["band_low"]) if direction < 0 else (v > b["band_high"]):
            n += 1
        else:
            break
    return n


def risks(detail: dict, crew_id: str, now_ms: int | None = None):
    """Riesgos de bienestar con sus motivos (códigos + valores; el texto lo pone la pantalla).
    detail: el tripulante de data/crew_lena.json (días simulados y banda personal)."""
    now_ms = now_ms or int(time.time() * 1000)
    mine = _private(crew_id)
    daily = next((x for x in reversed(mine) if x["instrument"] == DAILY["id"] and now_ms - x["ts"] < RECENT_MS), None)
    phq = next((x for x in reversed(mine) if x["instrument"] == PHQ4["id"] and now_ms - x["ts"] < PHQ_RECENT_MS), None)
    out = {r: {"score": 0, "why": []} for r in RISK_IDS}
    def add(r, pts, code, **kv): out[r]["score"] += pts; out[r]["why"].append({"code": code, **kv})
    today = detail["days"][-1]
    hrv, rhr, sl = _streak(detail, "hrv_ms", -1), _streak(detail, "resting_hr_bpm", 1), _streak(detail, "sleep_h", -1)
    if hrv: add("stress", 2 if hrv >= 2 else 1, "hrv_low", value=today["hrv_ms"], nights=hrv)
    if rhr: add("stress", 1, "rhr_high", value=today["resting_hr_bpm"])
    if sl:
        add("fatigue", 1, "sleep_low", value=today["sleep_h"], nights=sl)
        add("sleep", 2 if sl >= 2 else 1, "sleep_low", value=today["sleep_h"], nights=sl)
    if today["co2_night_peak_mmhg"] > 3: add("sleep", 1, "co2", value=today["co2_night_peak_mmhg"])
    if daily:
        a, tags = daily["answers"], daily["tags"]
        if a["stress"] >= 7: add("stress", 2, "answer", q="stress", value=a["stress"])
        elif a["stress"] >= 5: add("stress", 1, "answer", q="stress", value=a["stress"])
        if a["workload"] >= 8: add("stress", 1, "answer", q="workload", value=a["workload"])
        if a["mood"] <= 3: add("mood", 2, "answer", q="mood", value=a["mood"])
        elif a["mood"] <= 5: add("mood", 1, "answer", q="mood", value=a["mood"])
        if a["fatigue"] >= 6: add("fatigue", 3, "answer", q="fatigue", value=a["fatigue"])
        elif a["fatigue"] >= 5: add("fatigue", 2, "answer", q="fatigue", value=a["fatigue"])
        if a["sleep_hours"] < 6: add("sleep", 1, "answer", q="sleep_hours", value=a["sleep_hours"])
        if a["sleep_quality"] <= 4: add("sleep", 2, "answer", q="sleep_quality", value=a["sleep_quality"])
        if a["crew"] <= 4: add("conflict", 2, "answer", q="crew", value=a["crew"])
        for t, r in (("workload", "stress"), ("worried", "stress"), ("bored", "mood"), ("tired", "fatigue"), ("homesick", "isolation"), ("crew", "conflict")):
            if t in tags: add(r, 2 if t in ("homesick", "crew") else 1, "tag", tag=t)
    if phq:
        s = phq["scores"]
        if s["mood_positive"]: add("mood", 3, "phq2", value=s["phq2"])
        if s["anxiety_positive"]: add("stress", 3, "gad2", value=s["gad2"])
    lvl = lambda sc: "high" if sc >= 4 else "watch" if sc >= 2 else "low"
    res = [{"id": r, "score": v["score"], "level": lvl(v["score"]), "why": v["why"]} for r, v in out.items()]
    return sorted(res, key=lambda x: -x["score"])


def mood_trend(crew_id: str, detail: dict):
    """Tendencia del ánimo: con registros diarios si hay al menos 4; si no, con el ánimo simulado de los días."""
    vals = [x["answers"]["mood"] / 2 for x in _private(crew_id) if x["instrument"] == DAILY["id"]][-7:]   # 0-10 -> 0-5
    if len(vals) < 4:
        vals = [d["mood_1_5"] for d in detail["days"][-7:]]
    d = (vals[-1] + vals[-2]) / 2 - (vals[0] + vals[1]) / 2
    return "up" if d > .4 else "down" if d < -.4 else "flat"


def ground_summary(crew_id: str, detail: dict):
    """Lo que Tierra puede ver de cómo se siente alguien, según lo que esa persona eligió. Nunca respuestas ni notas."""
    level = share_level(crew_id)
    rs = risks(detail, crew_id)
    overall = "high" if any(r["level"] == "high" for r in rs) else "watch" if any(r["level"] == "watch" for r in rs) else "ok"
    out = {"crew_id": crew_id, "share_level": level}
    if level == "none":
        out["severe_flag"] = overall == "high"        # solo un aviso de riesgo grave, sin detalle
        return out
    out.update(overall=overall, trend=mood_trend(crew_id, detail))
    if level == "signals":
        out["areas"] = [{"id": r["id"], "level": r["level"]} for r in rs if r["level"] != "low"]
    return out


# ---------- consejos de Metis: dependen de las respuestas, las etiquetas y el contexto de a bordo ----------
def advice(detail: dict, crew_id: str, now_ms: int | None = None):
    """Hasta 3 consejos, el más importante primero. Cada uno con su código para que la pantalla ofrezca un triaje."""
    now_ms = now_ms or int(time.time() * 1000)
    mine = _private(crew_id)
    daily = next((x for x in reversed(mine) if x["instrument"] == DAILY["id"] and now_ms - x["ts"] < RECENT_MS), None)
    phq = next((x for x in reversed(mine) if x["instrument"] == PHQ4["id"] and now_ms - x["ts"] < PHQ_RECENT_MS), None)
    today = detail["days"][-1]
    tips = []
    def tip(prio, code, en, es, flow=None, src="tb016"): tips.append({"prio": prio, "code": code, "en": en, "es": es, "flow": flow, "source": SOURCES[src]})
    if phq and phq["scores"]["mood_positive"]:
        tip(10, "phq2", "Your answers point to low mood over the last two weeks. That is worth a private talk with the CMO, or a private psychological conference at the next window.",
            "Tus respuestas apuntan a ánimo bajo en las dos últimas semanas. Merece una charla privada con el CMO, o una conferencia psicológica privada en la próxima ventana.",
            "persistent_low_mood", "phq4")
    if phq and phq["scores"]["anxiety_positive"]:
        tip(9, "gad2", "Your answers point to a lot of worry over the last two weeks. Talking it through with the CMO or the psychologist can help; you do not have to wait for it to get worse.",
            "Tus respuestas apuntan a mucha preocupación en las dos últimas semanas. Hablarlo con el CMO o con el psicólogo puede ayudar; no hace falta esperar a que empeore.",
            "anxiety_panic", "phq4")
    if daily:
        a, tags = daily["answers"], daily["tags"]
        if a["fatigue"] >= 6:
            tip(8, "fatigue_high", "You rated yourself very tired. Tell the commander before any safety-critical task today, and protect tonight's sleep.",
                "Te has puesto muy cansado. Avisa al comandante antes de cualquier tarea crítica hoy y protege el sueño de esta noche.", "fatigue", "samn_perelli")
        if a["sleep_hours"] < 6:
            tip(7, "sleep_short", f"You slept {a['sleep_hours']:g} h. On the ISS, under 6 hours was linked to slower reactions: ask for a second check on critical steps and protect your next sleep period.",
                f"Dormiste {a['sleep_hours']:g} h. En la ISS, dormir menos de 6 horas se asoció a reflejos más lentos: pide una segunda comprobación en los pasos críticos y protege tu próximo descanso.",
                "cant_sleep", "rst")
        if a["sleep_quality"] <= 4 and today["co2_night_peak_mmhg"] > 3:
            tip(7, "sleep_co2", f"You slept badly and the bunk CO2 peaked at {today['co2_night_peak_mmhg']:.2f} mmHg, above 3. Ask the crew to check the airflow and the scrubber in the quarters.",
                f"Dormiste mal y el CO2 de la litera llegó a {today['co2_night_peak_mmhg']:.2f} mmHg, por encima de 3. Pide a la tripulación que revise la ventilación y el filtro de los camarotes.", "cant_sleep")
        if a["stress"] >= 7:
            tip(6, "stress_high", "High stress today. Try two minutes of slow breathing (in 4, hold 4, out 6) and split the next task into small steps.",
                "Mucho estrés hoy. Prueba dos minutos de respiración lenta (inspira 4, aguanta 4, suelta 6) y divide la siguiente tarea en pasos pequeños.", "anxiety_panic")
        if a["workload"] >= 8:
            tip(5, "workload_high", "Your workload was very heavy. Tell the commander now; schedules can be adjusted before it becomes a safety issue.",
                "Tu carga de trabajo fue muy pesada. Díselo ya al comandante; el horario se puede ajustar antes de que sea un problema de seguridad.", "fatigue", "rst")
        if a["workload"] <= 2 and "bored" in tags:
            tip(4, "monotony", "Long quiet stretches wear people down too. Pick one task with meaning for you today, or a shared activity with the crew.",
                "Las rachas largas y tranquilas también desgastan. Elige hoy una tarea con sentido para ti, o una actividad con la tripulación.")
        if a["crew"] <= 4 or "crew" in tags:
            tip(6, "crew", "Things are tense with the crew. Talk about the task, not the person, and take a pause before answering. I can help you prepare what to say.",
                "Hay tensión con la tripulación. Habla de la tarea, no de la persona, y haz una pausa antes de contestar. Puedo ayudarte a preparar qué decir.", "crew_conflict")
        if "homesick" in tags:
            tip(5, "homesick", "Missing home is normal this far away. Plan a private family conference or record a message; slow replies are the link delay, not a lack of care.",
                "Echar de menos casa es normal tan lejos. Planea una conferencia familiar privada o graba un mensaje; que tarden en contestar es el retraso del enlace, no falta de cariño.", "isolation_homesickness")
        if a["mood"] <= 3:
            tip(6, "mood_low", "A low day. Plan one small thing you enjoy, and spend some time at the window or under the bright light panel.",
                "Un día bajo. Planea una cosa pequeña que te guste y pasa un rato en la ventana o bajo el panel de luz.", "persistent_low_mood")
    if not tips:
        tip(0, "ok", "Thanks for checking in. Keep the routines that are working for you.", "Gracias por registrarlo. Mantén las rutinas que te están funcionando.")
    tips.sort(key=lambda t: -t["prio"])
    seen, out = set(), []
    for t in tips:                  # un consejo por triaje sugerido, como mucho 3
        if t["flow"] and t["flow"] in seen: continue
        seen.add(t["flow"]); out.append({k: v for k, v in t.items() if k != "prio"})
    return out[:3]


Q_LABEL = {"sleep_hours": ("sleep", "sueño"), "sleep_quality": ("sleep quality", "calidad del sueño"), "fatigue": ("fatigue", "cansancio"),
           "stress": ("stress", "estrés"), "workload": ("workload", "carga de trabajo"), "crew": ("crew relations", "relación con la tripulación"),
           "mood": ("mood", "ánimo"), "phq_nervous": ("nervous", "nervios"), "phq_worry": ("worry", "preocupación"),
           "phq_interest": ("little interest", "poco interés"), "phq_down": ("feeling down", "decaimiento")}
TAG_LABEL = {"homesick": ("missing home", "echo de menos casa"), "workload": ("workload", "carga de trabajo"),
             "crew": ("crew relations", "relación con la tripulación"), "tired": ("tired", "cansancio"), "calm": ("calm", "tranquilidad"),
             "focused": ("focused", "concentración"), "bored": ("monotony", "monotonía"), "worried": ("worried", "preocupación")}


def text(c: dict, name: str):
    """Texto del paquete para el cirujano de vuelo (EN, ES). La nota solo va si el tripulante la incluyó."""
    ins = INSTRUMENTS[c["instrument"]]
    qs = {q["id"]: q for q in ins["questions"]}
    out = []
    for i, (head, on_mind, note_l) in enumerate((("Wellbeing check-in from", "On my mind", "Note"),
                                                 ("Registro de bienestar de", "Lo que tengo en la cabeza", "Nota"))):
        if c["instrument"] == PHQ4["id"]:
            s = c.get("scores") or phq4_scores(c["answers"])
            parts = f"PHQ-4 {s['total']:g}/12 ({s['band']}), PHQ-2 {s['phq2']:g}/6, GAD-2 {s['gad2']:g}/6"
        else:
            parts = ", ".join((f"{Q_LABEL[q][i]} {v:g} h" if q == "sleep_hours" else f"{Q_LABEL.get(q, (q, q))[i]} {v:g}/{qs[q]['max']}")
                              for q, v in c["answers"].items())
        tags = f". {on_mind}: {', '.join(TAG_LABEL.get(t, (t, t))[i] for t in c['tags'])}" if c["tags"] else ""
        note = f". {note_l}: “{c['note']}”" if c.get("note_shared") and c.get("note") else ""
        out.append(f"{head} {name}: {parts}{tags}{note}")
    return tuple(out)


def share_level(crew_id: str) -> str:
    with _lock:
        return _load()["share"].get(crew_id) or SHARE_DEFAULT.get(crew_id, "summary")


def set_share_level(crew_id: str, level: str):
    if level not in SHARE_LEVELS:
        raise ValueError(f"nivel desconocido: {level}")
    with _lock:
        _load()["share"][crew_id] = level
        _save()
    return level
