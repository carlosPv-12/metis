# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Respuestas habladas al triaje (manos libres). Determinista, sin IA: empareja lo que dijo la persona
con una opción del paso actual. Si hay duda (las dos opciones o ninguna), devuelve None y se repite la pregunta;
en una emergencia es mejor preguntar otra vez que elegir mal."""
import re, unicodedata

# Restos que whisper.cpp escribe cuando no hay voz: [BLANK_AUDIO], (music), *silence*...
NOISE = re.compile(r"\[[^\]]*\]|\([^)]*\)|\*[^*]*\*")
# Frases que whisper se inventa con silencio o ruido (vistas el 15-nov: «Thank you for your time, and I'll see you
# next time.»). Se quitan para que no cierren la conversación ni tapen el «Metis» que va detrás.
# Un «Thank you.» suelto se deja: puede ser de verdad y sirve para acabar.
HALLUCINATION = re.compile(r"(?i)\b(?:(?:thank you|thanks) (?:so much )?for (?:your time|watching|listening)"
                           r"|(?:and )?i'?ll see you (?:next time|in the next (?:one|video))|see you next time"
                           r"|please subscribe|subt[ií]tulos (?:realizados )?por .*$|gracias por ver(?: el v[ií]deo)?)[.,!?]*")


def clean_transcript(text: str) -> str:
    """Quita las marcas de ruido de whisper y espacios; cadena vacía si no queda voz."""
    t = " ".join(HALLUCINATION.sub(" ", NOISE.sub(" ", text or "")).split()).lstrip(",.;:!? ")
    return "" if not re.search(r"\w", t) else t


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # sin tildes: "sí" -> "si"
    return " " + re.sub(r"[^a-z0-9 ]+", " ", s.replace("'", "").replace("’", "")) + " "


# Negaciones primero: "he isn't breathing" contiene "breathing" pero es un no.
# Cómo escribe whisper un «yes» o un «no» suelto, sobre todo con acento (sin tildes, en minúsculas).
FUZZY_YES = {"yes", "yeah", "yep", "yup", "ya", "yah", "yea", "yess", "yesh", "jes", "jess", "ies", "yas", "yis", "jah", "mhm",
             "uhhuh", "affirmative", "correct", "sure", "si", "sip", "vale", "claro"}
FUZZY_NO = {"no", "nope", "nah", "know", "now", "noh", "nou", "nop", "noo", "nooo", "negative", "not", "nein"}
UNSURE = re.compile(r" (dont know|not sure|unsure|no idea|maybe|perhaps|i think|no se|no lo se|ni idea|quizas|tal vez|puede que|creo que) ")
SKIP = re.compile(r" (rather not|prefer not|not say|dont want to say|dont want to talk|pass|skip|prefiero no|no quiero decir|no quiero contestar|no quiero responder) ")
NO = re.compile(r" (no|nope|nah|not|never|negative|isnt|doesnt|dont|cant|wont|arent|hasnt|gasping|nada|nunca|tampoco|ni|boquea|apenas) ")
YES = re.compile(r" (yes|yeah|yep|yup|sure|correct|affirmative|ok|okay|si|claro|vale|correcto|afirmativo|exacto) ")
# Describen el estado bueno; cuentan como "sí" solo si no hay ninguna negación ("he is breathing").
STATE = re.compile(r" (breathing|breathes|responding|responds|responsive|awake|conscious|talking|respira|responde|contesta|consciente|despiert[oa]|habla) ")
LESS = re.compile(r" (less|under|few|couple|just|recently|menos|pocos|poco|acaba|recien) ")
MORE = re.compile(r" (more|over|long|longer|hour|hours|ages|mas|hora|horas|rato|mucho) ")
NUM = re.compile(r" (\d+) ")
WORDNUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
           "fifteen": 15, "twenty": 20, "thirty": 30, "uno": 1, "un": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
           "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "quince": 15, "veinte": 20, "treinta": 30, "media": 30}


def _minutes(t: str):
    m = NUM.search(t)
    if m:
        return int(m.group(1))
    for w, v in WORDNUM.items():
        if f" {w} " in t:
            return v
    return None


def match_option(text: str, options: list[dict], state_means_yes: bool = False) -> str | None:
    """options: [{id, label_en, label_es}] del nodo. Devuelve el id elegido o None si no está claro.
    state_means_yes: solo en preguntas del tipo «¿responde?» o «¿respira con normalidad?», donde «he is breathing» es un sí."""
    t = _norm(clean_transcript(text))
    if not t.strip():
        return None
    ids = {o["id"] for o in options}
    # «I'd rather not say» / «prefiero no decirlo»: solo donde el nodo ofrece esa salida (cribado de riesgo).
    if "skip" in ids and SKIP.search(t):
        return "skip"
    if UNSURE.search(t):
        # «No estoy seguro» es una respuesta propia donde el nodo la ofrece (en las señales de alarma cuenta como sí).
        return "unsure" if "unsure" in ids else None
    if {"si", "no"} <= ids and ids <= {"si", "no", "unsure", "skip"}:
        y, n, st = bool(YES.search(t)), bool(NO.search(t)), bool(STATE.search(t))
        if y and not n:
            return "si"
        if n and not y:
            return "no"          # "he is not breathing", "no responde"
        if state_means_yes and st and not n:
            return "si"          # "he is breathing"
        if not y and not n:      # frases cortas mal transcritas: «Know.», «Now.», «Jess.», «Yah.»
            short = t.split()
            if len(short) <= 3:
                fy, fn = any(w in FUZZY_YES for w in short), any(w in FUZZY_NO for w in short)
                if fy != fn:
                    return "si" if fy else "no"
        # «sí» y «no» a la vez («Yes. No.», «yes, he's not breathing»): no se adivina, se vuelve a preguntar.
        return None
    if ids == {"lt10", "gt10"}:
        mins = _minutes(t)
        l, m = bool(LESS.search(t)), bool(MORE.search(t))
        if mins is not None and " hour" not in t and " hora" not in t:
            if l and not m:   # "less than ten" -> menos; "less than twenty" no aclara
                return "lt10" if mins <= 10 else None
            if m and not l:   # "more than ten" -> más; "more than five" no aclara
                return "gt10" if mins >= 10 else None
            return "lt10" if mins < 10 else "gt10"
        if l != m:
            return "lt10" if l else "gt10"
        return None
    # Genérico: la opción cuya etiqueta comparte más palabras con lo dicho, solo si gana sin empate.
    score = {}
    for o in options:
        words = set(_norm(o.get("label_en", "") + " " + o.get("label_es", "")).split())
        score[o["id"]] = sum(1 for w in words if len(w) > 2 and f" {w} " in t)
    best = sorted(score.items(), key=lambda kv: -kv[1])
    if best and best[0][1] > 0 and (len(best) == 1 or best[0][1] > best[1][1]):
        return best[0][0]
    return None


# Órdenes habladas en la pantalla de resultado del triaje. Mismos tipos de evento que los botones.
CMD = {
    "alert_crew": re.compile(r" (crew|crewmates?|team|tripulacion|equipo|companeros) "),
    "alert_commander": re.compile(r" (commander|cmo|medical officer|officer|comandante|oficial|medico|medica) "),
    "send_flight_surgeon": re.compile(r" (surgeon|earth|ground|houston|cirujano|cirujana|tierra) "),
}
ALL = re.compile(r" (all|everyone|everybody|todo|todos|todas|a todos) ")


def match_commands(text: str) -> list[str]:
    """Qué avisos pide la persona («alert the crew», «avisa al comandante y a Tierra», «avisa a todos»)."""
    t = _norm(clean_transcript(text))
    if not t.strip():
        return []
    if ALL.search(t):
        return list(CMD)
    return [k for k, rx in CMD.items() if rx.search(t)]


# Palabra de activación «Metis». whisper la escribe de muchas formas (medido el 14-nov con voz Kokoro):
# «Meti's», «Me tiis», «Medis», «Medys», «Maddie's», «metís». Se acepta en las 4 primeras palabras.
WAKE = re.compile(r"^m[aeiy]+(t|d|th)+[aeiy]+e?[sz]$")
# Sin la «s» final, con voz real (Carlos, 15-nov): «Meti.», «Thank you, Meti.», «Medici.». Más estricta que WAKE
# para no despertar con «media», «meta», «mate» o «mete»: m + a/e + t/d + i (+ e / ci).
WAKE_NO_S = re.compile(r"^m[ae](t|d|tt|dd|th)i(e|ci)?$")
GREET = {"hey", "hi", "hello", "ok", "okay", "oye", "hola", "eh", "oh", "y", "and"}


def match_wake(text: str):
    """Devuelve (hay_palabra, resto_de_la_frase). «Hey Metis, how did I sleep?» -> (True, "how did I sleep?").
    También vale al empezar otra frase: whisper a veces pega delante un trozo de ruido o de la voz anterior
    («But I'm not in a hurry. Meti's, Marco is bad.», 15-nov)."""
    clean = clean_transcript(text)
    ok, rest = _wake_at_start(clean)
    if ok:
        return True, rest
    # En una frase posterior: solo la forma estricta (con «s»), para que una charla de fondo («…Maddie, come here»)
    # no despierte a Metis. Lo de delante NO se tira: «Marco collapsed, he is not breathing. Metis, help!» tiene que
    # llegar entero, porque de ahí sale qué emergencia es (revisión del 15-nov).
    for m in re.finditer(r"(?<=[.!?])\s+", clean):
        ok, rest = _wake_at_start(clean[m.end():], strict=True)
        if ok:
            return True, (clean[:m.start()] + " " + rest).strip()
    return False, clean


def _wake_at_start(clean: str, strict: bool = False):
    words = clean.split()
    norm = [_norm(w).strip() for w in words]
    for i in range(min(4, len(words))):
        if any(n and n not in GREET for n in norm[:i]):
            break  # antes de «Metis» solo puede haber un saludo
        for span in (1, 2):  # «Me tiis» llega partido en dos palabras
            joined = "".join(norm[i:i + span])
            # Sin «s» solo vale si va sola o con pausa detrás («Meti.», «Medi, how…»): «Metí la bolsa» y
            # «Medí la presión» son frases normales en español.
            alone = i + 1 == len(words) or words[i][-1:] in ",.;:!?"
            if i + span <= len(words) and (WAKE.match(joined) or (span == 1 and not strict and alone and WAKE_NO_S.match(joined))):
                rest = " ".join(words[i + span:]).lstrip(",.;:!?¡¿ ")
                return True, rest
    return False, clean


# Fin de la conversación: «thanks Metis», «that's all», «finish», «gracias Metis», «eso es todo», «terminar»…
END_STRONG = re.compile(r" (thats all|that is all|finish|finished|were done|we are done|im done|goodbye|good bye|bye|end (the )?conversation|"
                        r"stop listening|eso es todo|terminar|termina|terminado|hemos terminado|adios|hasta luego|ya esta|fin de la conversacion) ")
THANKS = re.compile(r" (thanks|thank you|thank|gracias|muchas gracias) ")


def match_end(text: str) -> bool:
    """¿Quiere cerrar la conversación? «Thanks, Metis» sí; «thanks, and how did I sleep?» no (frase larga con pregunta)."""
    t = _norm(clean_transcript(text))
    if not t.strip():
        return False
    if END_STRONG.search(t):
        return True
    return bool(THANKS.search(t)) and len(t.split()) <= 4
