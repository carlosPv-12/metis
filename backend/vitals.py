# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Constantes en directo del auricular y avisos tempranos. TODO SIMULADO (no hay prototipo del auricular).

Qué mide (concepto): PPG en el oído -> pulso, SpO2 y frecuencia respiratoria; temperatura en el oído; acelerómetro
-> actividad. Fuente de viabilidad: investigacion/auricular-viabilidad.md del brain (el PPG del oído sirve para
TENDENCIAS EN REPOSO y para detectar ausencia de pulso; con movimiento falla hasta un ~30 %).

Cómo decide (reglas fijas, sin IA): NASA-STD-3001 Vol. 1 no da umbrales numéricos de aviso para pulso, HRV ni
SpO2 (investigacion/umbrales-nasa-verificados.md), así que Metis compara a cada persona CONSIGO MISMA:
  · pulso que sube de forma sostenida en reposo (pendiente) antes de salirse de la banda  -> aviso temprano
  · pulso por encima de su banda (media + 2 DE de su línea base)                         -> vigilar
  · respiración o SpO2 fuera de su banda personal                                      -> vigilar
  · dos o más señales a la vez                                                          -> aviso
  · sin pulso                                                                           -> alarma
Con actividad (ejercicio) no se avisa de pulso ni respiración: es normal y el sensor no es fiable.
Las series se calculan en función del tiempo (deterministas), así no hace falta guardar nada."""
import math, threading, time, zlib

import station

STEP_S = 10            # una muestra cada 10 s
WINDOW_S = 600         # 10 min de historia
DEFAULT_RAMP_S = 180   # «Marco empeora» tarda 3 min en llegar al máximo (corto, para el pitch)

# Líneas base de lo que el auricular mediría en reposo. Pulso: de data/crew_lena.json (Lena, Marco) o station.EXTRA_CREW.
# Respiración, SpO2 y temperatura: SUPUESTOS DEL PROTOTIPO por persona (no hay datos reales de vuelo).
ASSUMED = {"rr_brpm": (14.0, 1.2), "spo2_pct": (97.8, 0.6), "temp_c": (36.7, 0.15)}
LABEL = {"hr_bpm": ("heart rate", "pulso", "bpm"), "rr_brpm": ("breathing rate", "respiración", "breaths/min"),
         "spo2_pct": ("blood oxygen (SpO2)", "oxígeno en sangre (SpO2)", "%"), "temp_c": ("ear temperature", "temperatura del oído", "°C")}

_scen: dict[str, dict] = {}       # crew_id -> {"kind", "t0", "ramp_s"}
_announced: set[tuple] = set()    # avisos ya enviados como evento a la centralita
_lock = threading.Lock()

# Protocolo de aviso (lo pidió Carlos el 14-nov): PRIMERO la persona afectada, en su auricular, con qué hacer.
# Solo si no contesta en CHECKIN_TIMEOUT_S, pide ayuda o pierde el pulso, Metis avisa a la tripulación y les dice qué
# hacer, sin preguntar a nadie. Vive en el backend: funciona aunque el auricular del afectado no esté abierto.
CHECKIN_TIMEOUT_S = int(__import__("os").environ.get("METIS_CHECKIN_TIMEOUT_S", "30"))
RANK = {"watch": 1, "warning": 2, "alarm": 3}
_checks: dict[str, dict] = {}     # crew_id -> estado del «¿estás bien?»


def _noise(cid, metric, k):
    """Ruido determinista en [-1, 1] (mismo instante -> mismo valor)."""
    return (zlib.crc32(f"{cid}:{metric}:{k}".encode()) % 2001) / 1000.0 - 1.0


def baselines(crew_doc):
    out = {}
    for cid, c in crew_doc["crew"].items():
        b = c["baseline"]["resting_hr_bpm"]
        out[cid] = {"name": c["name"], "hr_bpm": (b["mean"], b["sd"])}
    for cid, c in station.EXTRA_CREW.items():
        out[cid] = {"name": c["name"], "hr_bpm": (float(c["hr"]), 2.0)}
    for cid in out:
        out[cid].update(ASSUMED)
    return out


def sample(cid, base, t):
    """Lo que mediría el auricular de `cid` en el instante t (s)."""
    k = int(t // STEP_S)
    sc = _scen.get(cid, {})
    kind = sc.get("kind", "normal")
    p = 0.0
    if kind in ("deterioration", "collapse"):
        p = min(1.0, max(0.0, (t - sc["t0"]) / sc.get("ramp_s", DEFAULT_RAMP_S)))
    hr_m, hr_sd = base["hr_bpm"]
    s = {"t": int(k * STEP_S), "activity": 0, "pulse": True,
         "hr_bpm": round(hr_m + 0.8 * hr_sd * _noise(cid, "hr", k) + 0.5 * hr_sd * math.sin(k / 7), 1),
         "rr_brpm": round(ASSUMED["rr_brpm"][0] + 0.8 * _noise(cid, "rr", k), 1),
         "spo2_pct": round(min(100.0, ASSUMED["spo2_pct"][0] + 0.4 * _noise(cid, "spo2", k)), 1),
         "temp_c": round(ASSUMED["temp_c"][0] + 0.08 * _noise(cid, "temp", k), 2)}
    if kind == "exercise" and t >= sc["t0"]:
        s.update(activity=2, hr_bpm=round(hr_m + 55 + 4 * _noise(cid, "hrx", k), 1), rr_brpm=round(28 + 2 * _noise(cid, "rrx", k), 1))
    elif kind == "deterioration" and t >= sc["t0"]:
        s["hr_bpm"] = round(s["hr_bpm"] + 32 * p, 1)       # p. ej. Marco de ~62 a ~94 lpm en reposo
        s["rr_brpm"] = round(s["rr_brpm"] + 11 * p, 1)     # de ~14 a ~25 respiraciones/min
        s["spo2_pct"] = round(s["spo2_pct"] - 4.5 * p, 1)  # de ~98 a ~93 %
        s["temp_c"] = round(s["temp_c"] + 0.2 * p, 2)
    elif kind == "collapse" and t >= sc["t0"]:
        s.update(pulse=False, hr_bpm=0.0, rr_brpm=0.0, spo2_pct=None)
    return s


def series(cid, base, now, window_s=WINDOW_S):
    t_end = int(now // STEP_S) * STEP_S
    return [sample(cid, base, t) for t in range(t_end - window_s + STEP_S, t_end + 1, STEP_S)]


def _median(xs):
    xs = sorted(x for x in xs if x is not None)
    return xs[len(xs) // 2] if xs else None


def _slope_per_min(pts):
    """Pendiente por mínimos cuadrados, en unidades por minuto."""
    pts = [(t, v) for t, v in pts if v is not None]
    if len(pts) < 3:
        return 0.0
    n = len(pts); mt = sum(t for t, _ in pts) / n; mv = sum(v for _, v in pts) / n
    den = sum((t - mt) ** 2 for t, _ in pts)
    return 0.0 if den == 0 else 60 * sum((t - mt) * (v - mv) for t, v in pts) / den


def assess(cid, base, ser):
    """Reglas fijas sobre la serie de una persona. Devuelve (estado, avisos)."""
    name = base["name"]
    last2 = ser[-6:]    # último minuto (mediana: un pico suelto no basta)
    now = ser[-1]
    if not now["pulse"]:
        return "alarm", [{"rule": "no_pulse", "level": "alarm", "metrics": ["hr_bpm"],
                          "summary_en": "no pulse detected on the earpiece", "summary_es": "el auricular no detecta pulso",
                          "text_en": f"No pulse detected on {name}'s earpiece. Check on {name} now.",
                          "text_es": f"El auricular de {name} no detecta pulso. Comprueba cómo está {name} ya."}]
    if any(s["activity"] > 0 for s in last2):
        return "ok", []  # ejercicio: pulso y respiración altos son normales y el PPG no es fiable
    found = []
    hr_m, hr_sd = base["hr_bpm"]
    hr = _median(s["hr_bpm"] for s in last2)
    hr_hi = hr_m + 2 * hr_sd
    # Aviso temprano: tendencia de los últimos 3 min y valor de los últimos 30 s (reacciona antes que la mediana de 2 min).
    slope = _slope_per_min([(s["t"], s["hr_bpm"]) for s in ser[-18:]])
    hr_recent = _median(s["hr_bpm"] for s in ser[-3:])
    if hr is not None and hr > hr_hi:
        found.append(("hr_high", "hr_bpm", hr, hr_m))
    elif slope >= 2.0 and hr_recent is not None and hr_recent > hr_m + 1.2 * hr_sd:
        found.append(("hr_rising", "hr_bpm", hr_recent, hr_m))
    for m, rule in (("rr_brpm", "rr_high"), ("spo2_pct", "spo2_low")):
        mean, sd = base[m]
        v = _median(s[m] for s in last2)
        if v is None:
            continue
        if (m == "rr_brpm" and v > mean + 3 * sd) or (m == "spo2_pct" and v < mean - 3 * sd):
            found.append((rule, m, v, mean))
    if not found:
        return "ok", []
    parts_en, parts_es = [], []
    for rule, m, v, mean in found:
        le, ls, u = LABEL[m]
        if rule == "hr_rising":
            parts_en.append(f"{le} keeps climbing at rest, now {v:.0f} {u} and rising about {slope:.0f} per minute (usual {mean:.0f})")
            parts_es.append(f"el {ls} sigue subiendo en reposo: ahora {v:.0f} {u}, unas {slope:.0f} más por minuto (lo habitual, {mean:.0f})")
        elif rule == "spo2_low":
            parts_en.append(f"{le} is {v:.0f} {u} (usual {mean:.0f})")
            parts_es.append(f"el {ls} está en {v:.0f} {u} (lo habitual, {mean:.0f})")
        else:
            parts_en.append(f"{le} is {v:.0f} {u} at rest (usual {mean:.0f})")
            parts_es.append(f"{'la' if m == 'rr_brpm' else 'el'} {ls} está en {v:.0f} {u} en reposo (lo habitual, {mean:.0f})")
    level = "warning" if len(found) >= 2 else "watch"
    head_en = f"Early warning for {name}: " if level == "warning" else f"Heads-up on {name}: "
    head_es = f"Aviso temprano sobre {name}: " if level == "warning" else f"Atención a {name}: "
    tail_en = " Check on them and consider calling the medical officer." if level == "warning" else " I'll keep watching."
    tail_es = " Ve a verle y plantéate avisar al oficial médico." if level == "warning" else " Sigo vigilando."
    alert = {"rule": "+".join(r for r, *_ in found), "level": level, "metrics": [m for _, m, *_ in found],
             "summary_en": "; ".join(parts_en), "summary_es": "; ".join(parts_es),
             "text_en": head_en + "; ".join(parts_en) + "." + tail_en,
             "text_es": head_es + "; ".join(parts_es) + "." + tail_es}
    return level, [alert]


METHOD = {"en": "Compared with each person's own baseline (mean ± 2 SD; trend at rest). NASA-STD-3001 Vol. 1 sets no numeric "
                "alarm thresholds for heart rate or SpO2. In-ear PPG is reliable for trends at rest, not during exercise.",
          "es": "Comparado con la línea base de cada persona (media ± 2 DE; tendencia en reposo). NASA-STD-3001 Vol. 1 no fija "
                "umbrales numéricos de alarma para pulso ni SpO2. El PPG del oído vale para tendencias en reposo, no en ejercicio."}


def snapshot(crew_doc, now=None, with_series=False):
    """Estado de toda la tripulación ahora. Los avisos nuevos se apuntan una vez como evento en la centralita."""
    now = time.time() if now is None else now
    bases = baselines(crew_doc)
    crew, alerts = [], []
    for cid, base in bases.items():
        ser = series(cid, base, now)
        status, al = assess(cid, base, ser)
        cur = ser[-1]
        item = {"id": cid, "name": base["name"], "status": status, "now": cur, "simulated": True,
                "scenario": _scen.get(cid, {}).get("kind", "normal"),
                "baseline": {m: {"mean": round(base[m][0], 1), "sd": round(base[m][1], 2),
                                 "assumed": m != "hr_bpm"} for m in ("hr_bpm", "rr_brpm", "spo2_pct", "temp_c")},
                "trend_hr_bpm_per_min": round(_slope_per_min([(s["t"], s["hr_bpm"]) for s in ser[-30:] if s["pulse"]]), 1)}
        if with_series:
            item["series"] = ser
        crew.append(item)
        for a in al:
            a = {"id": f"vitals:{cid}:{a['rule']}:{int(_scen.get(cid, {}).get('t0', 0))}", "crew_id": cid, **a}
            alerts.append(a)
            with _lock:
                fresh = a["id"] not in _announced
                _announced.add(a["id"])
            if fresh:
                station.add_event("early_warning" if a["level"] != "alarm" else "no_pulse", cid,
                                  {"level": a["level"], "rule": a["rule"]}, a["text_en"], a["text_es"])
    checks = _process_checks({a["crew_id"]: a for a in alerts}, {c["id"]: c["name"] for c in crew}, now)
    return {"crew": crew, "alerts": alerts, "checks": checks, "checkin_timeout_s": CHECKIN_TIMEOUT_S, "now": now,
            "sample_s": STEP_S, "simulated": True, "method": METHOD,
            "sensor": "Metis earpiece concept: in-ear PPG (pulse, SpO2, breathing), ear temperature, accelerometer"}


def set_scenario(cid, kind, ramp_s=DEFAULT_RAMP_S, now=None):
    now = time.time() if now is None else now
    with _lock:
        if kind == "normal":
            _scen.pop(cid, None)
        else:
            # desde la muestra en curso: un desplome tiene que verse ya, no 10 s después
            _scen[cid] = {"kind": kind, "t0": (now // STEP_S) * STEP_S, "ramp_s": max(30, int(ramp_s))}


def reset():
    with _lock:
        _scen.clear(); _announced.clear(); _checks.clear()


def status_text(crew_doc, cid=None, lang="en"):
    """Resumen hablado y exacto («how is the crew?», «how is Marco?»). Sin IA: cifras tal cual."""
    snap = snapshot(crew_doc)
    rows = [c for c in snap["crew"] if cid is None or c["id"] == cid]
    by = {a["crew_id"]: a for a in snap["alerts"]}
    out = []
    for c in rows:
        n = c["now"]
        if not n["pulse"]:
            out.append(by[c["id"]]["text_es" if lang == "es" else "text_en"]); continue
        if c["id"] in by:
            out.append(by[c["id"]]["text_es" if lang == "es" else "text_en"]); continue
        act = n["activity"] > 0
        if lang == "es":
            out.append(f"{c['name']}: pulso {n['hr_bpm']:.0f}, respiración {n['rr_brpm']:.0f}, oxígeno {n['spo2_pct']:.0f} %"
                       + (", haciendo ejercicio." if act else ", dentro de su normalidad."))
        else:
            out.append(f"{c['name']}: heart rate {n['hr_bpm']:.0f}, breathing {n['rr_brpm']:.0f}, oxygen {n['spo2_pct']:.0f} percent"
                       + (", exercising." if act else ", normal for them."))
    return " ".join(out)


def _advice(name, a):
    """Lo que Metis dice AL AFECTADO, en su auricular: qué le pasa, qué hacer y si está bien."""
    a = {**a, "summary_en": "your " + a["summary_en"].replace("; ", "; your ")}   # «Marco, your heart rate…»
    if a["level"] == "warning":
        return (f"{name}, it's getting worse: {a['summary_en']}. Stop, sit or strap in, and stay still. Are you okay?",
                f"{name}, va a peor: {a['summary_es']}. Para, siéntate o sujétate y quédate quieto. ¿Estás bien?")
    return (f"{name}, {a['summary_en']}. Stop what you're doing, rest and breathe slowly. Are you okay?",
            f"{name}, {a['summary_es']}. Deja lo que estás haciendo, descansa y respira despacio. ¿Estás bien?")


def _instructions(name, a, reason):
    """Lo que Metis dice A LOS DEMÁS al escalar. Primero QUÉ HACER (lo que no se puede perder), luego por qué. Sin preguntar."""
    if reason == "no_pulse":
        return (f"Emergency. Go to {name} now: {name}'s earpiece detects no pulse. "
                f"I'm alerting the medical officer and opening the emergency checklist.",
                f"Emergencia. Ve con {name} ya: su auricular no detecta pulso. Aviso al oficial médico y abro la lista de emergencia.")
    why_en = "asked for help" if reason == "help" else "is not answering"
    why_es = "ha pedido ayuda" if reason == "help" else "no contesta"
    return (f"Go to {name} now. {name} {why_en} and their vitals are off: {a['summary_en']}. "
            f"Keep them at rest and stay with them. I've alerted the medical officer.",
            f"Ve con {name} ya. {name} {why_es} y sus constantes no van bien: {a['summary_es']}. "
            f"Que no se mueva y quédate a su lado. He avisado al oficial médico.")


def _escalate(cid, name, a, reason, now):
    c = _checks[cid]
    c.update(state="escalated", reason=reason, escalated_at=now, escalated_rank=RANK[a["level"]])
    c["instructions_en"], c["instructions_es"] = _instructions(name, a, reason)
    station.add_event("crew_alert", cid, {"level": a["level"], "reason": reason, "source": "vitals"},
                      c["instructions_en"], c["instructions_es"])
    if reason == "no_pulse" or a["level"] != "watch":
        station.add_event("cmo_alert", cid, {"level": a["level"], "reason": reason, "source": "vitals"})


def _process_checks(alert_by_crew, names, now):
    with _lock:
        for cid in list(_checks):
            if cid not in alert_by_crew:
                del _checks[cid]            # vuelve a la normalidad: se cierra el protocolo
        for cid, a in alert_by_crew.items():
            r, name = RANK[a["level"]], names.get(cid, cid)
            c = _checks.get(cid)
            if c is None or r > c["rank"]:  # aviso nuevo o más grave: se vuelve a preguntar al afectado
                prev = c or {}
                # Si no había contestado, el reloj sigue: ir a peor sin respuesta no puede retrasar el aviso al equipo.
                asked = prev["asked_at"] if prev.get("state") == "asking" and prev.get("answer") is None else now
                c = _checks[cid] = {"crew_id": cid, "name": name, "level": a["level"], "rank": r, "asked_at": asked,
                                    "answer": None, "state": "asking", "escalated_rank": prev.get("escalated_rank", 0)}
                c["advice_en"], c["advice_es"] = _advice(name, a)
            if c["state"] == "escalated" and c.get("escalated_rank", 0) >= r:
                continue
            if a["level"] == "alarm":
                _escalate(cid, name, a, "no_pulse", now)
            elif c["answer"] == "help":
                _escalate(cid, name, a, "help", now)
            elif c["answer"] is None and now - c["asked_at"] >= CHECKIN_TIMEOUT_S:
                _escalate(cid, name, a, "no_answer", now)
        return [{**c, "seconds_left": max(0, int(CHECKIN_TIMEOUT_S - (now - c["asked_at"]))) if c["state"] == "asking" else 0}
                for c in _checks.values()]


HELP = __import__("re").compile(r"\b(help|alert|call|crew|team|everyone|not ok|not okay|not fine|not good|bad|worse|dizzy|"
                                r"ayuda|avisa|llama|equipo|tripulaci|no estoy bien|mal|peor|mareado|mareada)\b", __import__("re").I)
OKAY = __import__("re").compile(r"\b(yes|yeah|yep|ok|okay|fine|good|better|all good|i'?m alright|alright|no problem|"
                                r"sí|si|bien|vale|estoy bien|mejor|tranquilo|tranquila)\b", __import__("re").I)


def checkin(cid, text, now=None):
    """Respuesta del afectado a «¿estás bien?». Regla fija: pedir ayuda gana a todo; la duda no cuenta como «bien»."""
    import voice_answer
    now = time.time() if now is None else now
    heard = voice_answer.clean_transcript(text)
    t = __import__("re").sub(r"\b(no problem|no worries|no pasa nada|no te preocupes)\b", "fine", heard.lower())
    with _lock:
        c = _checks.get(cid)
        if not c:
            return {"answer": None, "state": "none", "heard": heard}
        neg = __import__("re").search(r"\b(not|no|don'?t|isn'?t|nope|no estoy)\b", t)
        if HELP.search(t) or voice_answer.match_commands(heard) or (neg and OKAY.search(t)) or t.strip(" .!?") in ("no", "nope"):
            ans = "help"
        elif OKAY.search(t) and not voice_answer.UNSURE.search(voice_answer._norm(heard)):
            ans = "ok"
        elif (yn := voice_answer.match_option(heard, [{"id": "si"}, {"id": "no"}])) is not None:
            ans = "ok" if yn == "si" else "help"     # «Yeah.», «Jess.» -> bien; «Know.», «Now.» -> no está bien
        else:
            return {"answer": None, "state": c["state"], "heard": heard,
                    "say_en": "Sorry, I didn't catch that. Are you okay, or should I alert the crew?",
                    "say_es": "Perdona, no te he entendido. ¿Estás bien o aviso a la tripulación?"}
        c["answer"], c["answered_at"] = ans, now
    if ans == "ok":
        return {"answer": "ok", "state": "asking", "heard": heard,
                "say_en": "Okay. Keep resting, I'll keep watching and I'll tell you if anything changes.",
                "say_es": "De acuerdo. Sigue descansando; yo sigo vigilando y te aviso si algo cambia."}
    return {"answer": "help", "state": "escalating", "heard": heard,
            "say_en": "I'm alerting the crew and the medical officer now. Stay where you are, help is on the way.",
            "say_es": "Aviso ya a la tripulación y al oficial médico. Quédate donde estás, van a ayudarte."}
