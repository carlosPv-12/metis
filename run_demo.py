# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Lanzador de la demo de Metis (Windows, macOS, Linux/WSL; solo biblioteca estándar).
Arranca, si no están ya en marcha: la IA local (llama-server, si encuentra binario y modelo) y el backend (8000).
- Si existe demo/metis-demo.html (la demo en un solo archivo), el backend la sirve en http://localhost:8000/ y se
  abre el navegador: no hace falta Node.
- Con --dev (o si no existe ese archivo), arranca también el frontend con Vite (5173), como antes.
Uso:  python3 run_demo.py             (macOS/WSL sin python3: bash arrancar.sh; Windows: py run_demo.py)
      python3 run_demo.py --dev       (modo desarrollo con Vite; no abre el navegador)
      python3 run_demo.py --no-llm    (sin IA local: Metis usa frases de reserva)
      python3 run_demo.py --no-browser
Variables: METIS_HOME (modelos; por defecto ~/.local/share/metis), METIS_VENV (venv del backend; por defecto
backend/.venv y si no METIS_HOME/venv), METIS_THREADS (4), METIS_LLM_PORT (8081), METIS_BACKEND_PORT (8000),
METIS_FRONTEND_PORT (5173), METIS_HOST (127.0.0.1), METIS_NGL (capas en GPU; por defecto 99 en Mac Apple Silicon)."""
import glob, os, pathlib, platform, shutil, signal, socket, subprocess, sys, time, urllib.request, webbrowser

ROOT = pathlib.Path(__file__).resolve().parent
HOME = pathlib.Path(os.path.expanduser(os.environ.get("METIS_HOME", "~/.local/share/metis")))
THREADS = os.environ.get("METIS_THREADS", "4")
P_LLM = int(os.environ.get("METIS_LLM_PORT", "8081"))
P_API = int(os.environ.get("METIS_BACKEND_PORT", "8000"))
P_WEB = int(os.environ.get("METIS_FRONTEND_PORT", "5173"))
HOST = os.environ.get("METIS_HOST", "127.0.0.1")
WIN = os.name == "nt"
MAC_ARM = platform.system() == "Darwin" and platform.machine() == "arm64"
WSL = "microsoft" in platform.release().lower()
DEMO_HTML = ROOT / "demo" / "metis-demo.html"
procs = []


def busy(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start(name, cmd, cwd, env=None, group=False):
    """group=True: grupo de procesos propio, para poder parar también los hijos (npm -> vite)."""
    print(f"[metis] arrancando {name}: {' '.join(str(c) for c in cmd)}")
    kw = {"start_new_session": True} if group and not WIN else {}
    procs.append((name, subprocess.Popen([str(c) for c in cmd], cwd=str(cwd), env={**os.environ, **(env or {})}, **kw)))


def stop(p):
    try:
        if not WIN and os.getpgid(p.pid) == p.pid:
            os.killpg(p.pid, signal.SIGTERM)
            return
    except OSError:
        pass
    p.terminate()


def wait(port, secs):
    for _ in range(secs * 2):
        if busy(port):
            return True
        time.sleep(0.5)
    return False


def wait_health(url, secs):
    """llama-server abre el puerto antes de cargar el modelo: espera a que /health dé 200."""
    for _ in range(secs * 2):
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        if procs and procs[-1][1].poll() is not None:
            return False
        time.sleep(0.5)
    return False


def find_llama():
    exe = "llama-server.exe" if WIN else "llama-server"
    bins = sorted(glob.glob(str(HOME / "llama.cpp" / "**" / exe), recursive=True)) or ([shutil.which(exe)] if shutil.which(exe) else [])
    models = sorted(glob.glob(str(HOME / "models" / "*.gguf")))
    pref = [m for m in models if "Qwen3-4B" in m] or models
    return (bins[0] if bins else None), (pref[0] if pref else None)


def find_venv():
    sub = "Scripts" if WIN else "bin"
    cands = [pathlib.Path(os.path.expanduser(os.environ["METIS_VENV"]))] if os.environ.get("METIS_VENV") else []
    cands += [ROOT / "backend" / ".venv", HOME / "venv"]
    for v in cands:
        if (v / sub / ("uvicorn.exe" if WIN else "uvicorn")).exists():
            return v / sub / ("uvicorn.exe" if WIN else "uvicorn")
    return None


def find_npm():
    """Primero el Node que deja instalar.sh --dev en METIS_HOME/node (el de apt en Ubuntu 24.04 es demasiado viejo)."""
    own = HOME / "node" / ("npm.cmd" if WIN else "bin/npm")
    if own.exists():
        return str(own), {"PATH": str(own.parent) + os.pathsep + os.environ.get("PATH", "")}
    npm = shutil.which("npm.cmd" if WIN else "npm")
    return npm, {}


def open_browser(url):
    print(f"[metis] abriendo {url}")
    try:
        if WSL:
            for cmd in (["wslview", url], ["explorer.exe", url], ["cmd.exe", "/c", "start", "", url]):
                if shutil.which(cmd[0]):
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    return
        elif webbrowser.open(url):
            return
    except Exception:
        pass
    print(f"[metis] no pude abrir el navegador: abre tú {url}")


def _on_term(*_):
    raise KeyboardInterrupt


def main():
    args = sys.argv[1:]
    dev = "--dev" in args or not DEMO_HTML.exists()
    if "--dev" not in args and dev:
        print(f"[metis] no existe {DEMO_HTML.relative_to(ROOT)}: modo desarrollo con Vite")
    env_api = {}
    if "--no-llm" in args:
        env_api["METIS_LLM_URL"] = ""
    elif busy(P_LLM):
        print(f"[metis] IA local ya en marcha en :{P_LLM}")
    else:
        b, m = find_llama()
        if b and m:
            cmd = [b, "-m", m, "--host", "127.0.0.1", "--port", P_LLM, "-t", THREADS, "-c", "4096", "-np", "1",
                   "--alias", "qwen3-4b-instruct-2507"]
            ngl = os.environ.get("METIS_NGL", "99" if MAC_ARM else "")
            if ngl:
                cmd += ["-ngl", ngl]  # Mac Apple Silicon: el modelo entero en la GPU (Metal)
            start("llama-server", cmd, ROOT)
            ok = wait_health(f"http://127.0.0.1:{P_LLM}/health", 180)
            print("[metis] IA local", "lista" if ok else "aún cargando o con error (el backend usará frases de reserva hasta entonces)")
        else:
            print(f"[metis] sin llama-server o sin modelo .gguf en {HOME}: Metis usará frases de reserva")
    env_api.setdefault("METIS_LLM_URL", f"http://127.0.0.1:{P_LLM}/v1")
    if busy(P_API):
        print(f"[metis] backend ya en marcha en :{P_API}")
    else:
        be = ROOT / "backend"
        uv = find_venv()
        if uv:
            cmd = [uv]
        else:
            import importlib.util
            if importlib.util.find_spec("uvicorn") is None:
                print("[metis] falta el entorno del backend. Instálalo desde la carpeta del brain con:\n"
                      "  bash codigo/metis/instalar.sh        (macOS, Linux, WSL)")
                sys.exit(1)
            cmd = [sys.executable, "-m", "uvicorn"]
        start("backend", cmd + ["main:app", "--host", HOST, "--port", P_API], be, env_api)
        wait(P_API, 30)
    if dev:
        if busy(P_WEB):
            print(f"[metis] frontend ya en marcha en :{P_WEB}")
        else:
            npm, env_npm = find_npm()
            fe = ROOT / "frontend"
            if npm and (fe / "node_modules").exists():
                start("frontend", [npm, "run", "dev", "--", "--port", str(P_WEB), "--strictPort"], fe, env_npm, group=True)
                wait(P_WEB, 30)
            else:
                print("[metis] frontend no arrancado: falta Node o frontend/node_modules (bash codigo/metis/instalar.sh --dev)")
    print("\n[metis] URLs:")
    if dev:
        print(f"  Demo (frontend Vite): http://localhost:{P_WEB}")
    else:
        print(f"  Demo:             http://localhost:{P_API}/")
    print(f"  API (backend):    http://localhost:{P_API}/api/status   docs: http://localhost:{P_API}/docs")
    print(f"  IA local:         http://localhost:{P_LLM}/health")
    if not dev and "--no-browser" not in args:
        open_browser(f"http://localhost:{P_API}/")
    if not procs:
        return
    print("\n[metis] Ctrl+C para parar lo arrancado por este script.")
    signal.signal(signal.SIGTERM, _on_term)
    # La IA es opcional: si llama-server cae, se avisa y el resto sigue (frases de reserva).
    # Solo se para todo si cae una pieza imprescindible (backend o frontend).
    core = [(n, p) for n, p in procs if n != "llama-server"] or procs
    warned = False
    try:
        while all(p.poll() is None for _, p in core):
            if not warned and any(n == "llama-server" and p.poll() is not None for n, p in procs):
                print("[metis] la IA local (llama-server) se ha parado: sigo sin IA, con frases de reserva."
                      " En Ubuntu/WSL suele faltar libgomp1: sudo apt install -y libgomp1")
                warned = True
            time.sleep(1)
        print("[metis] se ha parado " + ", ".join(n for n, p in core if p.poll() is not None))
    except KeyboardInterrupt:
        pass
    finally:
        for name, p in procs:
            if p.poll() is None:
                print(f"[metis] parando {name}")
                stop(p)
        for _, p in procs:
            try:
                p.wait(10)
            except subprocess.TimeoutExpired:
                p.kill()


if __name__ == "__main__":
    main()
