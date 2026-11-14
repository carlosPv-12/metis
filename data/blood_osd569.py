# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Lee el hemograma real OSD-569 (NASA OSDR, Inspiration4) y escribe blood_osd569.json.
Línea base = media de L-92, L-44, L-3. Compara R+1 con la banda personal (min/max de la línea base)
y con el rango de referencia. Fuente: NASA OSDR OSD-569. Solo stdlib.
Uso: python3 blood_osd569.py"""
import csv, json, pathlib, statistics

here = pathlib.Path(__file__).parent
CSV = here.parents[2] / "datos" / "osdr-osd-569" / "LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv"
PRE = ["L-92", "L-44", "L-3"]

def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None

rows = {}
with open(CSV, encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f):
        cid, _, tp, _ = r["Sample Name"].split("_")
        rows[(cid, tp)] = r
analytes = sorted({k.rsplit("_value", 1)[0] for k in next(iter(rows.values())) if "_value" in k})

# La columna de hemoglobina se llama *_percent en OSDR, pero sus valores (p. ej. 14.7 con rango 13.2-17.1) son g/dL,
# el rango de referencia adulto habitual de hemoglobina; un % no encaja. Se corrige la unidad aquí y se declara en la salida.
UNIT_FIX = {"hemoglobin": "g/dL"}
MARGIN = 0.05  # fuera de banda solo si se sale del min-max de las 3 extracciones en más de un 5 % de la media de la línea base


def unit(r, a):
    if a in UNIT_FIX:
        return UNIT_FIX[a]
    return next(k for k in r if k.startswith(a + "_value_")).split(a + "_value_")[1]

crew = {}
for cid in sorted({c for c, _ in rows}):
    res = []
    for a in analytes:
        pre = [num(rows[(cid, t)][next(k for k in rows[(cid, t)] if k.startswith(a + "_value_"))]) for t in PRE]
        pre = [x for x in pre if x is not None]
        r1 = rows[(cid, "R+1")]
        val = num(r1[next(k for k in r1 if k.startswith(a + "_value_"))])
        lo = num(r1[next(k for k in r1 if k.startswith(a + "_range_min_"))])
        hi = num(r1[next(k for k in r1 if k.startswith(a + "_range_max_"))])
        if not pre or val is None:
            res.append({"analyte": a, "unit": unit(r1, a), "note": "sin dato suficiente"})
            continue
        b_mean = round(statistics.mean(pre), 3)
        m = MARGIN * abs(b_mean)
        out_band = val < min(pre) - m or val > max(pre) + m
        out_ref = (lo is not None and val < lo) or (hi is not None and val > hi)
        res.append({"analyte": a, "unit": unit(r1, a), "baseline_mean": b_mean,
                    "baseline_min": min(pre), "baseline_max": max(pre), "r_plus_1": val,
                    "ref_min": lo, "ref_max": hi,
                    "outside_personal_band": out_band, "outside_reference_range": out_ref})
    crew[cid] = {"id": cid, "analytes": res,
                 "n_outside_personal_band": sum(1 for x in res if x.get("outside_personal_band")),
                 "n_outside_reference": sum(1 for x in res if x.get("outside_reference_range"))}
doc = {"source": "NASA OSDR OSD-569 (Inspiration4), LSDS-7 Complete Blood Count",
       "url": "https://osdr.nasa.gov/osdr/data/osd/files/569", "real_data": True,
       "baseline": "media de L-92, L-44, L-3; banda personal = min-max de esas 3 extracciones, ampliada un 5 % de la media",
       "personal_band_margin_pct": MARGIN * 100,
       "unit_notes": {"hemoglobin": "OSDR column is named hemoglobin_value_percent, but values (e.g. 14.7, reference 13.2-17.1) are g/dL; unit corrected here"},
       "crew": crew}
(here / "blood_osd569.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
print("blood_osd569.json escrito:", {k: (v["n_outside_personal_band"], v["n_outside_reference"]) for k, v in crew.items()})
