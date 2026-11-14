# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Estado de la nave: soporte vital, energía y radiación, el filtro de CO2 de los camarotes ligado al sueño, y el
botiquín con el plan de medicación preaprobado. TODO SIMULADO salvo los rangos y cifras con fuente.
Decisión de Carlos, 14-nov 16:30 (decisiones/ del brain). Todos ven la nave; la relación con la salud de una
persona solo la ve quien tiene acceso a sus datos (roles.py)."""
import math, time, zlib

import mission
import roles

SRC = {
    "atm": {"title": "NASA ICES-2015-146: ISS total pressure 724-770.5 mmHg (14.0-14.9 psia), ppO2 146-178 mmHg",
            "url": "https://ntrs.nasa.gov/api/citations/20150010425/downloads/20150010425.pdf", "verified": True},
    "co2": {"title": "NASA OCHMO-TB-004 Rev D, Carbon Dioxide: 1-h average ppCO2 <= 3 mmHg (vehicle design limit)",
            "url": "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf", "verified": True},
    "water": {"title": "NASA (2023): ISS water recovery reaches 98% with the Brine Processor Assembly",
              "url": "https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/", "verified": True},
    "rad_rate": {"title": "NASA/JPL: Curiosity's RAD measured ~1.8 mSv per day during the cruise to Mars",
                 "url": "https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/", "verified": True},
    "rad_limit": {"title": "NASA career radiation limit 600 mSv (Metis final version, section 9, verified by the team)",
                  "url": "", "verified": True},
    "orion_kit": {"title": "Haas, NASA JSC, AsMA 2024: Orion medical kit needs (antiarrhythmic, anticoagulant, sleep medication…)",
                  "url": "https://ntrs.nasa.gov/api/citations/20240004890/downloads/Orion%20Medical%20System%20Development.pdf", "verified": True},
    "assumed": {"title": "Metis prototype assumption (no public source used)", "url": "", "verified": False},
}
MISSION_DAYS = 960        # 180 días de ida + 600 en Marte + 180 de vuelta (estimación NASA/JPL de la misma nota de RAD)
MISSION_DAY = 112
RAD_RATE_MSV_DAY = 1.8
RAD_CAREER_LIMIT_MSV = 600
LEVEL = {"ok": 0, "watch": 1, "fault": 2}


def _wiggle(key, scale):
    """Variación pequeña y determinista según el minuto (la nave «vive», pero la demo es repetible)."""
    k = int(time.time() // 60)
    return scale * ((zlib.crc32(f"{key}:{k}".encode()) % 2001) / 1000.0 - 1.0)


def _sys(id_, group, en, es, value, unit, low, high, src, status=None, note_en="", note_es=""):
    st = status or ("ok" if (low is None or value >= low) and (high is None or value <= high) else "watch")
    return {"id": id_, "group": group, "label_en": en, "label_es": es, "value": round(value, 2 if unit == "mmHg" else 1), "unit": unit,
            "nominal": {"low": low, "high": high}, "status": st, "note_en": note_en, "note_es": note_es,
            "source": SRC[src]["title"], "source_url": SRC[src]["url"], "verified": SRC[src]["verified"], "simulated": True}


def _pearson(xs, ys):
    n = len(xs); mx, my = sum(xs) / n, sum(ys) / n
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs)); sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return 0.0 if sx == 0 or sy == 0 else sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


def systems(crew_doc, environment):
    """environment: la lista de módulos de station.station() (CO2, temperatura y humedad por módulo)."""
    quarters = next((e for e in environment if e["module_en"].startswith("Crew quarters")), None)
    others = [e["co2_mmhg"] for e in environment if e is not quarters] or [2.0]
    bunk = quarters["co2_mmhg"] if quarters else 2.0
    dose = MISSION_DAY * RAD_RATE_MSV_DAY
    out = [
        _sys("o2", "life_support", "Cabin oxygen (ppO2)", "Oxígeno en cabina (ppO2)", 160 + _wiggle("o2", 3), "mmHg", 146, 178, "atm"),
        _sys("pressure", "life_support", "Cabin pressure", "Presión de cabina", 752 + _wiggle("p", 4), "mmHg", 724, 770.5, "atm"),
        _sys("co2_quarters", "life_support", "CO2 removal: crew quarters", "Eliminación de CO2: camarotes", bunk, "mmHg", None, 3.0, "co2",
             note_en=f"Night CO2 peak in the bunks is {bunk:.2f} mmHg, above the 3 mmHg design limit. Check the scrubber and the airflow in the quarters."
             if bunk > 3 else "Within the design limit.",
             note_es=f"El pico nocturno de CO2 en las literas es {bunk:.2f} mmHg, por encima del límite de diseño de 3 mmHg. Revisad el filtro y la ventilación de los camarotes."
             if bunk > 3 else "Dentro del límite de diseño."),
        _sys("co2_cabin", "life_support", "CO2 removal: rest of the cabin", "Eliminación de CO2: resto de la cabina",
             sum(others) / len(others), "mmHg", None, 3.0, "co2"),
        _sys("water", "life_support", "Water recovery", "Recuperación de agua", 98.0 + _wiggle("w", 0.3), "%", 95, None, "water",
             note_en="Potable water tank at 72% (assumed).", note_es="Depósito de agua potable al 72 % (supuesto)."),
        _sys("power", "power", "Power margin (generation - load)", "Margen de energía (generación - consumo)", 4.2 + _wiggle("pw", 0.4), "kW", 1.0, None, "assumed",
             note_en="Battery at 86% (assumed).", note_es="Batería al 86 % (supuesto)."),
        _sys("radiation", "radiation", "Radiation: mission dose so far", "Radiación: dosis acumulada en la misión", dose, "mSv", None,
             RAD_CAREER_LIMIT_MSV * 0.75, "rad_rate",
             note_en=f"{RAD_RATE_MSV_DAY} mSv/day in deep space (Curiosity RAD), day {MISSION_DAY}: {dose / RAD_CAREER_LIMIT_MSV:.0%} of the 600 mSv career limit. "
                     f"Area dosimeter only: there is no real-time dose per person.",
             note_es=f"{RAD_RATE_MSV_DAY} mSv/día en el espacio profundo (RAD de Curiosity), día {MISSION_DAY}: {dose / RAD_CAREER_LIMIT_MSV:.0%} del límite de carrera de 600 mSv. "
                     f"Solo dosímetro de área: no hay dosis por persona en tiempo real."),
    ]
    return out


def co2_sleep_link(crew_doc, cid="lena"):
    """La nave explica parte del sueño: noches de sueño frente al pico de CO2 de su litera (correlación, no diagnóstico)."""
    c = crew_doc["crew"].get(cid)
    if not c:
        return None
    days = c["days"]
    sleep = [d["sleep_h"] for d in days]; co2 = [d["co2_night_peak_mmhg"] for d in days]
    r = _pearson(co2, sleep)
    # «CO2 alto» = por encima de lo habitual en SU litera (banda personal), como compara Metis todo lo demás
    hi = c["baseline"]["co2_night_peak_mmhg"]["band_high"]
    over = [d for d in days if d["co2_night_peak_mmhg"] > hi]
    avg_over = sum(d["sleep_h"] for d in over) / len(over) if over else None
    rest = [d["sleep_h"] for d in days if d["co2_night_peak_mmhg"] <= hi]
    avg_rest = sum(rest) / len(rest) if rest else None
    n = c["name"]
    if avg_over is not None and avg_rest is not None:
        nn = "night" if len(over) == 1 else f"{len(over)} nights"
        en = (f"On the {nn} with high CO2 in the bunk (over {hi:.1f} mmHg, above usual), {n} slept {avg_over:.1f} h on average, against {avg_rest:.1f} h on the other nights "
              f"(correlation r = {r:.2f} over {len(days)} nights). This is a correlation, not a diagnosis: fixing the airflow is the first step.")
        es = (f"En las noches con el CO2 de la litera alto ({len(over)}; por encima de {hi:.1f} mmHg, más de lo habitual), {n} durmió {avg_over:.1f} h de media, frente a {avg_rest:.1f} h el resto "
              f"(correlación r = {r:.2f} en {len(days)} noches). Es una correlación, no un diagnóstico: lo primero es arreglar la ventilación.")
    else:
        en = es = ""
    return {"crew_id": cid, "name": n, "nights": len(days), "nights_over_limit": len(over), "high_co2_mmhg": round(hi, 2), "r": round(r, 2),
            "sleep_h_over_limit": None if avg_over is None else round(avg_over, 2), "sleep_h_other": None if avg_rest is None else round(avg_rest, 2),
            "text_en": en, "text_es": es, "system": "co2_quarters", "simulated": True}


def ship(crew_doc, environment, viewer=None):
    sys_ = systems(crew_doc, environment)
    worst = max(sys_, key=lambda s: LEVEL[s["status"]])["status"]
    alerts = [{"id": f"ship:{s['id']}", "level": s["status"], "crew_id": None, "source": "ship",
               "text_en": f"{s['label_en']}: {s['note_en']}", "text_es": f"{s['label_es']}: {s['note_es']}"}
              for s in sys_ if s["status"] != "ok"]
    link = co2_sleep_link(crew_doc)
    if link and roles.access(viewer, link["crew_id"]) != "full":
        link = None                       # dato de salud de una persona: solo ella, el CMO y Tierra
    m = mission.get()
    return {"systems": sys_, "worst_status": worst, "alerts": alerts, "co2_sleep_link": link,
            "mission": {"day": MISSION_DAY, "planned_days": MISSION_DAYS, "env": m["env"], "link": m["link"]},
            "simulated": True}


# ---------- botiquín y plan de medicación preaprobado ----------
# Categorías, no fármacos concretos: el contenido real lo decide el cirujano de vuelo (Haas 2024 lista necesidades
# por categoría). Cantidades y caducidades, SIMULADAS. La IA nunca nombra fármacos ni dosis.
MED_INVENTORY = [
    # id, en, es, qty, min, expira en N días desde hoy, fuente
    ("analgesic", "Pain reliever", "Analgésico", 40, 20, 540, "assumed"),
    ("antiemetic", "Anti-nausea (motion sickness)", "Antiemético (mareo)", 24, 10, 420, "assumed"),
    ("sleep_aid", "Sleep medication", "Medicación para dormir", 30, 10, 300, "orion_kit"),
    ("antiarrhythmic", "Antiarrhythmic", "Antiarrítmico", 10, 6, 900, "orion_kit"),
    ("anticoagulant", "Anticoagulant", "Anticoagulante", 10, 6, 700, "orion_kit"),
    ("antibiotic", "Antibiotic (broad spectrum)", "Antibiótico (amplio espectro)", 14, 10, 365, "assumed"),
    ("antihistamine", "Antihistamine / decongestant", "Antihistamínico / descongestionante", 9, 10, 610, "assumed"),
    ("burn_wound", "Burn and wound care (topical)", "Curas de quemaduras y heridas (tópico)", 12, 6, 1100, "assumed"),
    ("eye_drops", "Eye lubricant drops", "Colirio lubricante", 6, 4, 260, "assumed"),
]

PLANS = {
    "headache": {
        "en": "Your flight surgeon's plan for a headache: drink some water and rest for 20 minutes; I'll check the CO2 where you are. "
              "If it's still there, the pain reliever from the kit, exactly as on your pre-flight card. Call the medical officer if it's the worst "
              "headache you've had, if your vision changes, or if it lasts more than a few hours.",
        "es": "El plan de tu cirujano de vuelo para el dolor de cabeza: bebe agua y descansa 20 minutos; yo miro el CO2 donde estás. "
              "Si sigue, el analgésico del botiquín, tal como pone tu tarjeta de antes del vuelo. Llama al oficial médico si es el peor "
              "dolor de cabeza que has tenido, si te cambia la vista o si dura más de unas horas.",
        "category": "analgesic"},
    "sleep": {
        "en": "Your flight surgeon's plan for a bad night: dim the lights an hour before, no screens, and I'll check the CO2 in your bunk. "
              "The sleep medication only as your pre-flight card says, only with the medical officer's okay, and never before a critical task.",
        "es": "El plan de tu cirujano de vuelo para una mala noche: luz baja una hora antes, sin pantallas, y yo miro el CO2 de tu litera. "
              "La medicación para dormir solo como dice tu tarjeta de antes del vuelo, con el visto bueno del oficial médico y nunca antes de una tarea crítica.",
        "category": "sleep_aid"},
    "nausea": {
        "en": "Your flight surgeon's plan for motion sickness: keep your head still, fix your eyes on one point and avoid fast turns. "
              "The anti-nausea medicine as on your pre-flight card. Tell the medical officer if you can't keep water down.",
        "es": "El plan de tu cirujano de vuelo para el mareo: cabeza quieta, la vista fija en un punto y sin giros rápidos. "
              "El antiemético como pone tu tarjeta de antes del vuelo. Avisa al oficial médico si no retienes el agua.",
        "category": "antiemetic"},
    "back_pain": {
        "en": "Your flight surgeon's plan for back pain: the stretches from your exercise plan and a short rest. "
              "The pain reliever as on your pre-flight card. Call the medical officer if you feel numbness, weakness or pain going down a leg.",
        "es": "El plan de tu cirujano de vuelo para el dolor de espalda: los estiramientos de tu plan de ejercicio y un descanso corto. "
              "El analgésico como pone tu tarjeta de antes del vuelo. Llama al oficial médico si notas hormigueo, debilidad o dolor que baja por una pierna.",
        "category": "analgesic"},
}
PLAN_NOTE = {"en": "Example plan for this demo, not medical advice: real plans are written by the flight surgeon before the flight.",
             "es": "Plan de ejemplo para esta demo, no es consejo médico: los planes reales los escribe el cirujano de vuelo antes del vuelo."}
CONDITION = [("headache", r"head ?ache|headache|migraine|my head (hurts|is killing)|dolor de cabeza|me duele la cabeza|jaqueca|migraña"),
             ("sleep", r"sleep|insomnia|can'?t sleep|dormir|insomnio|no puedo dormir|sueño"),
             ("nausea", r"nause|motion sick|space sick|vomit|throw up|mare|náusea|nausea|vómit"),
             ("back_pain", r"back (pain|hurts|ache)|my back|dolor de espalda|me duele la espalda|lumbar")]


def condition_of(text):
    import re
    for cond, rx in CONDITION:
        if re.search(rx, text or "", re.I):
            return cond
    return None


def meds():
    left = MISSION_DAYS - MISSION_DAY
    inv = [{"id": i, "category_en": en, "category_es": es, "qty": q, "min": m, "low": q < m, "expires_in_days": d,
            "expires_before_mission_end": d < left, "source": SRC[s]["title"], "source_url": SRC[s]["url"],
            "verified_category": SRC[s]["verified"], "simulated": True}
           for i, en, es, q, m, d, s in MED_INVENTORY]
    return {"inventory": inv, "mission_days_left": left,
            "summary_en": f"{sum(x['expires_before_mission_end'] for x in inv)} of {len(inv)} categories expire before the end of the mission; "
                          f"{sum(x['low'] for x in inv)} below their minimum.",
            "summary_es": f"{sum(x['expires_before_mission_end'] for x in inv)} de {len(inv)} categorías caducan antes de acabar la misión; "
                          f"{sum(x['low'] for x in inv)} por debajo del mínimo.",
            "context_en": "Only ~16% of the ISS medical kit would last a Mars round trip without expiring (team research, Metis final version, section 10).",
            "context_es": "Solo ~16 % del botiquín de la ISS duraría un viaje de ida y vuelta a Marte sin caducar (investigación del equipo, versión final de Metis, apartado 10).",
            "plans": {k: {"en": v["en"], "es": v["es"], "category": v["category"]} for k, v in PLANS.items()},
            "plan_note": PLAN_NOTE, "no_doses": True, "simulated": True}


def status_text(crew_doc, environment, lang="en"):
    """«How is the ship?»: lo que no va bien primero; sin IA, cifras tal cual."""
    sys_ = systems(crew_doc, environment)
    bad = [x for x in sys_ if x["status"] != "ok"]
    if lang == "es":
        head = "La nave está bien." if not bad else "En la nave: " + " ".join(f"{x['label_es']}: {x['note_es']}" for x in bad)
        return head + f" Oxígeno, presión, agua y energía, normales. Radiación acumulada en la misión: {MISSION_DAY * RAD_RATE_MSV_DAY:.0f} mSv."
    head = "The ship is fine." if not bad else "On the ship: " + " ".join(f"{x['label_en']}: {x['note_en']}" for x in bad)
    return head + f" Oxygen, pressure, water and power are normal. Mission radiation dose so far: {MISSION_DAY * RAD_RATE_MSV_DAY:.0f} mSv."
