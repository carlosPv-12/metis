# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Voz sin conexión de Metis.
TTS: Kokoro-82M (ONNX, Apache-2.0) -> Piper (si hay binario y voz) -> espeak-ng (último recurso).
STT: whisper.cpp (whisper-cli, modelo multilingüe base) con ffmpeg para pasar a WAV 16 kHz mono.
     Sin whisper-cli (Mac/WSL sin compilar): pywhispercpp (ruedas precompiladas de whisper.cpp, MIT) con el mismo
     ggml-base.bin. Sin ffmpeg: el audio se decodifica con PyAV (BSD-3-Clause; FFmpeg LGPL dentro de la rueda).
Todo se busca bajo METIS_HOME (por defecto ~/.local/share/metis). Nada sale a la red."""
import io, os, pathlib, shutil, subprocess, tempfile, threading, time, wave

HOME = pathlib.Path(os.path.expanduser(os.environ.get("METIS_HOME", "~/.local/share/metis")))
THREADS = int(os.environ.get("METIS_THREADS", "4"))
# whisper aprovecha más núcleos (medido el 14-nov en 16 CPU: «Yes» 830 -> 570 ms con 8); Kokoro va peor con 8, se queda en THREADS.
STT_THREADS = int(os.environ.get("METIS_STT_THREADS", str(max(THREADS, min(8, os.cpu_count() or 4)))))
KOKORO_DIR = pathlib.Path(os.path.expanduser(os.environ.get("METIS_KOKORO_DIR", str(HOME / "kokoro"))))
PIPER_DIR = HOME / "piper"
def _default_whisper():
    base = HOME / "whisper.cpp-src" / "build" / "bin"
    for c in (base / "whisper-cli", base / "whisper-cli.exe", base / "Release" / "whisper-cli.exe"):  # Linux/macOS, Windows (Ninja), Windows (MSVC)
        if c.exists():
            return c
    return base / ("whisper-cli.exe" if os.name == "nt" else "whisper-cli")


WHISPER_BIN = pathlib.Path(os.path.expanduser(os.environ["METIS_WHISPER_BIN"])) if os.environ.get("METIS_WHISPER_BIN") else _default_whisper()
PIPER_EXCLUDE = ("lessac",)  # dataset Blizzard 2013 Lessac: licencia de investigación, no OSI; no se ofrece
WHISPER_MODEL = pathlib.Path(os.path.expanduser(os.environ.get("METIS_WHISPER_MODEL", str(HOME / "whisper.cpp-src/models/ggml-base.bin"))))

# Voces por defecto (provisionales hasta que Juan elija; ver investigacion/voces-sin-conexion.md)
DEFAULT_VOICE = {"en": os.environ.get("METIS_VOICE_EN", "kokoro:af_heart"),
                 "es": os.environ.get("METIS_VOICE_ES", "kokoro:ef_dora")}
KOKORO_VOICES = [  # (id, etiqueta, idioma kokoro, idioma metis)
    ("af_heart", "Heart (US English, female)", "en-us", "en"),
    ("af_bella", "Bella (US English, female)", "en-us", "en"),
    ("af_nicole", "Nicole (US English, female, soft)", "en-us", "en"),
    ("am_michael", "Michael (US English, male)", "en-us", "en"),
    ("am_fenrir", "Fenrir (US English, male)", "en-us", "en"),
    ("ef_dora", "Dora (Spanish, female)", "es", "es"),
    ("em_alex", "Alex (Spanish, male)", "es", "es"),
]
ESPEAK = {"en": "en-us", "es": "es"}

_kokoro = None
_kokoro_err = None
_lock = threading.Lock()


def _kokoro_files():
    return KOKORO_DIR / "kokoro-v1.0.onnx", KOKORO_DIR / "voices-v1.0.bin"


def kokoro():
    """Carga perezosa de Kokoro (unos 300 MB en RAM). Devuelve None si no está disponible."""
    global _kokoro, _kokoro_err
    if _kokoro is not None or _kokoro_err is not None:
        return _kokoro
    with _lock:
        if _kokoro is None and _kokoro_err is None:
            try:
                import onnxruntime as ort
                from kokoro_onnx import Kokoro
                model, voices = _kokoro_files()
                so = ort.SessionOptions(); so.intra_op_num_threads = THREADS; so.inter_op_num_threads = 1
                sess = ort.InferenceSession(str(model), so, providers=["CPUExecutionProvider"])
                _kokoro = Kokoro.from_session(sess, str(voices))
            except Exception as e:  # sin modelo, sin paquete, etc.
                _kokoro_err = repr(e)
    return _kokoro


def _piper_bin():
    p = PIPER_DIR / "piper" / ("piper.exe" if os.name == "nt" else "piper")
    return p if p.exists() else None


def _piper_voices():
    """Solo las voces que el binario Piper 2023 (1.2) sabe leer; las de piper_version >= 1.5 necesitan piper1-gpl."""
    import json
    out = []
    for p in (sorted(PIPER_DIR.glob("*.onnx")) if PIPER_DIR.exists() else []):
        try:
            v = json.loads(pathlib.Path(str(p) + ".json").read_text(encoding="utf-8")).get("piper_version", "1.0.0")
            if tuple(int(x) for x in v.split(".")[:2]) < (1, 5) and not any(x in p.name for x in PIPER_EXCLUDE):
                out.append(p)
        except Exception:
            pass
    return out


def voices():
    out = []
    model, vb = _kokoro_files()
    if model.exists() and vb.exists():
        out += [{"id": f"kokoro:{v}", "label": label, "engine": "kokoro-82m", "lang": lm, "license": "Apache-2.0 (hexgrad/Kokoro-82M)"}
                for v, label, _, lm in KOKORO_VOICES]
    if _piper_bin():
        for p in _piper_voices():
            name = p.name[:-5]
            lic = "CC0 (dataset)" if "davefx" in name else "see MODEL_CARD"
            out.append({"id": f"piper:{name}", "label": name, "engine": "piper", "lang": name[:2], "license": lic})
    if shutil.which("espeak-ng"):
        out += [{"id": f"espeak:{v}", "label": f"espeak-ng {v} (robotic fallback)", "engine": "espeak-ng", "lang": l, "license": "GPL-3.0"} for l, v in ESPEAK.items()]
    return out


def _wav_bytes(samples, sr):
    import numpy as np
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm)
    return buf.getvalue()


def tts(text: str, voice: str | None = None, lang: str = "en", speed: float = 1.0):
    """Devuelve (wav_bytes, engine, voice_id). Lanza RuntimeError si ningún motor funciona."""
    lang = "es" if lang == "es" else "en"
    text = (text or "").strip()[:600]
    if not text:
        raise RuntimeError("texto vacío")
    voice = voice or DEFAULT_VOICE[lang]
    eng, _, vid = voice.partition(":")
    errors = []
    if eng == "kokoro":
        k = kokoro()
        if k is not None:
            kl = next((x[2] for x in KOKORO_VOICES if x[0] == vid), "es" if lang == "es" else "en-us")
            with _lock:
                s, sr = k.create(text, voice=vid, speed=speed, lang=kl)
            return _wav_bytes(s, sr), "kokoro-82m", voice
        errors.append(f"kokoro: {_kokoro_err}")
        eng, vid = "espeak", ESPEAK[lang]
    if eng == "piper" and _piper_bin():
        model = PIPER_DIR / f"{vid}.onnx"
        with tempfile.TemporaryDirectory() as td:
            out = pathlib.Path(td) / "o.wav"
            r = subprocess.run([str(_piper_bin()), "-m", str(model), "-f", str(out)], input=text.encode(), capture_output=True, timeout=60)
            if r.returncode == 0 and out.exists():
                return out.read_bytes(), "piper", voice
            errors.append(f"piper: {r.stderr[-200:]!r}")
        eng, vid = "espeak", ESPEAK[lang]
    if shutil.which("espeak-ng"):
        v = vid if eng == "espeak" else ESPEAK[lang]
        r = subprocess.run(["espeak-ng", "-v", v, "-s", "160", "--stdout", text], capture_output=True, timeout=30)
        if r.returncode == 0 and r.stdout:
            return r.stdout, "espeak-ng", f"espeak:{v}"
        errors.append("espeak-ng falló")
    raise RuntimeError("; ".join(errors) or "sin motor TTS")


def tts_status():
    model, vb = _kokoro_files()
    if model.exists() and vb.exists():
        return {"ok": True, "engine": "kokoro-82m", "voices": DEFAULT_VOICE, "loaded": _kokoro is not None, "error": _kokoro_err}
    if shutil.which("espeak-ng"):
        return {"ok": True, "engine": "espeak-ng (fallback)", "voices": {l: f"espeak:{v}" for l, v in ESPEAK.items()}}
    return {"ok": False, "engine": None, "voices": {}}


def _stt_engine():
    """'whisper.cpp' (binario whisper-cli, camino original) o 'pywhispercpp' (sin compilar) o None."""
    if WHISPER_BIN.exists():
        return "whisper.cpp"
    import importlib.util
    return "pywhispercpp" if importlib.util.find_spec("pywhispercpp") else None


def _ffmpeg():
    """ffmpeg del PATH; METIS_FFMPEG=off lo ignora (para probar la vía PyAV), o una ruta concreta."""
    v = os.environ.get("METIS_FFMPEG", "")
    if v.lower() in ("off", "0", "no"):
        return None
    return v if v and os.path.exists(v) else shutil.which("ffmpeg")


def _decoder():
    if _ffmpeg():
        return "ffmpeg"
    import importlib.util
    return "pyav" if importlib.util.find_spec("av") else None


def stt_status():
    eng, dec = _stt_engine(), _decoder()
    ok = eng is not None and dec is not None and WHISPER_MODEL.exists()
    return {"ok": ok, "engine": "whisper.cpp" if eng == "whisper.cpp" else ("whisper.cpp (pywhispercpp)" if eng else "whisper.cpp"),
            "model": WHISPER_MODEL.name if WHISPER_MODEL.exists() else None, "decoder": dec}


def _pcm16_pyav(audio: bytes) -> bytes:
    """Cualquier audio del navegador (webm/opus, mp4/aac de Safari, ogg, wav) -> PCM s16le 16 kHz mono, sin ffmpeg."""
    import av
    out = bytearray()
    with av.open(io.BytesIO(audio)) as c:
        rs = av.AudioResampler(format="s16", layout="mono", rate=16000)
        for frame in c.decode(audio=0):
            for f in rs.resample(frame):
                out += f.to_ndarray().astype("<i2").tobytes()
        for f in rs.resample(None):
            out += f.to_ndarray().astype("<i2").tobytes()
    return bytes(out)


def _to_wav16k(audio: bytes, td: pathlib.Path) -> pathlib.Path:
    src = td / "in.bin"; wav = td / "in.wav"
    src.write_bytes(audio)
    if _ffmpeg():
        r = subprocess.run([_ffmpeg(), "-loglevel", "error", "-y", "-threads", str(THREADS), "-i", str(src), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav)], capture_output=True, timeout=60)
        if r.returncode != 0:
            raise RuntimeError("ffmpeg no pudo convertir el audio: " + r.stderr.decode(errors="ignore")[-200:])
    else:
        try:
            pcm = _pcm16_pyav(audio)
        except Exception as e:
            raise RuntimeError(f"no se pudo decodificar el audio (PyAV): {e!r}"[:300])
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(pcm)
    return wav


# Pista de vocabulario para whisper: sin ella oye «Maddie's» en vez de «Metis» y falla la palabra de activación.
# Sin «Noor» ni «Kenji»: con «Noor» en la pista, whisper escribía «Noor» cuando alguien decía «No» (medido el 14-nov).
STT_PROMPT = os.environ.get("METIS_STT_PROMPT", "Metis, Lena, Marco, crew.")

_pyw = None
_pyw_lock = threading.Lock()


def _stt_pywhispercpp(wav: pathlib.Path, l: str, prompt: str = STT_PROMPT):
    """whisper.cpp vía pywhispercpp con el mismo ggml-base.bin; el modelo se carga una vez."""
    global _pyw
    import numpy as np
    with wave.open(str(wav), "rb") as w:
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    with _pyw_lock:
        if _pyw is None:
            from pywhispercpp.model import Model
            _pyw = Model(str(WHISPER_MODEL), redirect_whispercpp_logs_to=None, n_threads=STT_THREADS,
                         print_progress=False, print_realtime=False)
        segs = _pyw.transcribe(pcm, language=l, **({"initial_prompt": prompt} if prompt else {}))
        detected = l
        if l == "auto":
            try:
                import _pywhispercpp as pw
                detected = pw.whisper_lang_str(pw.whisper_full_lang_id(_pyw._ctx))
            except Exception:
                detected = "auto"
    return " ".join(" ".join(s.text for s in segs).split()), detected


# Depuración, apagada por defecto: con METIS_STT_SAVE_DIR=<carpeta fuera del repo> se guarda cada audio que llega al
# reconocimiento (WAV 16 kHz) y lo que whisper entendió, para medir mejoras con voces reales. Son grabaciones de
# voz de personas: no subirlas a ningún sitio y borrarlas al acabar.
STT_SAVE_DIR = os.environ.get("METIS_STT_SAVE_DIR", "")


def _save_debug(wav: pathlib.Path, text: str):
    if not STT_SAVE_DIR:
        return
    try:
        d = pathlib.Path(os.path.expanduser(STT_SAVE_DIR)); d.mkdir(parents=True, exist_ok=True)
        name = time.strftime("%H%M%S") + f"-{int(time.time() * 1000) % 1000:03d}"
        shutil.copy(wav, d / f"{name}.wav"); (d / f"{name}.txt").write_text(text + "\n", encoding="utf-8")
    except Exception:
        pass   # nunca romper el reconocimiento por la depuración


# Segundo oído para emergencias. Medido el 15-nov con la voz real de Carlos en la sede (sala con ruido, acento):
# el modelo «base» escribía «Marco, have a good day» o «Marco, Chas, Kolaset» por «Marco has collapsed»; el «small»
# con el audio normalizado y vocabulario de emergencia en la pista lo sacó en las dos grabaciones. Pero «small» oye
# peor «Metis» («Me, too.») y tarda 2-3 s en vez de 0,5. Así que «base» sigue mandando y «small» solo se consulta
# cuando hay una frase libre en la que «base» no ha visto ninguna emergencia; su versión solo se usa si ÉL sí la ve.
# Si ggml-small.bin no está instalado, no se hace nada.
WHISPER_SMALL = pathlib.Path(os.path.expanduser(os.environ.get("METIS_WHISPER_SMALL", str(WHISPER_MODEL.parent / "ggml-small.bin"))))
SMALL_PROMPT = "Metis, Lena, Marco, crew. Collapsed, not breathing, chest pain, help, alert the crew."
_pyw_small = None


def second_opinion(base_text: str, hint: str, lang: str, transcribe_small):
    """Texto del segundo oído si detecta una emergencia que «base» no vio; si no, None (se queda lo de «base»)."""
    if hint or lang == "es" or os.environ.get("METIS_STT_SECOND", "1") == "0":
        return None                      # respuestas cortas esperadas (sí/no) o español: el vocabulario es inglés
    import llm, voice_answer
    clean = voice_answer.clean_transcript(base_text)
    if not clean or llm.EMERGENCY.search(clean):
        return None                      # silencio, o «base» ya la ha visto
    wake, rest = voice_answer.match_wake(clean)
    if wake and not rest:
        return None                      # «Metis» a secas: contestar rápido
    try:
        text = voice_answer.clean_transcript(transcribe_small() or "")
    except Exception:
        return None                      # el segundo oído nunca rompe el reconocimiento
    return text if text and llm.EMERGENCY.search(text) else None


def _louder(wav: pathlib.Path, td: pathlib.Path) -> pathlib.Path:
    """Recorta el silencio de los extremos y sube el volumen al 60 % del máximo (así se midió)."""
    import numpy as np
    with wave.open(str(wav), "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    e = np.abs(x)
    if len(x) and e.max() > 1e-4:
        idx = np.where(e > max(e.max() * 0.08, 0.003))[0]
        x = x[max(0, idx[0] - 4000): idx[-1] + 4000]
        x = np.clip(x * min(0.6 / np.abs(x).max(), 30), -1, 1)
    out = td / "louder.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes((x * 32767).astype("<i2").tobytes())
    return out


def _stt_small(wav: pathlib.Path, l: str) -> str:
    global _pyw_small
    if not WHISPER_SMALL.exists():
        return ""
    if _stt_engine() == "pywhispercpp":
        import numpy as np
        with wave.open(str(wav), "rb") as w:
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
        with _pyw_lock:
            if _pyw_small is None:
                from pywhispercpp.model import Model
                _pyw_small = Model(str(WHISPER_SMALL), redirect_whispercpp_logs_to=None, n_threads=STT_THREADS,
                                   print_progress=False, print_realtime=False)
            return " ".join(" ".join(s.text for s in _pyw_small.transcribe(pcm, language=l, initial_prompt=SMALL_PROMPT)).split())
    r = subprocess.run([str(WHISPER_BIN), "-m", str(WHISPER_SMALL), "-t", str(STT_THREADS), "-l", l, "-nt", "--prompt", SMALL_PROMPT, "-f", str(wav)],
                       capture_output=True, timeout=60)
    return " ".join(r.stdout.decode(errors="ignore").split()) if r.returncode == 0 else ""


def stt(audio: bytes, lang: str = "auto", hint: str = ""):
    """hint: respuestas esperadas («Yes. No.»); se suman a la pista de vocabulario y whisper acierta más en frases cortas."""
    prompt = " ".join(x for x in (STT_PROMPT, (hint or "")[:200]) if x)
    """Audio (webm/ogg/wav/mp3/mp4) -> (texto, idioma detectado o pedido). Lanza RuntimeError si falla."""
    if not stt_status()["ok"]:
        raise RuntimeError("whisper.cpp (o pywhispercpp), su modelo o el decodificador de audio (ffmpeg o PyAV) no están disponibles")
    with tempfile.TemporaryDirectory() as td:
        wav = _to_wav16k(audio, pathlib.Path(td))
        l = lang if lang in ("en", "es") else "auto"
        if _stt_engine() == "pywhispercpp":
            try:
                out = _stt_pywhispercpp(wav, l, prompt)
                _save_debug(wav, out[0])
                second = second_opinion(out[0], hint, l, lambda: _stt_small(_louder(wav, pathlib.Path(td)), l))
                return (second, out[1]) if second else out
            except Exception as e:
                raise RuntimeError(f"pywhispercpp falló: {e!r}"[:300])
        r = subprocess.run([str(WHISPER_BIN), "-m", str(WHISPER_MODEL), "-t", str(STT_THREADS), "-l", l, "-nt", *(["--prompt", prompt] if prompt else []), "-f", str(wav)], capture_output=True, timeout=120)
        if r.returncode != 0:
            raise RuntimeError("whisper.cpp falló: " + r.stderr.decode(errors="ignore")[-200:])
        text = " ".join(r.stdout.decode(errors="ignore").split())
        second = second_opinion(text, hint, l, lambda: _stt_small(_louder(wav, pathlib.Path(td)), l))
        if second:
            return second, (l if l != "auto" else "en")
        detected = l
        if l == "auto":
            err = r.stderr.decode(errors="ignore")
            i = err.find("auto-detected language:")
            detected = err[i + 23:i + 27].strip()[:2] if i >= 0 else "auto"
        return text, detected
