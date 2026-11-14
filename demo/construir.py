#!/usr/bin/env python3
# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Regenera metis-demo.html: la demo de Metis en un solo archivo que se abre con doble clic.

Uso (desde cualquier carpeta; Linux, macOS o Windows):
    python3 construir.py            # usa el node_modules del frontend (si falta, ejecuta npm ci)

Pasos: `vite build --config vite.demo.config.ts` en una carpeta temporal (un solo chunk JS,
un solo CSS, fuentes como data: URI) y después se meten el JS, el CSS y el favicon dentro del HTML.
Solo usa la biblioteca estándar de Python 3.8+ y el npm del frontend.
"""
import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FRONT = AQUI.parent / "frontend"
SALIDA = AQUI / "metis-demo.html"


def npm(*args, env=None):
    exe = shutil.which("npm") or shutil.which("npm.cmd")
    if not exe:
        sys.exit("No encuentro npm. Instala Node.js 20+ para regenerar la demo (para abrirla no hace falta).")
    print("+ npm", " ".join(args), flush=True)
    subprocess.run([exe, *args], cwd=FRONT, env=env, check=True)


def main():
    if not (FRONT / "node_modules" / "vite").exists():
        npm("ci")
    with tempfile.TemporaryDirectory(prefix="metis-demo-") as tmp:
        env = dict(os.environ, METIS_DEMO_OUT=tmp)
        npm("exec", "--", "vite", "build", "--config", "vite.demo.config.ts", env=env)
        out = Path(tmp)
        html = (out / "index.html").read_text(encoding="utf-8")
        js = [p for p in (out / "assets").glob("*.js")]
        css = [p for p in (out / "assets").glob("*.css")]
        otros = [p for p in (out / "assets").iterdir() if p.suffix not in (".js", ".css")]
        if len(js) != 1 or len(css) > 1 or otros:
            sys.exit(f"Esperaba 1 JS, 0-1 CSS y ningún otro archivo; hay {[p.name for p in (out / 'assets').iterdir()]}")

        # Quita las etiquetas que apuntan a archivos y mete el contenido en línea.
        html = re.sub(r'\s*<script type="module"[^>]*src="[^"]+"[^>]*></script>', "", html)
        html = re.sub(r'\s*<link rel="stylesheet"[^>]*href="[^"]+"[^>]*>', "", html)
        code = js[0].read_text(encoding="utf-8")
        # Un "</script" dentro del JS cerraría la etiqueta antes de tiempo.
        code = re.sub(r"</(script)", r"<\\/\1", code, flags=re.I)
        estilo = css[0].read_text(encoding="utf-8").replace("</style", "<\\/style") if css else ""
        fav = (FRONT / "public" / "favicon.svg").read_bytes()
        fav_uri = "data:image/svg+xml;base64," + base64.b64encode(fav).decode("ascii")
        html = re.sub(r'<link rel="icon"[^>]*>', f'<link rel="icon" type="image/svg+xml" href="{fav_uri}" />', html)
        html = html.replace("</head>", f"<style>{estilo}</style>\n</head>", 1)
        # Módulo en línea al final del body: el DOM (#root) ya existe cuando se ejecuta.
        html = html.replace("</body>", f'<script type="module">{code}</script>\n</body>', 1)
        aviso = "<!-- Generado por demo/construir.py: no editar a mano. Te Falta Tech, NASA Space Apps 2026. -->\n"
        html = html.replace("<!doctype html>", "<!doctype html>\n" + aviso, 1)

    if re.search(r'(src|href)="(?!data:|#|https?:)[^"]+"', html.split("<style>")[0]):
        sys.exit("Queda una referencia a un archivo externo en el HTML.")
    SALIDA.write_text(html, encoding="utf-8", newline="\n")
    print(f"OK: {SALIDA.name} ({SALIDA.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
