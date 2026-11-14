# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Genera crew_lena.json (30 días de Lena + Marco) con semilla fija. Solo stdlib.
Uso: python3 generate_crew.py"""
import json, random, statistics, datetime, pathlib

here = pathlib.Path(__file__).parent
cfg = json.loads((here / "config.json").read_text(encoding="utf-8"))
rng = random.Random(cfg["seed"])
N, D = cfg["days"], cfg["drift_nights"]
start = datetime.date.fromisoformat(cfg["start_date"])
BD = cfg["thresholds"]["baseline_days"]["value"]
SD = cfg["thresholds"]["baseline_band_sd"]["value"]
METRICS = ["resting_hr_bpm", "hrv_ms", "sleep_h", "co2_night_peak_mmhg", "mood_1_5"]
ROUND = {"resting_hr_bpm": 0, "hrv_ms": 0, "sleep_h": 1, "co2_night_peak_mmhg": 2, "mood_1_5": 0}

def series(p):
    out = []
    for i in range(N):
        v = rng.gauss(p["mean"], p["sd"])
        k = i - (N - D)  # 0..D-1 en las últimas noches
        if k >= 0:
            v += p["drift"] * (k + 1) / D
        out.append(v)
    return out

crew = {}
for cid, c in cfg["crew"].items():
    cols = {m: series(c[m]) for m in METRICS}
    days = []
    for i in range(N):
        d = {"date": (start + datetime.timedelta(days=i)).isoformat(),
             "mission_day": cfg["mission_day_last"] - (N - 1 - i)}
        for m in METRICS:
            v = round(cols[m][i], ROUND[m])
            if m == "mood_1_5":
                v = int(min(5, max(1, v)))
            elif m == "sleep_h":
                v = max(3.0, v)
            d[m] = v
        days.append(d)
    base = {}
    for m in METRICS:
        xs = [d[m] for d in days[:BD]]
        mu, sd = statistics.mean(xs), statistics.pstdev(xs)
        base[m] = {"mean": round(mu, 2), "sd": round(sd, 2),
                   "band_low": round(mu - SD * sd, 2), "band_high": round(mu + SD * sd, 2)}
    today = days[-1]
    out_of_band = [m for m in METRICS if not (base[m]["band_low"] <= today[m] <= base[m]["band_high"])]
    crew[cid] = {"id": cid, "name": c["name"], "role": c["role"], "role_en": c.get("role_en", c["role"]), "fictional": c["fictional"],
                 "baseline": base, "days": days, "today_out_of_band": out_of_band,
                 "sources": {m: c[m]["source"] for m in METRICS}}

first_day = cfg["mission_day_last"] - (N - 1)
baseline_window = {"start_day": first_day, "end_day": first_day + BD - 1, "days": BD,
                   "start_date": start.isoformat(), "end_date": (start + datetime.timedelta(days=BD - 1)).isoformat(),
                   "rule": f"personal mean ± {SD:g} SD over these days"}
for c in crew.values():
    c["baseline_window"] = baseline_window
doc = {"_note": "Datos SIMULADOS (tripulantes ficticios), semilla fija; ver config.json para fuentes de cada valor.",
       "seed": cfg["seed"], "baseline_window": baseline_window, "co2_limit_mmhg": cfg["thresholds"]["co2_limit_mmhg_1h_avg"],
       "crew": crew}
(here / "crew_lena.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
print("crew_lena.json escrito:", {k: v["today_out_of_band"] for k, v in crew.items()})
