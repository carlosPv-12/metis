# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Instalador de Metis (lo lanza instalar.sh con el Python 3.12 de uv; solo biblioteca estándar).

Deja en METIS_HOME (por defecto ~/.local/share/metis), con la estructura que buscan run_demo.py, llm.py
y voice_engine.py: llama.cpp b12373, Qwen3-4B-Instruct-2507 Q4_K_M, Kokoro v1.0, ggml-base.bin de whisper,
un venv con las dependencias exactas (backend/requirements-lock.txt) y, con --dev, Node LTS y npm ci.
Cada archivo se comprueba con su SHA-256; las descargas se reanudan si se cortan.

Opciones:
  --desde X          busca primero los archivos en X (carpeta o http://IP:PUERTO de otro portátil con --servir);
                     lo que no encuentre allí lo baja de internet. El hash se comprueba siempre.
  --servir [PUERTO]  sirve en la red local, en solo lectura, los archivos de este METIS_HOME (puerto 8765).
  --dev              además: Node LTS en METIS_HOME/node y npm ci en frontend/ (para editar el código).
  --comprobar        solo la comprobación final (arranca todo en puertos de prueba y lo prueba).
  --sin-comprobar    instala sin la comprobación final.
  --puertos N        puertos de la comprobación: backend N, IA N+1 (por defecto 8790).
  --frontend-dir D   carpeta del frontend para npm ci (por defecto frontend/ junto a este archivo).
  --reinstalar-node-modules   borra y rehace frontend/node_modules con npm ci aunque ya exista.
"""
import difflib, hashlib, http.server, io, json, os, pathlib, platform, shutil, signal, socket, subprocess, sys, tarfile, time
import urllib.error, urllib.request, uuid, wave

HERE = pathlib.Path(__file__).resolve().parent
HOME = pathlib.Path(os.path.expanduser(os.environ.get("METIS_HOME", "~/.local/share/metis")))
VENV = HOME / "venv"
LLAMA_TAG = "b12373"
NODE_VER = "v24.22.2"  # LTS «Krypton», 27-oct-2026; Vite 8 pide Node 20.19+ o 22.12+

SYS = {("Darwin", "arm64"): "macos-arm64", ("Darwin", "x86_64"): "macos-x64",
       ("Linux", "x86_64"): "linux-x64", ("Linux", "aarch64"): "linux-arm64"}.get((platform.system(), platform.machine()))
IS_WSL = "microsoft" in platform.release().lower()

GH_LLAMA = f"https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_TAG}/llama-{LLAMA_TAG}-bin-"
LLAMA = {  # SHA-256 publicados por GitHub en la release (el de Linux coincide con el de Tomás)
    "macos-arm64": ("macos-arm64.tar.gz", 16914919, "e110939c0ee194f8c776d647869060ead1d00d59b494530a739551d83b91bad4"),
    "macos-x64": ("macos-x64.tar.gz", 12664788, "4cdabf4c8241c3740eeedc11244308fbea4c42cb5e778039af4b84489cbc1999"),
    "linux-x64": ("ubuntu-x64.tar.gz", 23332216, "d9665817c0737f6c8637cda882a5bf7fd35aa6aaddfa5095dffc7889359554d3"),
    "linux-arm64": ("ubuntu-arm64.tar.gz", 18963213, "849e2446038fc0241ea60854f928c71cf6a02442945a794dc5c002b3af549c41"),
}
NODE = {  # SHA-256 de https://nodejs.org/dist/<versión>/SHASUMS256.txt
    "macos-arm64": ("darwin-arm64", "aa9549349e47dffaa42dcf95d6e06ade8c4bdafc980979883b88767670df385a"),
    "macos-x64": ("darwin-x64", "d5e336d588c45be0c37dbd52cc29895593009ca4997a77a1fd02815131ed0e52"),
    "linux-x64": ("linux-x64", "361718c444e49af2ca5a110c83ba6a8901143f23ab285ebbef0341f391f482a9"),
    "linux-arm64": ("linux-arm64", "95c264150aceb7f3437a29fd6984924f5f8d1511ea3cbd6c508b83f6c555dae2"),
}
HF = "https://huggingface.co"
# (ruta en METIS_HOME, URL fijada a un commit o release, tamaño, SHA-256, licencia, otros nombres que acepta --desde/--servir)
MODELS = [
    ("models/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
     f"{HF}/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/a06e946bb6b655725eafa393f4a9745d460374c9/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
     2497281120, "3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597", "Apache-2.0 (Qwen)", []),
    ("kokoro/kokoro-v1.0.onnx", "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
     325532387, "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5", "Apache-2.0 (hexgrad/Kokoro-82M)", []),
    ("kokoro/voices-v1.0.bin", "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
     28214398, "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d", "Apache-2.0 (hexgrad/Kokoro-82M)", []),
    ("whisper.cpp-src/models/ggml-base.bin",
     f"{HF}/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin",
     147951465, "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe", "MIT (OpenAI Whisper / whisper.cpp)", []),
    # segundo oído para emergencias (backend/voice_engine.py, second_opinion); sin él, la demo funciona igual que antes
    ("whisper.cpp-src/models/ggml-small.bin",
     f"{HF}/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin",
     487601967, "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b", "MIT (OpenAI Whisper / whisper.cpp)", []),
]


def llama_entry(plat):
    suf, size, sha = LLAMA[plat]
    name = f"llama-{LLAMA_TAG}-bin-{suf}"
    alias = ["llama.tar.gz"] if plat == "linux-x64" else []  # nombre con el que lo guardó Tomás
    return (f"descargas/{name}", GH_LLAMA + suf, size, sha, "MIT (llama.cpp)", alias)


def node_entry(plat):
    suf, sha = NODE[plat]
    name = f"node-{NODE_VER}-{suf}.tar.gz"
    return (f"descargas/{name}", f"https://nodejs.org/dist/{NODE_VER}/{name}", None, sha, "MIT (Node.js)", [])


def say(msg):
    print(f"[metis] {msg}", flush=True)


def human(n):
    return f"{n / 1e9:.2f} GB" if n >= 1e9 else f"{n / 1e6:.1f} MB"


class Bar:
    def __init__(self, label, total, done=0):
        self.label, self.total, self.done, self.t0, self.last, self.base = label, total, done, time.time(), 0, done

    def add(self, n):
        self.done += n
        now = time.time()
        if now - self.last < 0.25 and self.done < (self.total or 0):
            return
        self.last = now
        speed = (self.done - self.base) / max(now - self.t0, 1e-6)
        if self.total:
            pct = self.done / self.total
            eta = (self.total - self.done) / speed if speed > 0 else 0
            bar = "#" * int(pct * 24)
            sys.stderr.write(f"\r  {self.label[:34]:34} [{bar:24}] {pct * 100:5.1f}% {human(self.done)} de {human(self.total)}"
                             f" {speed / 1e6:5.1f} MB/s  quedan {int(eta // 60)}:{int(eta % 60):02d} ")
        else:
            sys.stderr.write(f"\r  {self.label[:34]:34} {human(self.done)} {speed / 1e6:5.1f} MB/s ")
        sys.stderr.flush()

    def end(self):
        sys.stderr.write("\n"); sys.stderr.flush()


def sha_file(p, label):
    h = hashlib.sha256()
    bar = Bar("comprobando " + label, p.stat().st_size)
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b); bar.add(len(b))
    bar.end()
    return h.hexdigest()


def stamp(p):
    st = p.stat()
    return f"{st.st_size}:{int(st.st_mtime)}"


def verified(p, sha):
    """Ya comprobado antes (marca con tamaño y fecha) o se comprueba ahora."""
    mark = p.with_name(p.name + ".sha256ok")
    if mark.exists() and mark.read_text().strip() == f"{stamp(p)}:{sha}":
        return True
    if sha_file(p, p.name) == sha:
        mark.write_text(f"{stamp(p)}:{sha}\n")
        return True
    return False


def fetch_url(url, part, label, size):
    """Descarga reanudable a .part; devuelve el SHA-256 de todo el archivo."""
    h = hashlib.sha256()
    have = part.stat().st_size if part.exists() else 0
    if have:
        with open(part, "rb") as f:
            for b in iter(lambda: f.read(1 << 20), b""):
                h.update(b)
    req = urllib.request.Request(url, headers={"User-Agent": "metis-instalador", **({"Range": f"bytes={have}-"} if have else {})})
    try:
        r = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as e:
        if e.code == 416 and size and have == size:  # ya estaba entero
            return h.hexdigest()
        raise
    with r:
        if have and r.status != 206:  # el servidor no reanuda: empezar de cero
            have, h = 0, hashlib.sha256()
            part.unlink()
        total = size or (int(r.headers.get("Content-Length", 0)) + have) or None
        bar = Bar(label, total, have)
        with open(part, "ab") as f:
            for b in iter(lambda: r.read(1 << 20), b""):
                f.write(b); h.update(b); bar.add(len(b))
        bar.end()
    return h.hexdigest()


def copy_local(src, part, label):
    h = hashlib.sha256()
    bar = Bar(label, src.stat().st_size)
    with open(src, "rb") as fi, open(part, "wb") as fo:
        for b in iter(lambda: fi.read(1 << 20), b""):
            fo.write(b); h.update(b); bar.add(len(b))
    bar.end()
    return h.hexdigest()


def candidates(desde, rel, aliases):
    """Dónde buscar el archivo en la fuente de --desde: misma ruta, alias o solo el nombre (carpeta plana)."""
    names = [rel] + aliases + [pathlib.PurePosixPath(rel).name]
    out = []
    for n in dict.fromkeys(names):
        out.append(desde.rstrip("/") + "/" + n if desde.startswith(("http://", "https://")) else pathlib.Path(desde).expanduser() / n)
    return out


def ensure(entry, desde):
    rel, url, size, sha, lic, aliases = entry
    dest = HOME / rel
    label = pathlib.PurePosixPath(rel).name
    if dest.exists() and verified(dest, sha):
        say(f"ya está: {rel} ({lic})")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    sources = (candidates(desde, rel, aliases) if desde else []) + [url]
    for src in sources:
        try:
            if isinstance(src, pathlib.Path):
                if not src.is_file():
                    continue
                say(f"copiando {label} desde {src}")
                got = copy_local(src, part, label)
            else:
                if src == url or src == sources[0]:
                    say(f"descargando {label} desde {src.split('/')[2]}")
                got = fetch_url(src, part, label, size)
        except (urllib.error.URLError, OSError, ValueError) as e:
            if src != url:
                part.unlink(missing_ok=True)
                if src == sources[-2]:
                    say(f"  {label} no está en {desde} ({getattr(e, 'code', e)}): lo bajo de internet")
                continue
            raise SystemExit(f"[metis] No se pudo descargar {label}: {e}. Comprueba la conexión y vuelve a lanzar el "
                             f"mismo comando: seguirá donde se quedó.")
        if got != sha:
            part.unlink(missing_ok=True)
            say(f"  {label}: el SHA-256 no coincide (esperado {sha[:12]}…, recibido {got[:12]}…); lo descarto")
            continue
        part.replace(dest)
        dest.with_name(dest.name + ".sha256ok").write_text(f"{stamp(dest)}:{sha}\n")
        say(f"listo: {rel} (SHA-256 correcto; licencia {lic})")
        return dest
    raise SystemExit(f"[metis] No hay ninguna copia válida de {label}. Vuelve a lanzar el comando (sin --desde si la "
                     f"copia local estaba mal).")


def extract(tgz, into, strip_top_as=None):
    into.mkdir(parents=True, exist_ok=True)
    tmp = into / f".extraer-{uuid.uuid4().hex[:8]}"
    with tarfile.open(tgz) as t:
        kw = {"filter": "tar"} if hasattr(tarfile, "data_filter") else {}
        t.extractall(tmp, **kw)
    tops = [p for p in tmp.iterdir()]
    target = into / (strip_top_as or tops[0].name)
    if target.exists():
        shutil.rmtree(target)
    tops[0].replace(target)
    shutil.rmtree(tmp, ignore_errors=True)
    if platform.system() == "Darwin":  # por si el archivo trae la marca de cuarentena de Gatekeeper
        subprocess.run(["xattr", "-dr", "com.apple.quarantine", str(target)], capture_output=True)
    return target


def install_llama(desde):
    exe = HOME / "llama.cpp" / f"llama-{LLAMA_TAG}" / "llama-server"
    tgz = ensure(llama_entry(SYS), desde)
    if not exe.exists():
        extract(tgz, HOME / "llama.cpp")
        say(f"llama.cpp {LLAMA_TAG} descomprimido en {HOME / 'llama.cpp'}")
    r = subprocess.run([str(exe), "--version"], capture_output=True, text=True, timeout=60)
    say("llama-server responde: " + ((r.stdout + r.stderr).strip().splitlines() or ["?"])[-1][:80])


def vpy():
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def install_venv():
    uv = os.environ.get("METIS_UV") or shutil.which("uv")
    if not uv:
        raise SystemExit("[metis] Falta uv: lanza el instalador con instalar.sh, no con python directamente.")
    if not vpy().exists():
        say("creando el entorno de Python 3.12 en " + str(VENV))
        subprocess.run([uv, "venv", "--quiet", "--python", "3.12", str(VENV)], check=True)
    say("instalando dependencias del backend (versiones exactas de backend/requirements-lock.txt; ~250 MB la primera vez)")
    subprocess.run([uv, "pip", "install", "--quiet", "--python", str(vpy()), "-r", str(HERE / "backend" / "requirements-lock.txt")], check=True)
    r = subprocess.run([str(vpy()), "-c", "import fastapi, uvicorn, kokoro_onnx, onnxruntime, pywhispercpp, av; print('ok')"],
                       capture_output=True, text=True)
    if r.stdout.strip() != "ok":
        raise SystemExit("[metis] Las dependencias no cargan:\n" + r.stderr[-800:])
    say("dependencias de Python cargan bien")


def node_bin():
    return HOME / "node" / "bin"


def install_node(desde, frontend, reinstall):
    tgz = ensure(node_entry(SYS), desde)
    node = node_bin() / "node"
    if not node.exists() or NODE_VER not in subprocess.run([str(node), "-v"], capture_output=True, text=True).stdout:
        extract(tgz, HOME, strip_top_as="node")
    say("Node " + subprocess.run([str(node), "-v"], capture_output=True, text=True).stdout.strip() + " en " + str(node_bin()))
    env = {**os.environ, "PATH": str(node_bin()) + os.pathsep + os.environ.get("PATH", "")}
    nm = frontend / "node_modules"
    if nm.exists() and not reinstall:
        say(f"{nm} ya existe: no lo toco (para rehacerlo: --reinstalar-node-modules)")
    else:
        say(f"npm ci en {frontend} (dependencias exactas de package-lock.json)")
        subprocess.run([str(node_bin() / "npm"), "ci", "--no-audit", "--no-fund"], cwd=str(frontend), env=env, check=True)
    r = subprocess.run([str(node_bin() / "npx"), "--no-install", "vite", "--version"], cwd=str(frontend), env=env, capture_output=True, text=True)
    say("Vite: " + (r.stdout.strip() or r.stderr.strip()[-200:]))


# ---------- --servir: los archivos de este METIS_HOME en la red local, solo lectura ----------
def served_files():
    files = {}
    plats = list(LLAMA)
    for e in MODELS + [llama_entry(p) for p in plats] + [node_entry(p) for p in plats]:
        rel, aliases = e[0], e[5]
        for cand in [rel] + aliases:
            if (HOME / cand).is_file():
                files[rel] = HOME / cand
                break
    return files


def serve(port):
    files = served_files()

    class H(http.server.BaseHTTPRequestHandler):
        def do_HEAD(self):
            self.do_GET(head=True)

        def do_GET(self, head=False):
            rel = self.path.split("?")[0].lstrip("/")
            p = files.get(rel)
            if not p:
                self.send_error(404); return
            size = p.stat().st_size
            start, end, code = 0, size - 1, 200
            rng = self.headers.get("Range", "")
            if rng.startswith("bytes="):
                a, _, b = rng[6:].partition("-")
                start = int(a or 0); end = int(b) if b else size - 1
                if start >= size:
                    self.send_response(416); self.send_header("Content-Range", f"bytes */{size}"); self.end_headers(); return
                code = 206
            self.send_response(code)
            self.send_header("Content-Length", str(end - start + 1)); self.send_header("Accept-Ranges", "bytes")
            if code == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            if head:
                return
            with open(p, "rb") as f:
                f.seek(start); left = end - start + 1
                while left > 0:
                    b = f.read(min(1 << 20, left))
                    if not b:
                        break
                    self.wfile.write(b); left -= len(b)

        def log_request(self, code="-", size="-"):
            say(f"{self.client_address[0]} pidió {self.path} ({code})")

        def log_message(self, fmt, *args):
            pass

    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("192.0.2.1", 9)); ips.add(s.getsockname()[0]); s.close()
    except OSError:
        pass
    try:
        ips.update(x for x in subprocess.run(["hostname", "-I"], capture_output=True, text=True).stdout.split() if "." in x)
    except OSError:
        pass
    say(f"sirviendo {len(files)} archivos (solo lectura) de {HOME}:")
    for rel, p in sorted(files.items()):
        print(f"    {rel}  ({human(p.stat().st_size)})")
    say("En el otro ordenador, desde la carpeta del brain, pega UNO de estos (el de la IP de tu wifi):")
    for ip in sorted(ips) or ["<IP-de-este-portátil>"]:
        print(f"    bash codigo/metis/instalar.sh --desde http://{ip}:{port}")
    say("Si no conecta, puede ser el cortafuegos de este portátil (Ubuntu: sudo ufw allow " + str(port) + "/tcp). Ctrl+C para parar.")
    srv = http.server.ThreadingHTTPServer((os.environ.get("METIS_SERVIR_IP", "0.0.0.0"), port), H)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        say("servidor parado")


# ---------- comprobación final ----------
def http_json(url, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"content-type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def multipart(url, wav, timeout=120):
    bnd = uuid.uuid4().hex
    body = (f"--{bnd}\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"prueba.wav\"\r\nContent-Type: audio/wav\r\n\r\n").encode() \
        + wav + f"\r\n--{bnd}\r\nContent-Disposition: form-data; name=\"lang\"\r\n\r\nen\r\n--{bnd}--\r\n".encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": f"multipart/form-data; boundary={bnd}"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


SAMPLE = "Hello Lena, this is Metis. Your sleep was short last night."


def check(port):
    pa, pl = port, port + 1
    for p in (pa, pl):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) == 0:
                raise SystemExit(f"[metis] El puerto {p} está ocupado; usa --puertos con otro número (p. ej. --puertos 8890).")
    py = vpy() if vpy().exists() else pathlib.Path(sys.executable)
    env = {**os.environ, "METIS_HOME": str(HOME), "METIS_VENV": str(VENV), "METIS_BACKEND_PORT": str(pa), "METIS_LLM_PORT": str(pl)}
    say(f"comprobación: arranco la demo en puertos de prueba (backend {pa}, IA {pl}); tarda 1-2 minutos")
    log = open(HOME / "comprobacion.log", "w")
    proc = subprocess.Popen([str(py), str(HERE / "run_demo.py"), "--no-browser"], env=env, stdout=log, stderr=subprocess.STDOUT,
                            start_new_session=True)
    B = f"http://127.0.0.1:{pa}"
    res = {}
    try:
        st = None
        for _ in range(300):
            try:
                st = http_json(B + "/api/status", timeout=3)
                if st["llm"]["ok"]:
                    break
            except Exception:
                pass
            if proc.poll() is not None:
                break
            time.sleep(1)
        if st is None:
            res["backend"] = (False, "el backend no arrancó; mira " + str(HOME / "comprobacion.log"))
        else:
            res["backend"] = (True, "responde en " + B)
            try:
                r = http_json(B + "/api/metis/chat", {"crew_id": "lena", "lang": "en", "message": "I feel a bit tired today."}, timeout=120)
                ok = r.get("source") == "llm"
                res["IA (Qwen3-4B)"] = (ok, f"«{r.get('text', '')[:90]}» en {r.get('latency_ms')} ms" if ok else
                                        "respondió con frase de reserva, no con la IA (¿llama-server no arrancó?)")
            except Exception as e:
                res["IA (Qwen3-4B)"] = (False, repr(e)[:150])
            wav = b""
            try:
                with urllib.request.urlopen(urllib.request.Request(B + "/api/voice/tts", data=json.dumps(
                        {"text": SAMPLE, "lang": "en"}).encode(),
                        headers={"content-type": "application/json"}), timeout=120) as r:
                    wav, engine = r.read(), r.headers.get("X-Metis-Engine")
                with wave.open(io.BytesIO(wav)) as w:
                    dur = w.getnframes() / w.getframerate()
                res["voz (Kokoro)"] = (engine == "kokoro-82m", f"WAV de {dur:.1f} s con {engine}")
            except Exception as e:
                res["voz (Kokoro)"] = (False, repr(e)[:150])
            if wav:
                try:
                    r = multipart(B + "/api/voice/stt", wav)
                    t = r.get("text", "")
                    norm = lambda x: "".join(c for c in x.lower() if c.isalnum() or c == " ").split()
                    ok = difflib.SequenceMatcher(None, norm(t), norm(SAMPLE)).ratio() >= 0.6
                    res["reconocimiento (whisper)"] = (ok, f"oyó «{t}» con {st['stt'].get('engine')}, decodificador {st['stt'].get('decoder')}")
                except urllib.error.HTTPError as e:
                    res["reconocimiento (whisper)"] = (False, e.read().decode(errors="ignore")[:200])
                except Exception as e:
                    res["reconocimiento (whisper)"] = (False, repr(e)[:150])
            try:
                with urllib.request.urlopen(B + "/", timeout=10) as r:
                    html = r.read(2000)
                res["página de la demo"] = (b"<" in html, f"{B}/ sirve metis-demo.html")
            except urllib.error.HTTPError as e:
                res["página de la demo"] = (False, f"{B}/ da {e.code} (falta demo/metis-demo.html o el backend no la sirve aún)")
            except Exception as e:
                res["página de la demo"] = (False, repr(e)[:150])
    finally:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGINT)
            try:
                proc.wait(30)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
        log.close()
    nxt = {"backend": "Vuelve a lanzar el instalador; si sigue, manda a Tomás el archivo " + str(HOME / "comprobacion.log"),
           "IA (Qwen3-4B)": "Mira " + str(HOME / "comprobacion.log") + "; sin IA la demo funciona igual con frases de reserva.",
           "voz (Kokoro)": "Vuelve a lanzar el instalador (comprueba kokoro/); sin Kokoro la demo usa la voz del navegador.",
           "reconocimiento (whisper)": "Vuelve a lanzar el instalador; sin reconocimiento se puede escribir en vez de hablar.",
           "página de la demo": "Para probar ya: --dev (con Node) o pide a Tomás la versión con demo/metis-demo.html."}
    print("\n================ Resultado de la comprobación ================")
    for k, (ok, msg) in res.items():
        print(f"  {'FUNCIONA ' if ok else 'NO VA    '} {k}: {msg}")
        if not ok:
            print(f"            Siguiente paso: {nxt.get(k, '')}")
    print("==============================================================")
    return all(ok for ok, _ in res.values())


def main():
    a = sys.argv[1:]

    def opt(name, default=None):
        if name in a:
            i = a.index(name)
            return a[i + 1] if i + 1 < len(a) and not a[i + 1].startswith("--") else default
        return None

    if SYS is None:
        raise SystemExit(f"[metis] Sistema no soportado: {platform.system()} {platform.machine()}")
    HOME.mkdir(parents=True, exist_ok=True)
    port = int(opt("--puertos") or 8790)
    if "--servir" in a:
        return serve(int(opt("--servir", "8765") or 8765))
    if "--comprobar" in a:
        sys.exit(0 if check(port) else 1)
    t0 = time.time()
    desde = opt("--desde")
    missing = sum(e[2] or 60_000_000 for e in MODELS + [llama_entry(SYS)] if not (HOME / e[0]).exists())
    free = shutil.disk_usage(HOME).free
    if free < missing + 1.5e9:
        raise SystemExit(f"[metis] Falta espacio en disco: hacen falta {human(missing + 1.5e9)} y hay {human(free)} libres.")
    say(f"instalando en {HOME} ({'WSL2' if IS_WSL else SYS}); faltan por traer {human(missing)}" + (f"; fuente local: {desde}" if desde else ""))
    install_llama(desde)
    for e in MODELS:
        ensure(e, desde)
    install_venv()
    if "--dev" in a:
        fe = pathlib.Path(opt("--frontend-dir") or HERE / "frontend").expanduser().resolve()
        install_node(desde, fe, "--reinstalar-node-modules" in a)
    say(f"instalación terminada en {int(time.time() - t0)} s")
    ok = True if "--sin-comprobar" in a else check(port)
    rel = os.path.relpath(HERE, pathlib.Path.cwd())
    print(f"\nPara arrancar la demo:  bash {rel}/arrancar.sh" + ("        (para editar: bash " + rel + "/arrancar.sh --dev)" if "--dev" in a else ""))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
