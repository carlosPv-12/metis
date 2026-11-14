# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
# Añade a data/config.json la fuente de cada parámetro simulado. Idempotente (comprobado el 14-nov-2026). Uso: python3 anclar_config.py [config.json]
import json, sys
import os
p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "config.json")
c = json.load(open(p, encoding="utf-8"))
c["_nota"] = "Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026. Parámetros de los datos SIMULADOS anclados a valores publicados. Cada valor lleva su fuente; los que no tienen fuente están marcados como supuesto (verified:false en 'catalog'). Fuente de las cifras: investigacion/umbrales-nasa-verificados.md."
HR = "Anclado a Hughson et al. 2017 (PMC5792103), FC en vuelo 60.0 ± 10.6 lpm, supina pre-vuelo 55.2 ± 8.4 (n=9). La media individual es simulada."
HRV = "SUPUESTO: no hay valor de HRV en ms de astronautas en fuente abierta verificada; serie sintética."
SLP = "Anclado a Barger et al. 2014 (PMC4188436), sueño en ISS 6.09 ± 0.67 h/noche. La media individual es simulada."
CO2 = "Anclado a OCHMO-TB-004 Rev D: límite de diseño 3 mmHg (media 1 h, NASA-STD-3001 Vol. 2 [V2 6004]); media 7 d < 2.5 mmHg para riesgo de cefalea < 1 %. El pico nocturno de la litera es simulado."
for cid, sleep in (("lena", 6.1), ("marco", 6.4)):
    m = c["crew"][cid]
    m["resting_hr_bpm"]["source"] = HR; m["hrv_ms"]["source"] = HRV
    m["sleep_h"]["source"] = SLP; m["sleep_h"]["mean"] = sleep
    m["co2_night_peak_mmhg"]["source"] = CO2
c["crew"]["lena"]["role"] = "Ingeniera de vuelo (ficticia)"
c["crew"]["lena"]["role_en"] = "Flight engineer (fictional)"
c["crew"]["marco"]["role_en"] = "Non-medical crewmember (fictional)"
c["thresholds"]["co2_limit_mmhg_1h_avg"]["source"] = "NASA-STD-3001 Vol. 2 Rev D [V2 6004], citado en NASA OCHMO-TB-004 Rev D (págs. 5, 6, 13): media de 1 h <= 3 mmHg. Verificado 2026-11-14."
SRC = {"tb004": ("NASA OCHMO-TB-004 Rev D, Carbon Dioxide (cites NASA-STD-3001 Vol. 2 Rev D [V2 6004])", "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf"),
       "tb041": ("NASA OCHMO-TB-041 Rev A, Sleep Accommodations", "https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf"),
       "barger": ("Barger et al. 2014, Lancet Neurology (PMC4188436)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/"),
       "hughson": ("Hughson et al. 2017, J Appl Physiol, Table 1 (PMC5792103)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC5792103/"),
       "v1": ("NASA-STD-3001 Vol. 1 Rev C [V1 3006]", "https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf"),
       "hrp_cardiac": ("NASA HRP Evidence Report, Risk of Cardiac Rhythm Problems During Spaceflight (2017)", "https://ntrs.nasa.gov/citations/20170005625"),
       "proto": ("Metis prototype assumption (no published source)", "")}
def t(i, en, es, v, u, rule, s, ver):
    return {"id": i, "label_en": en, "label_es": es, "value": v, "unit": u, "rule": rule, "source_title": SRC[s][0], "source_url": SRC[s][1], "verified": ver}
c["catalog"] = [
 t("co2_1h_limit", "Cabin CO2 design limit (1-hour average)", "Límite de diseño de CO2 en cabina (media de 1 h)", 3.0, "mmHg", "1-h average ppCO2 <= 3 mmHg (vehicle design limit, not an individual clinical threshold)", "tb004", True),
 t("co2_24h_iss_rule", "ISS flight rule (24-hour average)", "Regla de vuelo de la ISS (media de 24 h)", 3.0, "mmHg", "ISS has kept the 24-h average at or below 3.00 mmHg since the 2016 flight rule", "tb004", True),
 t("co2_7d_headache", "Early warning: 7-day average for <1% headache risk", "Aviso temprano: media de 7 días para riesgo de cefalea < 1 %", 2.5, "mmHg", "7-day average below 2.5 mmHg keeps headache risk below 1%", "tb004", True),
 t("co2_symptoms", "Symptoms reported (fatigue, malaise, decreased sleep, nausea)", "Síntomas descritos (fatiga, malestar, peor sueño, náuseas)", 4.5, "mmHg", "reported above 4.5 mmHg", "tb004", True),
 t("sleep_inflight_mean", "Average sleep on the ISS", "Sueño medio en la ISS", 6.09, "h/night", "6.09 ± 0.67 h (actigraphy, 21 ISS crewmembers)", "barger", True),
 t("sleep_recommended", "Recommended sleep", "Sueño recomendado", "7-9", "h/night", "recommended 7-9 h; astronauts average about 6 h in space", "tb041", True),
 t("hr_inflight", "Resting heart rate in flight (reference group)", "Pulso en reposo en vuelo (grupo de referencia)", 60.0, "bpm", "60.0 ± 10.6 bpm in flight; 55.2 ± 8.4 supine pre-flight; no pre vs in-flight difference (n=9)", "hughson", True),
 t("arrhythmia_confirm", "Arrhythmia confirmation needs ECG", "Confirmar una arritmia requiere ECG", "ECG", "", "heart-rate sensors can screen abnormal R-R intervals; confirmation requires ECG", "hrp_cardiac", True),
 t("cmo_min", "Crew Medical Officers per vehicle (minimum)", "Oficiales médicos de tripulación por vehículo (mínimo)", 2, "CMOs", "train a minimum of two crewmembers per vehicle as CMOs", "v1", True),
 t("hrv_band", "Heart-rate variability band", "Banda de variabilidad cardiaca (HRV)", "synthetic", "ms", "no verified open in-flight HRV value; personal band only", "proto", False),
 t("baseline_band_sd", "Personal baseline band", "Banda de la línea base personal", 2.0, "SD", "personal mean ± 2 SD of the first 21 days", "proto", False),
 t("baseline_days", "Days to learn the personal baseline", "Días para aprender la línea base", 21, "days", "prototype choice", "proto", False),
]
json.dump(c, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok", len(c["catalog"]))
