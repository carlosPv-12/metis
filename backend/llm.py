# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""IA local de Metis: llama.cpp (llama-server) por su API compatible OpenAI.
La IA SOLO redacta frases a partir de hechos que calcula el backend; nunca decide la acción médica
(eso lo hace el árbol de triaje determinista). Si el modelo no responde, se usan frases de reserva."""
import os, re, time
import httpx

LLM_URL = os.environ.get("METIS_LLM_URL", "http://127.0.0.1:8081/v1")  # vacío = sin IA
LLM_MODEL = os.environ.get("METIS_LLM_MODEL", "qwen3-4b-instruct-2507")
LLM_TIMEOUT = float(os.environ.get("METIS_LLM_TIMEOUT", "15"))

SYSTEM = {
 "en": ("You are Metis, the personal AI companion of {name}, an astronaut on a long mission. You run fully offline inside the habitat "
        "and talk through the Metis earpiece. Voice: calm, brief, warm, American English. At most two short sentences, no lists, no emojis. "
        "Use ONLY the facts given; never invent numbers. You do not diagnose and never suggest possible causes, conditions or diseases; you never name drugs or doses, and medical decisions come "
        "from the onboard triage checklist, the Crew Medical Officer (CMO) and the flight surgeon. Never attribute anything to NASA or any agency (never say 'according to NASA', 'NASA says' or similar); "
        "speak in your own voice as Metis. Do not raise alarms for everyday feelings: listen, "
        "validate, and offer one small practical step."),
 "es": ("Eres Metis, el compañero IA personal de {name}, astronauta en una misión larga. Funcionas sin conexión dentro del hábitat y "
        "hablas por el auricular Metis. Tono: tranquilo, breve, cálido, en español de España. Como mucho dos frases cortas, sin listas ni emojis. "
        "Usa SOLO los datos que te doy; nunca inventes cifras. No diagnosticas ni sugieres posibles causas, enfermedades o trastornos; nunca nombras fármacos ni dosis, y las decisiones médicas "
        "salen de la lista de triaje de a bordo, del oficial médico (CMO) y del cirujano de vuelo. Nunca atribuyas nada a la NASA ni a ninguna agencia (nunca digas 'según la NASA', 'la NASA dice' ni similares); "
        "habla con tu propia voz de Metis. No alarmes por sensaciones cotidianas: escucha, "
        "valida y ofrece un paso práctico pequeño."),
}

# Reglas deterministas: estos mensajes NUNCA llegan al modelo.
PSYCH = re.compile(
    r"hopeless|no hope|don'?t want to (keep going|go on|live|be here)|can'?t go on|want to die|wanna die|kill myself|end it all|end my life|"
    r"no reason to live|suicid|self[- ]harm|hurt myself|"
    r"sin esperanza|no quiero seguir|no puedo más|no puedo mas|quiero morir|me quiero morir|matarme|acabar con todo|quitarme la vida|"
    r"no tiene sentido vivir|hacerme daño", re.I)
EMERGENCY = re.compile(
    r"chest (pain|pressure)|can'?t breathe|cannot breathe|not breathing|isn'?t breathing|short(ness)? of breath|collaps|unconscious|"
    r"unresponsive|not responding|isn'?t responding|doesn'?t respond|won'?t (answer|respond|wake)|not answering|passed out|faint|"
    r"\bfell\b|fallen|on the floor|seizure|bleeding|heart attack|stroke|choking|"
    r"pecho|no (puedo )?respir|no respira|me ahogo|desmay|desplom|inconsciente|no contesta|no responde|no reacciona|no se despierta|"
    r"se ha caído|se cayó|ha caído|caíd[oa]|en el suelo|convuls|sangr|infarto|ictus|atragant", re.I)
DRUG_NAMES = (r"aspirin|aspirina|nitro|nitroglycerin|nitroglicerina|ibuprof|paracetam|acetaminoph|epinephrine|epinefrina|adrenalina|"
              r"morphine|morfina|heparin|heparina|atropin|amiodaron|naloxon|clopidogrel|melatonin|zolpidem|diazepam|lorazepam|"
              r"benzodiazep|opioid|opiáce|antidepres|antibiotic|antibiótic")
MEDQ = re.compile(
    r"\b(pills?|medication|medicine|drugs?|doses?|dosage|sleeping (aid|pill)|sedat\w*|sedant\w*|tranquili[sz]\w*|hypnotic|painkiller|"
    r"milligram\w*|miligram\w*|mg|mcg|pastillas?|medicament\w*|medicina|fármacos?|farmacos?|dosis|somnífer\w*|hipnótic\w*|calmante\w*|"
    r"tomarme algo|take something|what (should|can) i take|qué (me )?tomo)\b|" + DRUG_NAMES, re.I)
DIAGQ = re.compile(
    r"diagnos|what disease|which disease|what illness|what condition|what'?s wrong with me|do i have (a |an )?\w+|pretend (you are|you're|to be) a doctor|"
    r"act (as|like) a doctor|be my doctor|you are a doctor|"
    r"diagnóstic|diagnostic|qué enfermedad|que enfermedad|qué tengo|tengo (un|una) \w+|haz de médico|haz de medico|actúa como (un )?médico|"
    r"eres (un )?médico|sé mi médico|qué me pasa", re.I)
NASA_Q = re.compile(r"\bNASA\b", re.I)
FORBIDDEN = re.compile(r"\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|g|units?|unidades)\b|\b(" + DRUG_NAMES + r")|sedat|sedant|milligram|miligram", re.I)


LABEL = {"resting_hr_bpm": ("Resting heart rate", "Pulso en reposo", "bpm", 0), "hrv_ms": ("Heart-rate variability (HRV)", "Variabilidad cardiaca (HRV)", "ms", 0),
         "sleep_h": ("Sleep last night", "Sueño de anoche", "h", 1), "co2_night_peak_mmhg": ("Bunk CO2 peak last night", "Pico de CO2 en la litera anoche", "mmHg", 1)}


def facts_for(crew: dict, lang: str) -> str:
    """Hechos en frases llanas con la dirección ya decidida (un modelo de 4B confunde 'más alto/más bajo' si solo ve números)."""
    if not crew:
        return ""
    t, b = crew["days"][-1], crew["baseline"]
    out = []
    for m, (en, es, unit, nd) in LABEL.items():
        v, base = t[m], b[m]
        if v > base["band_high"]: d = ("HIGHER than usual", "MÁS ALTO de lo habitual")
        elif v < base["band_low"]: d = ("LOWER than usual", "MÁS BAJO de lo habitual")
        else: d = ("normal for them", "normal para su caso")
        val, usual = round(v, nd) if nd else int(v), round(base["mean"], nd) if nd else int(round(base["mean"]))
        out.append(f"- {en}: {val} {unit}, {d[0]} (usual {usual} {unit})." if lang == "en" else f"- {es}: {val} {unit}, {d[1]} (habitual {usual} {unit}).")
    short = sum(1 for d in crew["days"][-3:] if d["sleep_h"] < b["sleep_h"]["band_low"])
    if lang == "en":
        head = f"Crewmember {crew['name']}, mission day {t['mission_day']} (simulated data):"
        tail = f"- Short nights in a row: {short}. Cabin CO2 design limit: 3 mmHg (1-hour average)."
    else:
        head = f"Tripulante {crew['name']}, día de misión {t['mission_day']} (datos simulados):"
        tail = f"- Noches cortas seguidas: {short}. Límite de diseño de CO2 en cabina: 3 mmHg (media de 1 h)."
    return "\n".join([head] + out + [tail])


# Directriz NASA (raw/2026-11-14--nasa-directrices-imagenes-y-marca.md, línea 52): las salidas de IA no se atribuyen a NASA.
NASA_ATTR = re.compile(r"\s*,?\s*\b(according to|as per|per|based on)\s+(the\s+)?NASA('s)?(\s+(guidelines?|standards?|data|research))?\s*,?|"
                       r"\s*,?\s*\b(según|de acuerdo con|conforme a)\s+(la\s+)?NASA\s*,?", re.I)


def strip_attribution(text: str) -> str:
    """Quita 'according to NASA' y similares; si aún nombra a NASA, la frase se descarta (ValueError)."""
    out = NASA_ATTR.sub(" ", text)
    out = re.sub(r"\s+([,.!?])", r"\1", re.sub(r"\s+", " ", out)).strip()
    if out and out[0].islower():
        out = out[0].upper() + out[1:]
    if re.search(r"\bNASA\b", out, re.I):
        raise ValueError("la respuesta atribuye algo a NASA: se descarta")
    return out


def _clean(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip().strip('"').strip()
    text = re.sub(r"\s+", " ", text)
    parts = re.split(r"(?<=[a-záéíóúñ0-9)][.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])", text)
    parts = [p for p in parts if not re.search(r"\b(vs|e\.g|i\.e)\.$", p)] or parts
    if len(parts) > 1 and not re.search(r"[.!?]$", parts[-1]):
        parts = parts[:-1]  # quita la última frase si quedó cortada por max_tokens
    return " ".join(parts[:2]).strip()


def complete(messages, max_tokens=90, temperature=0.5):
    """Devuelve (texto, latency_ms) o lanza excepción."""
    if not LLM_URL:
        raise RuntimeError("METIS_LLM_URL vacío")
    t0 = time.time()
    r = httpx.post(LLM_URL.rstrip("/") + "/chat/completions", timeout=LLM_TIMEOUT, json={
        "model": LLM_MODEL, "max_tokens": max_tokens, "temperature": temperature, "messages": messages})
    r.raise_for_status()
    text = strip_attribution(_clean(r.json()["choices"][0]["message"]["content"]))
    if not text or FORBIDDEN.search(text):
        raise ValueError("respuesta vacía o con fármaco/dosis: se descarta")
    return text, int((time.time() - t0) * 1000)


def status():
    if not LLM_URL:
        return {"ok": False, "model": None, "url": None}
    base = LLM_URL.rstrip("/")
    root = base[:-3] if base.endswith("/v1") else base
    try:
        r = httpx.get(root + "/health", timeout=1.5)
        ok = r.status_code == 200
    except Exception:
        ok = False
    return {"ok": ok, "model": LLM_MODEL, "url": base}


def system_for(lang, name):
    return SYSTEM[lang].format(name=name or "the astronaut")
