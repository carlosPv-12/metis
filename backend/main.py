# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Backend Metis (FastAPI). Sin conexión: datos de ../data/*.json, triaje determinista bilingüe con fuentes,
IA local (llama.cpp) que solo redacta, voz local (Kokoro / Piper / espeak-ng y whisper.cpp).
Arranque: uvicorn main:app --port 8000   (contrato completo en ../API.md)
Variables: METIS_LLM_URL (por defecto http://127.0.0.1:8081/v1; vacío = sin IA), METIS_LLM_MODEL, METIS_LLM_TIMEOUT,
METIS_HOME (modelos, por defecto ~/.local/share/metis), METIS_VOICE_EN, METIS_VOICE_ES, METIS_THREADS."""
import json, os, pathlib, time
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

import re
import ground, llm, mission, roles, ship, station, vitals, voice_answer, voice_engine

HERE = pathlib.Path(__file__).parent
DATA = HERE.parent / "data"
TREE_FILE = pathlib.Path(os.environ.get("METIS_TREE_FILE", str(HERE / "triage_tree.json")))
FALLBACK_FILE = pathlib.Path(os.environ.get("METIS_FALLBACK_FILE", str(HERE / "fallback_lines.json")))


def load(p): return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


app = FastAPI(title="Metis", version="0.2")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["X-Metis-Engine", "X-Metis-Voice", "X-Latency-Ms"])
TREE = load(TREE_FILE)
FALLBACK = load(FALLBACK_FILE)


def L(lang): return "es" if lang == "es" else "en"


def fb(topic, lang):
    v = FALLBACK.get(topic, FALLBACK["default"])
    return v.get(L(lang), v.get("en")) if isinstance(v, dict) else v


def viewer_ok(viewer):
    """Comprueba `viewer` (id de tripulante o "ground"); None = sin filtro, como antes."""
    if viewer is None:
        return None
    try:
        roles.role_of(viewer)
    except KeyError:
        raise HTTPException(400, "viewer desconocido: usa un id de tripulante o 'ground'")
    return viewer


def crew_doc():
    p = DATA / "crew_lena.json"
    if not p.exists(): raise HTTPException(503, "Falta data/crew_lena.json: ejecuta data/generate_crew.py")
    d = load(p)
    station.seed(d)
    return d


# ---------- existentes ----------
@app.get("/api/health")
def health(): return {"status": "ok", "llm_configured": bool(llm.LLM_URL), "offline_ready": True}


@app.get("/api/crew")
def crew(viewer: str | None = None):
    d = crew_doc()
    items = [{"id": c["id"], "name": c["name"], "role": c["role"], "role_en": c.get("role_en", c["role"]),
              "today_out_of_band": c["today_out_of_band"]} for c in d["crew"].values()]
    if viewer_ok(viewer):
        items = roles.filter_crew_items(items, viewer)
    return {"co2_limit_mmhg": d["co2_limit_mmhg"], "simulated": True, "baseline_window": d.get("baseline_window"), "crew": items}


@app.get("/api/crew/{cid}")
def crew_one(cid: str, viewer: str | None = None):
    d = crew_doc()
    if cid not in d["crew"]: raise HTTPException(404, "tripulante no encontrado")
    item = {**d["crew"][cid], "simulated": True, "co2_limit_mmhg": d["co2_limit_mmhg"]}
    if not viewer_ok(viewer):
        return item
    try:
        return roles.crew_detail(item, viewer)
    except roles.Forbidden as e:
        raise HTTPException(403, str(e))


@app.get("/api/blood")
def blood():
    p = DATA / "blood_osd569.json"
    if not p.exists(): raise HTTPException(503, "Falta data/blood_osd569.json: ejecuta data/blood_osd569.py")
    return load(p)


# ---------- triaje ----------
class TriageIn(BaseModel):
    flow: str                   # "companion_collapse" | "self_chest_pressure"
    node_id: str | None = None  # nodo actual; None = empezar
    answer: str | None = None   # id de la opción elegida
    lang: str = "en"


def loc_node(n, lang):
    k = L(lang)
    g = lambda f: n.get(f"{f}_{k}", n.get(f"{f}_en", n.get(f, "")))
    if n["type"] == "question":
        return {"type": "question", "text": g("text"), "why": g("why"),
                "options": [{"id": o["id"], "label": o.get(f"label_{k}", o.get("label_en", o.get("label"))), "next": o["next"]} for o in n["options"]]}
    return {"type": "result", "level": n["level"], "title": g("title"), "steps": n.get(f"steps_{k}", n.get("steps_en", [])),
            "surgeon_summary": g("surgeon_summary"), "warning": g("warning")}


@app.post("/api/triage/step")
def triage_step(b: TriageIn):
    flow = TREE["flows"].get(b.flow)
    if not flow: raise HTTPException(404, "flujo desconocido")
    nodes = flow["nodes"]
    if b.node_id is None:
        nid = flow["start"]
    else:
        cur = nodes.get(b.node_id)
        if not cur or cur["type"] != "question": raise HTTPException(400, "nodo actual no válido")
        opt = next((o for o in cur["options"] if o["id"] == b.answer), None)
        if not opt: raise HTTPException(400, "respuesta no válida")
        nid = opt["next"]
    n, k = nodes[nid], L(b.lang)
    srcs = [{"title": TREE["sources"][s]["title"], "url": TREE["sources"][s]["url"]} for s in n.get("sources", []) if s in TREE["sources"]]
    return {"flow": b.flow, "flow_title": flow.get(f"title_{k}", flow.get("title_en", flow.get("title"))), "node_id": nid,
            "node": loc_node(n, k), "offline": True, "lang": k, "say": n.get(f"say_{k}", ""), "sources": srcs,
            "escalate": bool(n.get("escalate")), "deterministic": True}


# Preguntas del tipo «¿responde?» / «¿respira con normalidad?»: ahí «he is breathing» es un sí.
STATE_YES_NODES = {"c1", "c2", "c2r"}
REPROMPT = {"en": "Sorry, I didn't catch that. Please answer yes or no.", "es": "Perdona, no te he entendido. Responde sí o no."}
REPROMPT_TIME = {"en": "Sorry, I didn't catch that. Less than ten minutes, or more?", "es": "Perdona, no te he entendido. ¿Menos de diez minutos o más?"}


class TriageVoiceIn(BaseModel):
    flow: str
    node_id: str               # pregunta que se está respondiendo
    text: str                  # lo que transcribió /api/voice/stt
    lang: str = "en"


@app.post("/api/triage/voice")
def triage_voice(b: TriageVoiceIn):
    """Manos libres: empareja la respuesta hablada con una opción (regla fija, sin IA) y avanza el triaje.
    Si no está claro, understood=false y una frase para repetir la pregunta; los botones siguen valiendo."""
    flow = TREE["flows"].get(b.flow)
    if not flow: raise HTTPException(404, "flujo desconocido")
    cur = flow["nodes"].get(b.node_id)
    if not cur or cur["type"] != "question": raise HTTPException(400, "nodo actual no válido")
    k, heard = L(b.lang), voice_answer.clean_transcript(b.text)
    opt = voice_answer.match_option(heard, cur["options"], b.node_id in STATE_YES_NODES)
    if opt is None:
        ids = {o["id"] for o in cur["options"]}
        q = cur.get(f"text_{k}", cur.get("text_en", ""))
        again = (REPROMPT_TIME if ids == {"lt10", "gt10"} else REPROMPT)[k]
        return {"understood": False, "heard": heard, "node_id": b.node_id, "say": f"{again} {q}", "lang": k, "deterministic": True}
    o = next(x for x in cur["options"] if x["id"] == opt)
    res = triage_step(TriageIn(flow=b.flow, node_id=b.node_id, answer=opt, lang=k))
    return {**res, "understood": True, "heard": heard, "answer": opt,
            "answer_label": o.get(f"label_{k}", o.get("label_en", o.get("label", opt)))}


class TriageCommandIn(BaseModel):
    text: str
    lang: str = "en"


@app.post("/api/triage/command")
def triage_command(b: TriageCommandIn):
    """Órdenes habladas en el resultado del triaje: qué avisos pide («alert the crew») y si es un sí o un no
    (para «¿aviso al oficial médico?»). Regla fija, sin IA; quien envía los avisos es la pantalla, como con los botones."""
    heard = voice_answer.clean_transcript(b.text)
    yn = voice_answer.match_option(heard, [{"id": "si"}, {"id": "no"}])
    return {"heard": heard, "actions": voice_answer.match_commands(heard), "confirm": {"si": True, "no": False}.get(yn),
            "lang": L(b.lang), "deterministic": True}


class WakeIn(BaseModel):
    text: str
    lang: str = "en"


@app.post("/api/voice/wake")
def voice_wake(b: WakeIn):
    """Escucha continua: ¿han dicho «Metis»? ¿Es una emergencia? ¿Quiere acabar la conversación (end)? Las emergencias no necesitan la palabra de
    activación: en un desplome nadie se acuerda de decir «Metis». Regla fija, sin IA."""
    heard = voice_answer.clean_transcript(b.text)
    wake, command = voice_answer.match_wake(heard)
    emergency = bool(heard and llm.EMERGENCY.search(heard))
    # En la terminal, para ver qué entiende Metis sin abrir nada (solo texto ya transcrito; no se guarda).
    print(f"[metis oído] «{heard}»" + (" · METIS" if wake else "") + (" · EMERGENCIA" if emergency else ""), flush=True)
    return {"heard": heard, "wake": wake, "command": command if wake else "",
            "emergency": emergency, "end": voice_answer.match_end(heard),
            "lang": L(b.lang), "deterministic": True}


# ---------- IA ----------
TOPIC_TASK = {
    "greeting": {"en": "Greet {name} by name, mention ONE change from the facts exactly as stated (higher or lower), and gently ask how they feel.",
                 "es": "Saluda a {name} por su nombre, menciona UN cambio de los datos tal como está escrito (más alto o más bajo) y pregúntale con suavidad cómo se encuentra."},
    "sleep_co2": {"en": "Point out that the short nights coincide with the bunk CO2 peaks, and offer to flag it to the crew.",
                  "es": "Señala que las noches cortas coinciden con los picos de CO2 de la litera y ofrece avisar a la tripulación."},
    "offer_checkup": {"en": "Offer a three-minute check-in.", "es": "Ofrece un chequeo de tres minutos."},
}


class SayIn(BaseModel):
    topic: str = "greeting"     # clave de fallback_lines.json
    context: str = ""           # datos extra para que la IA redacte (opcional)
    crew_id: str = "lena"
    lang: str = "en"


def _crew(cid):
    try:
        return crew_doc()["crew"].get(cid)
    except HTTPException:
        return None


@app.post("/api/metis/say")
def say(b: SayIn):
    k, c = L(b.lang), _crew(b.crew_id)
    name = c["name"] if c else "Lena"
    task = TOPIC_TASK.get(b.topic, {"en": "Say one short, supportive sentence about the context.", "es": "Di una frase breve y de apoyo sobre el contexto."})[k].format(name=name)
    user = f"Facts: {llm.facts_for(c, k)}\nExtra context: {b.context or '-'}\nTask: {task}"
    t0 = time.time()
    try:
        text, ms = llm.complete([{"role": "system", "content": llm.system_for(k, name)}, {"role": "user", "content": user}])
        return {"text": text, "source": "llm", "latency_ms": ms, "ai_generated": True, "model": llm.LLM_MODEL, "lang": k}
    except Exception as e:
        return {"text": fb(b.topic, k), "source": "fallback", "latency_ms": int((time.time() - t0) * 1000), "ai_generated": False,
                "lang": k, "fallback_reason": type(e).__name__}


class ChatIn(BaseModel):
    crew_id: str = "lena"
    message: str
    lang: str = "en"
    history: list[dict] | None = None  # [{role: user|assistant, content}]


# «How is the crew?», «how is Marco?», «status report»: lo contesta una regla con las cifras de los sensores, no la IA.
# «queue», «cru», «crow»…: como escribe whisper «crew» con acento (14-nov, Carlos: «How is the queue?»).
CREW_STATUS = re.compile(r"\bhow(\'s| is| are)? (the )?(crew|queue|cue|cru|crow|crue|everyone|everybody|team)\b|\b(crew|queue) (status|vitals)\b|\bstatus report\b|"
                         r"\bhow(\'s| is| are)? (marco|lena|noor|kenji)( doing)?\b|\b(marco|lena|noor|kenji)\'?s? (status|vitals)\b|"
                         r"\bcómo (está|esta|están|estan) (la tripulación|el equipo|todos|marco|lena|noor|kenji)\b", re.I)
SHIP_STATUS = re.compile(r"\bhow(\'s| is)? (the )?(ship|station|habitat|spacecraft|vehicle)\b|\b(ship|station|habitat) (status|systems)\b|"
                         r"\bcómo (está|esta) la (nave|estación|estacion)\b", re.I)
COMPANION = __import__("re").compile(r"\b(he|she|they|crewmate|marco|lena|noor|kenji|compañer|él|ella|se ha|se desplom)\b", __import__("re").I)


def active_emergency(speaker):
    """La emergencia escalada más reciente de OTRO tripulante (lo que ve el auricular de `speaker`), o None."""
    try:
        snap = roles.filter_vitals(vitals.snapshot(crew_doc()), speaker if speaker in crew_doc()["crew"] else None)
    except Exception:
        return None
    esc = [c for c in snap.get("checks", []) if c.get("state") == "escalated" and c.get("crew_id") != speaker]
    return max(esc, key=lambda c: c.get("escalated_at") or 0) if esc else None


@app.post("/api/metis/chat")
def chat(b: ChatIn):
    k, c = L(b.lang), _crew(b.crew_id)
    name = c["name"] if c else "Lena"
    t0 = time.time()
    if llm.PSYCH.search(b.message or ""):
        return {"text": fb("psych", k), "source": "rule", "latency_ms": int((time.time() - t0) * 1000), "safety": "escalated",
                "suggest": "cmo_and_psych_support", "lang": k, "ai_generated": False}
    if llm.EMERGENCY.search(b.message or ""):
        flow = "companion_collapse" if COMPANION.search(b.message) else "self_chest_pressure"
        return {"text": fb("escalate", k), "source": "rule", "latency_ms": int((time.time() - t0) * 1000), "safety": "escalated",
                "suggest_flow": flow, "lang": k, "ai_generated": False}
    # Emergencia de un compañero en curso: nada de charla. Se responde con una regla y se abre su lista de emergencia.
    # (Carlos, 14-nov: «cuando hay una incidencia se mezcla con el chat normal».) Las preguntas de estado siguen valiendo.
    emerg = active_emergency(b.crew_id)
    if emerg and not CREW_STATUS.search(b.message or "") and not SHIP_STATUS.search(b.message or ""):
        n = emerg["name"]
        text = (f"There's an emergency with {n} right now. Let's go to the checklist: I'll ask you one thing at a time."
                if k == "en" else f"Hay una emergencia con {n} ahora mismo. Vamos a la lista de emergencia: te pregunto una cosa cada vez.")
        return {"text": text, "source": "rule", "latency_ms": int((time.time() - t0) * 1000), "safety": "escalated",
                "suggest_flow": "companion_collapse", "patient": emerg["crew_id"], "lang": k, "ai_generated": False}
    if SHIP_STATUS.search(b.message or ""):
        doc = crew_doc()
        return {"text": ship.status_text(doc, station.station(doc)["environment"], k), "source": "rule",
                "latency_ms": int((time.time() - t0) * 1000), "safety": "ok", "lang": k, "ai_generated": False}
    st_m = CREW_STATUS.search(b.message or "")
    if st_m:
        who = next((n for n in ("lena", "marco", "noor", "kenji") if re.search(rf"\b{n}\b", b.message, re.I)), None)
        return {"text": vitals.status_text(crew_doc(), who, k, viewer=b.crew_id), "source": "rule", "latency_ms": int((time.time() - t0) * 1000),
                "safety": "ok", "lang": k, "ai_generated": False, "note": "crew status is read from the sensors, never generated"}
    if llm.MEDQ.search(b.message or "") and (cond := ship.condition_of(b.message)):
        plan = ship.PLANS[cond]
        return {"text": plan[k], "source": "rule", "latency_ms": int((time.time() - t0) * 1000), "safety": "ok", "lang": k,
                "ai_generated": False, "plan": cond, "note": ship.PLAN_NOTE[k]}
    if llm.MEDQ.search(b.message or ""):
        return {"text": fb("medication", k), "source": "rule", "latency_ms": int((time.time() - t0) * 1000), "safety": "ok",
                "lang": k, "ai_generated": False, "note": "medication questions are never answered by the model"}
    if llm.DIAGQ.search(b.message or ""):
        return {"text": fb("diagnosis", k), "source": "rule", "latency_ms": int((time.time() - t0) * 1000), "safety": "ok",
                "lang": k, "ai_generated": False, "note": "diagnosis requests are never answered by the model"}
    ctx = "Background only, mention it only if relevant:\n" if k == "en" else "Contexto de fondo; menciónalo solo si viene al caso:\n"
    msgs = [{"role": "system", "content": llm.system_for(k, name) + "\n" + ctx + llm.facts_for(c, k)}]
    for h in (b.history or [])[-6:]:
        if h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str):
            msgs.append({"role": h["role"], "content": h["content"][:500]})
    um = (b.message or "")[:500]
    if llm.NASA_Q.search(um):  # directriz NASA: la IA no atribuye nada a NASA
        um += ("\n(Answer in your own voice as Metis. Do not mention NASA or any agency, do not quote anyone.)" if k == "en"
               else "\n(Responde con tu propia voz de Metis. No menciones a la NASA ni a ninguna agencia, no cites a nadie.)")
    msgs.append({"role": "user", "content": um})
    try:
        text, ms = llm.complete(msgs, max_tokens=90, temperature=0.4)
        return {"text": text, "source": "llm", "latency_ms": ms, "safety": "ok", "lang": k, "ai_generated": True, "model": llm.LLM_MODEL}
    except Exception as e:
        return {"text": fb("chat", k), "source": "fallback", "latency_ms": int((time.time() - t0) * 1000), "safety": "ok", "lang": k,
                "ai_generated": False, "fallback_reason": type(e).__name__}


# ---------- estado, umbrales ----------
@app.get("/api/status")
def status():
    return {"llm": llm.status(), "tts": voice_engine.tts_status(), "stt": voice_engine.stt_status(), "offline": True}


@app.get("/api/thresholds")
def thresholds():
    cat = load(DATA / "config.json").get("catalog", [])
    try:
        bw = crew_doc().get("baseline_window")
    except HTTPException:
        bw = None
    for t in cat:
        if t["id"] in ("baseline_days", "baseline_band_sd") and bw:
            t["baseline_window"] = bw
    return cat


def _with_lang(items, lang):
    if lang in ("en", "es"):
        for it in items:
            if isinstance(it, dict) and f"text_{lang}" in it:
                it["text"] = it[f"text_{lang}"]
    return items


# ---------- voz ----------
@app.get("/api/voice/voices")
def voices(): return voice_engine.voices()


class TTSIn(BaseModel):
    text: str
    voice: str | None = None
    lang: str = "en"
    speed: float = 1.0


@app.post("/api/voice/tts")
def tts(b: TTSIn):
    t0 = time.time()
    try:
        wav, engine, voice = voice_engine.tts(b.text, b.voice, L(b.lang), max(0.6, min(1.4, b.speed)))
    except Exception as e:
        return JSONResponse({"error": str(e)[:300]}, status_code=503)
    return Response(wav, media_type="audio/wav", headers={"X-Metis-Engine": engine, "X-Metis-Voice": voice,
                                                         "X-Latency-Ms": str(int((time.time() - t0) * 1000))})


@app.post("/api/voice/stt")
async def stt(audio: UploadFile = File(...), lang: str = Form("auto"), hint: str = Form("")):
    data = await audio.read()
    t0 = time.time()
    try:
        from starlette.concurrency import run_in_threadpool
        text, detected = await run_in_threadpool(voice_engine.stt, data, lang, hint)
    except Exception as e:
        return JSONResponse({"error": str(e)[:300], "text": ""}, status_code=503)
    text = voice_answer.clean_transcript(text)  # sin [BLANK_AUDIO] ni (music): si no hubo voz, text = ""
    if hint and voice_answer._norm(text).split() == voice_answer._norm(hint).split():
        text = ""                                 # whisper ha copiado la pista («Yes. No.»): no es una respuesta
    return {"text": text, "lang": detected, "latency_ms": int((time.time() - t0) * 1000), "engine": "whisper.cpp"}


# ---------- centralita y grafo ----------
@app.get("/api/station")
def get_station(lang: str | None = None, viewer: str | None = None):
    ground.apply_delivered()
    doc = crew_doc()
    v = vitals.snapshot(doc)          # antes que station(): así los avisos nuevos ya salen en sus eventos
    st = station.station(doc)
    by = {c["id"]: c for c in v["crew"]}
    for c in st["crew"]:
        vc = by.get(c["id"])
        if vc:
            c["vitals"] = vc["now"]
            if vc["status"] != "ok":
                c["status"] = "alarm" if vc["status"] == "alarm" else "watch"
    sh = ship.ship(doc, st["environment"], viewer_ok(viewer))
    st["ship"] = {"worst_status": sh["worst_status"], "alerts": sh["alerts"]}
    # los avisos de CO2 por módulo ya los da la nave (más completos): no se repiten
    st["alerts"] = [{**a, "source": "vitals"} for a in v["alerts"]] + sh["alerts"] + [a for a in st["alerts"] if not str(a.get("id", "")).startswith("co2_")]
    st["events"] = station.events()[:20]
    if viewer_ok(viewer):
        st["crew"] = roles.filter_crew_items(st["crew"], viewer)
        st["alerts"] = roles.filter_alerts(st["alerts"], viewer)
        st["events"] = roles.filter_events(st["events"], viewer)
        st["viewer"] = {"id": viewer, "role": roles.role_of(viewer)}
    _with_lang(st["alerts"], lang); _with_lang(st["events"], lang)
    if st.get("packet"): _with_lang([st["packet"]], lang)
    return st


# ---------- vista de Tierra ----------
@app.get("/api/ground")
def get_ground(lang: str | None = None):
    """Todo lo que ve Tierra (cirujano de vuelo y control de misión), al momento: tripulación, constantes, avisos,
    nave, entorno; más la bandeja de paquetes de la nave y las respuestas en camino. Ver backend/ground.py."""
    ground.apply_delivered()
    doc = crew_doc()
    st = get_station(lang, "ground")
    v = roles.filter_vitals(vitals.snapshot(doc), "ground")
    sh = ship.ship(doc, st["environment"], "ground")
    names = {cid: c["name"] for cid, c in doc["crew"].items()}
    g = ground.overview(st, v, sh, mission.get(), TREE, names)
    _with_lang(g["inbox"], lang); _with_lang(g["outbox"], lang); _with_lang(g["events"], lang)
    return g


class GroundReplyIn(BaseModel):
    crew_id: str | None = None      # sobre quién (None = mensaje a toda la tripulación)
    text_en: str
    text_es: str | None = None
    fitness: str | None = None      # fit | limited | unfit: se aplica a bordo cuando llega
    packet_id: int | None = None    # a qué paquete contesta (opcional)


@app.post("/api/ground/reply")
def ground_reply(b: GroundReplyIn):
    """Respuesta del cirujano: viaja a la nave con el retraso del entorno (sin enlace, en cola)."""
    doc = crew_doc()
    if b.crew_id is not None and b.crew_id not in doc["crew"]: raise HTTPException(404, "tripulante no encontrado")
    if not b.text_en.strip(): raise HTTPException(400, "mensaje vacío")
    try:
        return ground.reply(b.crew_id, b.text_en[:500], (b.text_es or "")[:500] or None, b.fitness, b.packet_id,
                            doc["crew"][b.crew_id]["name"] if b.crew_id else None)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------- estado de la nave y botiquín ----------
@app.get("/api/ship")
def get_ship(lang: str | None = None, viewer: str | None = None):
    """Soporte vital, energía y radiación (simulado, rangos con fuente). La relación CO2 de la litera con el sueño
    de Lena solo la ven quienes pueden ver sus datos (ella, el CMO, Tierra)."""
    doc = crew_doc()
    sh = ship.ship(doc, station.station(doc)["environment"], viewer_ok(viewer))
    _with_lang(sh["alerts"], lang)
    return sh


@app.get("/api/meds")
def get_meds():
    """Botiquín por categorías (cantidad, mínimo, caducidad frente al fin de la misión) y planes preaprobados de ejemplo.
    Sin dosis: la IA nunca nombra fármacos ni dosis."""
    return ship.meds()


# ---------- entorno de la misión ----------
@app.get("/api/mission")
def get_mission():
    """Entorno elegido en Ajustes (ISS, EVA, Luna, Marte 5-20 min, sin enlace) y su enlace con Tierra."""
    return mission.get()


class MissionIn(BaseModel):
    env: str                         # iss | eva | moon | mars | blackout
    mars_delay_min: int | None = None


@app.put("/api/mission")
def put_mission(b: MissionIn):
    try:
        mission.set(b.env, b.mars_delay_min)
    except ValueError as e:
        raise HTTPException(400, str(e))
    released = station.release_queued()        # vuelve el enlace: lo que esperaba en cola sale ya
    m = mission.get()
    station.add_event("link_change", None, {"env": m["env"], "released": released},
                      f"Mission environment: {m['label_en']}. {m['note_en']}" + (f" {released} queued packet(s) sent." if released else ""),
                      f"Entorno de la misión: {m['label_es']}. {m['note_es']}" + (f" Enviados {released} paquetes en cola." if released else ""))
    return {**m, "released": released}


# ---------- roles a bordo, Tierra y aptitud ----------
@app.get("/api/roles")
def get_roles():
    """Quién tiene qué rol y qué ve cada rol (tripulante, comandante, oficial médico, Tierra). Ver backend/roles.py."""
    return roles.permissions_doc()


class RoleIn(BaseModel):
    crew_id: str
    role: str               # crew | commander | cmo


@app.put("/api/roles")
def put_role(b: RoleIn):
    if b.crew_id not in crew_doc()["crew"]: raise HTTPException(404, "tripulante no encontrado")
    try:
        roles.set_role(b.crew_id, b.role)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return roles.permissions_doc()


@app.post("/api/roles/reset")
def roles_reset():
    roles.reset()
    return roles.permissions_doc()


class FitnessIn(BaseModel):
    status: str             # fit | limited | unfit
    viewer: str             # quien decide: el oficial médico o "ground"


@app.put("/api/crew/{cid}/fitness")
def put_fitness(cid: str, b: FitnessIn):
    """Apto / limitado / no apto. Lo deciden el CMO o Tierra, nunca la IA; el comandante lo ve."""
    if cid not in crew_doc()["crew"]: raise HTTPException(404, "tripulante no encontrado")
    viewer_ok(b.viewer)
    try:
        roles.set_fitness(cid, b.status, b.viewer)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except roles.Forbidden as e:
        raise HTTPException(403, str(e))
    station.add_event("fitness", cid, {"status": b.status, "by": roles.role_of(b.viewer)},
                      f"Fitness for duty: {b.status}", f"Aptitud para el servicio: {b.status}")
    return roles.fitness(cid)


@app.get("/api/vitals")
def get_vitals(lang: str | None = None, series: bool = False, viewer: str | None = None):
    """Constantes en directo del auricular (simuladas) y avisos tempranos por persona. Ver backend/vitals.py."""
    v = roles.filter_vitals(vitals.snapshot(crew_doc(), with_series=series), viewer_ok(viewer))
    _with_lang(v["alerts"], lang)
    return v


@app.get("/api/vitals/{cid}")
def get_vitals_one(cid: str, lang: str | None = None, viewer: str | None = None):
    if viewer_ok(viewer) and roles.access(viewer, cid) == "none":
        raise HTTPException(403, "solo puedes ver tu propia información; el oficial médico tiene el resto")
    v = roles.filter_vitals(vitals.snapshot(crew_doc(), with_series=True), viewer)
    c = next((x for x in v["crew"] if x["id"] == cid), None)
    if not c: raise HTTPException(404, "tripulante no encontrado")
    return {**c, "alerts": _with_lang([a for a in v["alerts"] if a["crew_id"] == cid], lang), "method": v["method"]}


class ScenarioIn(BaseModel):
    crew_id: str
    kind: str                 # normal | deterioration | exercise | collapse
    ramp_s: int = vitals.DEFAULT_RAMP_S


@app.post("/api/vitals/scenario")
def vitals_scenario(b: ScenarioIn):
    """Para la demo: «Marco empeora» (deterioration), ejercicio, desplome o volver a normal."""
    if b.kind not in ("normal", "deterioration", "exercise", "collapse"): raise HTTPException(400, "escenario desconocido")
    if b.crew_id not in vitals.baselines(crew_doc()): raise HTTPException(404, "tripulante no encontrado")
    vitals.set_scenario(b.crew_id, b.kind, b.ramp_s)
    return {"ok": True, "crew_id": b.crew_id, "kind": b.kind, "ramp_s": b.ramp_s}


class CheckinIn(BaseModel):
    crew_id: str
    text: str


@app.post("/api/vitals/checkin")
def vitals_checkin(b: CheckinIn):
    """Respuesta hablada del afectado a «¿estás bien?». «Help», «alert the crew», «no»… -> se avisa a la tripulación."""
    r = vitals.checkin(b.crew_id, b.text)
    if r["answer"] == "help":
        vitals.snapshot(crew_doc())   # escala ya, sin esperar a la siguiente consulta
    return r


@app.post("/api/vitals/reset")
def vitals_reset():
    vitals.reset()
    return {"ok": True}


class EventIn(BaseModel):
    type: str
    crew_id: str | None = None
    payload: dict = {}


@app.get("/api/station/events")
def get_events(lang: str | None = None, viewer: str | None = None):
    ground.apply_delivered()
    crew_doc()
    ev = station.events()
    return _with_lang(roles.filter_events(ev, viewer) if viewer_ok(viewer) else ev, lang)


@app.post("/api/station/events")
def post_event(b: EventIn):
    crew_doc()
    return station.add_event(b.type[:60], b.crew_id, b.payload)


@app.get("/api/brain/graph")
def brain_graph(): return station.graph(crew_doc(), TREE)


# Single-file demo (../demo/metis-demo.html, built by demo/construir.py): served at "/" so the same
# file uses the real AI, voice and speech recognition without Node. Only "/": every /api route stays as is.
DEMO_HTML = HERE.parent / "demo" / "metis-demo.html"


@app.get("/", include_in_schema=False)
def demo_page():
    if not DEMO_HTML.is_file():
        raise HTTPException(404, "metis-demo.html not built (run demo/construir.py)")
    return Response(DEMO_HTML.read_bytes(), media_type="text/html; charset=utf-8", headers={"Cache-Control": "no-cache"})
