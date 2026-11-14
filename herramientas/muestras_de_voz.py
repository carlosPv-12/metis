# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
# Genera las muestras de voz comparadas en investigacion/voces-sin-conexion.md (WAV en ./samples; se pasaron a MP3 con ffmpeg).
# Uso: python3 muestras_de_voz.py (necesita kokoro-onnx y los modelos en METIS_HOME; Piper y espeak-ng, si están, también).
import os, time, subprocess, json, sys, soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
EN = "Lena, I'm here with you. Your resting heart rate is higher than usual tonight. Let's take it one step at a time."
ES = "Lena, estoy contigo. Tu pulso en reposo está más alto de lo habitual esta noche. Vamos paso a paso."
H = os.path.expanduser(os.environ.get("METIS_HOME", "~/.local/share/metis"))
os.makedirs("samples", exist_ok=True)
so = ort.SessionOptions(); so.intra_op_num_threads = 4; so.inter_op_num_threads = 1
k = Kokoro.from_session(ort.InferenceSession(H + "/kokoro/kokoro-v1.0.onnx", so, providers=["CPUExecutionProvider"]), H + "/kokoro/voices-v1.0.bin")
k.create("warm up", voice="af_heart", lang="en-us")
res = []
def dur(p): i = sf.info(p); return i.frames / i.samplerate
for v, lang, text in [("af_heart", "en-us", EN), ("af_bella", "en-us", EN), ("af_nicole", "en-us", EN), ("am_michael", "en-us", EN), ("ef_dora", "es", ES), ("em_alex", "es", ES), ("af_heart", "es", ES)]:
    t = time.time(); s, sr = k.create(text, voice=v, lang=lang); el = time.time() - t
    name = f"kokoro-{v}-{lang[:2]}"; sf.write(f"samples/{name}.wav", s, sr)
    res.append((name, el, len(s) / sr))
def ext(name, cmd, inp=None):
    t = time.time()
    try: subprocess.run(cmd, input=inp, check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError) as e: print(f"{name}: no disponible ({e.__class__.__name__})"); return
    el = time.time() - t
    res.append((name, el, dur(f"samples/{name}.wav")))
ext("piper-lessac-en", [H + "/piper/piper/piper", "-m", H + "/piper/en_US-lessac-medium.onnx", "-f", "samples/piper-lessac-en.wav"], EN.encode())
ext("piper-davefx-es", [os.environ.get("PIPER_ES_BIN", "piper"), "-m", H + "/piper/es_ES-davefx-medium.onnx", "-f", "samples/piper-davefx-es.wav"], ES.encode())
ext("espeak-en", ["espeak-ng", "-v", "en-us", "-s", "160", "-w", "samples/espeak-en.wav", EN])
ext("espeak-es", ["espeak-ng", "-v", "es", "-s", "160", "-w", "samples/espeak-es.wav", ES])
for n, el, d in res: print(f"{n}\tsynth {el:.2f}s\taudio {d:.2f}s\tRTF {el/d:.3f}")
