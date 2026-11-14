# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
# Mide la latencia de la IA local (llama-server). Uso: python3 medir_latencia_ia.py [http://127.0.0.1:8081/v1/chat/completions]
import json, time, urllib.request, sys
url=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8081/v1/chat/completions"
msgs=[{"role":"system","content":"You are Metis, a calm, warm AI companion for an astronaut. Reply in at most two short sentences. Never diagnose."},
{"role":"user","content":"Crew: Lena, day 112. Resting HR 67 bpm (baseline 58). Sleep 5.1 h three nights in a row (baseline 6.3). Bunk CO2 night peak 3.1 mmHg. Greet her and gently ask how she feels."}]
for i in range(3):
    t=time.time(); r=urllib.request.urlopen(urllib.request.Request(url,data=json.dumps({"model":"x","messages":msgs,"max_tokens":80,"temperature":0.6}).encode(),headers={"Content-Type":"application/json"})); d=json.load(r); el=time.time()-t
    tm=d.get("timings",{}); print(round(el,2),"s | prompt tok/s",round(tm.get("prompt_per_second",0),1),"| gen tok/s",round(tm.get("predicted_per_second",0),1),"| n",tm.get("predicted_n"),"|",d["choices"][0]["message"]["content"])
