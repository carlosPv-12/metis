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

import llm, station, voice_answer, voice_engine

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
def crew():
    d = crew_doc()
    return {"co2_limit_mmhg": d["co2_limit_mmhg"], "simulated": True, "baseline_window": d.get("baseline_window"),
            "crew": [{"id": c["id"], "name": c["name"], "role": c["role"], "role_en": c.get("role_en", c["role"]),
                      "today_out_of_band": c["today_out_of_band"]} for c in d["crew"].values()]}


@app.get("/api/crew/{cid}")
def crew_one(cid: str):
    d = crew_doc()
    if cid not in d["crew"]: raise HTTPException(404, "tripulante no encontrado")
    return {**d["crew"][cid], "simulated": True, "co2_limit_mmhg": d["co2_limit_mmhg"]}


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


COMPANION = __import__("re").compile(r"\b(he|she|they|crewmate|marco|lena|noor|kenji|compañer|él|ella|se ha|se desplom)\b", __import__("re").I)


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
async def stt(audio: UploadFile = File(...), lang: str = Form("auto")):
    data = await audio.read()
    t0 = time.time()
    try:
        from starlette.concurrency import run_in_threadpool
        text, detected = await run_in_threadpool(voice_engine.stt, data, lang)
    except Exception as e:
        return JSONResponse({"error": str(e)[:300], "text": ""}, status_code=503)
    text = voice_answer.clean_transcript(text)  # sin [BLANK_AUDIO] ni (music): si no hubo voz, text = ""
    return {"text": text, "lang": detected, "latency_ms": int((time.time() - t0) * 1000), "engine": "whisper.cpp"}


# ---------- centralita y grafo ----------
@app.get("/api/station")
def get_station(lang: str | None = None):
    st = station.station(crew_doc())
    _with_lang(st["alerts"], lang); _with_lang(st["events"], lang)
    if st.get("packet"): _with_lang([st["packet"]], lang)
    return st


class EventIn(BaseModel):
    type: str
    crew_id: str | None = None
    payload: dict = {}


@app.get("/api/station/events")
def get_events(lang: str | None = None):
    crew_doc()
    return _with_lang(station.events(), lang)


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
