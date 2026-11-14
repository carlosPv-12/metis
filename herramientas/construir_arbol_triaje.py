# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
# Genera backend/triage_tree.json (árbol de triaje determinista EN/ES con fuentes). Uso: python3 construir_arbol_triaje.py [salida.json]
# Comprobado el 14-nov-2026: reproduce exactamente el triage_tree.json en uso (con los arreglos de seguridad de las 03:44).
# Si editas el JSON a mano, este script deja de reflejarlo: edita aquí y regenera, o solo el JSON, pero no mezcles.
import json, sys
S = {
 "cpr_microgravity": {"title": "Hinkelbein et al. 2020, CPR in microgravity guideline (DGLRM / ESAM-SMG), Scand J Trauma Resusc Emerg Med 28:108", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7607644/", "kind": "peer-reviewed guideline"},
 "acls_iss": {"title": "Hurst et al., Evaluating ACLS algorithms for the ISS (NASA NTRS 20070030123)", "url": "https://ntrs.nasa.gov/citations/20070030123", "kind": "NASA"},
 "code_blue": {"title": "Bacal & Redmond, Code Blue On Orbit (NASA NTRS 20110011323)", "url": "https://ntrs.nasa.gov/citations/20110011323", "kind": "NASA"},
 "std3001_v1": {"title": "NASA-STD-3001 Vol. 1 Rev C [V1 3006]: at least two Crew Medical Officers per vehicle", "url": "https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf", "kind": "NASA"},
 "ochmo_tb033": {"title": "NASA OCHMO-TB-033 Rev C, Spaceflight Experience and Medical Care", "url": "https://www.nasa.gov/wp-content/uploads/2023/07/ochmo-tb-033-spaceflight-experience-medical-care-rev-c.pdf", "kind": "NASA"},
 "hrp_cardiac": {"title": "NASA HRP Evidence Report, Risk of Cardiac Rhythm Problems During Spaceflight (NTRS 20170005625)", "url": "https://ntrs.nasa.gov/citations/20170005625", "kind": "NASA"},
 "co2_tb004": {"title": "NASA OCHMO-TB-004 Rev D, Carbon Dioxide", "url": "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf", "kind": "NASA"},
 "sleep_barger": {"title": "Barger et al. 2014, Lancet Neurology: sleep in spaceflight (6.09 h/night on ISS)", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/", "kind": "peer-reviewed"},
 "erc_bls_2021": {"title": "Olasveengen et al., European Resuscitation Council Guidelines 2021: Basic Life Support, Resuscitation 161:98-114", "url": "https://doi.org/10.1016/j.resuscitation.2021.02.009", "kind": "peer-reviewed guideline"},
 "hrp_risks": {"title": "NASA HRP, Risks of Human Spaceflight (Resources tab)", "url": "https://www.nasa.gov/hrp/risks/", "kind": "NASA (challenge resource)"},
}
W = {"en": "Prototype guidance. Steps are anchored to the cited sources but have NOT been reviewed by a physician. Follow your approved onboard medical procedures and your CMO.",
     "es": "Guía de prototipo. Los pasos se apoyan en las fuentes citadas pero NO los ha revisado un médico. Sigue los procedimientos médicos aprobados de a bordo y a tu CMO."}
def q(en, es, why_en, why_es, opts, say_en=None, say_es=None, src=(), esc=False):
    return {"type": "question", "text_en": en, "text_es": es, "why_en": why_en, "why_es": why_es,
            "options": [{"id": i, "label_en": a, "label_es": b, "next": n} for i, a, b, n in opts],
            "say_en": say_en or en, "say_es": say_es or es, "sources": list(src), "escalate": esc}
def r(level, t_en, t_es, steps, sum_en, sum_es, say_en, say_es, src, esc):
    return {"type": "result", "level": level, "title_en": t_en, "title_es": t_es,
            "steps_en": [a for a, _ in steps], "steps_es": [b for _, b in steps],
            "surgeon_summary_en": sum_en, "surgeon_summary_es": sum_es,
            "say_en": say_en, "say_es": say_es, "sources": src, "escalate": esc,
            "warning_en": W["en"], "warning_es": W["es"]}
YN = lambda y, n, yes_en="Yes", no_en="No", yes_es="Sí", no_es="No": [("si", yes_en, yes_es, y), ("no", no_en, no_es, n)]
MED_EN = "Medication only as directed by your CMO or flight surgeon, from the onboard medical checklist. Metis does not suggest drugs or doses."
MED_ES = "Medicación solo si la indica tu CMO o el cirujano de vuelo, según la lista médica de a bordo. Metis no propone fármacos ni dosis."
cc = {
 "c1": q("Does your crewmate respond when you speak to them or gently shake their shoulders?", "¿Tu compañero responde si le hablas o le sacudes suavemente los hombros?",
         "Responsiveness decides the path. Early recognition and calling for help start the chain of survival.", "Saber si responde decide el camino. Reconocer pronto y pedir ayuda abre la cadena de supervivencia.",
         YN("c2r", "c2"), src=["cpr_microgravity", "erc_bls_2021"]),
 "c2": q("Is he breathing normally? Watch his chest for up to 10 seconds.", "¿Respira con normalidad? Mírale el pecho hasta 10 segundos.",
         "In basic life support, someone who does not respond and is not breathing normally is treated as cardiac arrest. Occasional gasps are not normal breathing.",
         "En soporte vital básico, quien no responde y no respira con normalidad se trata como parada cardiaca. Las boqueadas no son respiración normal.",
         [("si", "Yes, normally", "Sí, con normalidad", "c3b"), ("no", "No, or only gasping", "No, o solo boquea", "c3")],
         say_en="Is he breathing normally? Watch his chest for up to ten seconds.", say_es="¿Respira con normalidad? Mírale el pecho hasta diez segundos.",
         src=["erc_bls_2021", "cpr_microgravity"], esc=True),
 "c2r": q("Is he breathing normally?", "¿Respira con normalidad?", "Normal breathing lets you keep assessing; difficulty breathing is an emergency even if he responds.", "Si respira con normalidad puedes seguir valorando; si le cuesta respirar es una emergencia aunque responda.",
         [("si", "Yes", "Sí", "c4"), ("no", "No, or struggling", "No o con dificultad", "c3r")], src=["erc_bls_2021", "ochmo_tb033"]),
 "c3b": r("rojo", "Unresponsive but breathing: secure him, watch his breathing, call the CMO", "No responde pero respira: sujétalo, vigila su respiración y llama al CMO",
         [("Call out for help now: alert the whole crew and your Crew Medical Officer (CMO).", "Pide ayuda ya: avisa a toda la tripulación y a tu oficial médico de tripulación (CMO)."),
          ("Secure him in a stable position with his airway open, using the restraints you trained with.", "Sujétalo en una postura estable con la vía aérea abierta, con las sujeciones que entrenaste."),
          ("Keep watching his breathing. If it stops or becomes gasping, start chest compressions and get the AED.", "Vigila su respiración sin parar. Si deja de respirar o solo boquea, empieza las compresiones y trae el DEA."),
          ("Notify the flight surgeon. With a delay of minutes, do not wait for an answer to act.", "Avisa al cirujano de vuelo. Con un retraso de minutos, no esperes su respuesta para actuar.")],
         "Crewmate collapsed, unresponsive, breathing normally. Secured and monitored; CMO called.", "Compañero desplomado, sin respuesta, respira con normalidad. Sujeto y vigilado; se avisó al CMO.",
         "He's breathing. Keep him secured and keep watching his chest. I'm calling the medical officer.", "Respira. Mantenlo sujeto y no dejes de mirarle el pecho. Aviso al oficial médico.",
         ["erc_bls_2021", "cpr_microgravity", "std3001_v1"], True),
 "c3r": r("rojo", "Responsive but struggling to breathe: call the CMO now, AED ready", "Responde pero le cuesta respirar: llama ya al CMO, con el DEA preparado",
         [("Call your Crew Medical Officer (CMO) now and alert the crew.", "Llama ya a tu oficial médico de tripulación (CMO) y avisa a la tripulación."),
          ("Do not start chest compressions: he is responding.", "No empieces compresiones: está respondiendo."),
          ("Bring the AED and the emergency kit next to him, ready in case he stops responding.", "Trae el DEA y el botiquín de emergencia a su lado, preparados por si deja de responder."),
          ("Stay with him and keep watching his breathing. If he stops responding and is not breathing normally, restart this checklist.", "Quédate con él y vigila su respiración. Si deja de responder y no respira con normalidad, vuelve a empezar esta lista."),
          (MED_EN, MED_ES)],
         "Crewmate collapsed, responsive, breathing abnormally. CMO called, AED ready, no compressions.", "Compañero desplomado, responde, respira con dificultad. Se avisó al CMO, DEA preparado, sin compresiones.",
         "He's responding, so no compressions. I'm calling the medical officer. Keep the AED ready and stay with him.", "Responde, así que nada de compresiones. Llamo al oficial médico. Ten el DEA preparado y quédate con él.",
         ["erc_bls_2021", "cpr_microgravity", "ochmo_tb033"], True),
 "c4": q("Are they complaining of chest pain or pressure right now?", "¿Se queja ahora de dolor u opresión en el pecho?", "Active chest pain raises the priority.", "El dolor torácico activo sube la prioridad.",
         YN("c5", "c6"), src=["ochmo_tb033"]),
 "c5": q("Cold sweat, pale skin, or pain spreading to the arm or jaw?", "¿Sudor frío, palidez o dolor que se extiende al brazo o a la mandíbula?", "Warning signs that are passed on to the CMO and the flight surgeon.", "Signos de alarma que se transmiten al CMO y al cirujano de vuelo.",
         YN("c7", "c8"), src=["ochmo_tb033"]),
 "c6": r("naranja", "Rest, monitor and notify the CMO", "Reposo, vigilancia y aviso al CMO",
         [("Have them rest, secured in a comfortable position.", "Que descanse, sujeto en una postura cómoda."),
          ("Recheck pulse and breathing every 5 minutes and log them with the time.", "Repite pulso y respiración cada 5 minutos y anótalos con la hora."),
          ("Stay with him and inform the CMO; Metis queues a summary for the flight surgeon.", "Quédate con él e informa al CMO; Metis deja en cola un resumen para el cirujano de vuelo.")],
         "Transient collapse, now without chest pain. Rest and monitoring.", "Colapso transitorio, ahora sin dolor torácico. Reposo y vigilancia.",
         "Okay. Let him rest and stay with him. I'm letting the medical officer know.", "De acuerdo. Que descanse y quédate con él. Aviso al oficial médico.",
         ["ochmo_tb033", "hrp_cardiac"], True),
 "c7": r("rojo", "High priority: full rest and immediate call to the CMO and flight surgeon", "Prioridad alta: reposo absoluto y aviso inmediato al CMO y al cirujano de vuelo",
         [("Full rest, comfortable position, never leave them alone.", "Reposo absoluto, postura cómoda, no le dejes solo."),
          ("Call the CMO now. Keep the AED and emergency kit next to you.", "Llama ya al CMO. Ten a mano el DEA y el botiquín de emergencia."),
          ("Measure pulse and breathing and log them with the time.", "Mide pulso y respiración y anótalos con la hora."),
          (MED_EN, MED_ES)],
         "Chest pain with warning signs after a collapse. CMO called; summary sent to the flight surgeon.", "Dolor torácico con signos de alarma tras un colapso. Se avisó al CMO; resumen enviado al cirujano de vuelo.",
         "Stay with them. I'm calling the medical officer and sending a summary to the flight surgeon.", "Quédate con él. Llamo al oficial médico y envío un resumen al cirujano de vuelo.",
         ["ochmo_tb033", "std3001_v1", "cpr_microgravity"], True),
 "c8": r("naranja", "Rest, monitor and notify the flight surgeon", "Reposo, vigilancia y aviso al cirujano de vuelo",
         [("Rest and constant company.", "Reposo y compañía constante."),
          ("Recheck pulse and breathing every 5 minutes.", "Repite pulso y respiración cada 5 minutos."),
          ("Inform the CMO; Metis prepares the summary for the flight surgeon.", "Informa al CMO; Metis prepara el resumen para el cirujano de vuelo."),
          (MED_EN, MED_ES)],
         "Chest pain after a collapse, no additional warning signs.", "Dolor torácico tras un colapso, sin otros signos de alarma.",
         "Keep them resting and stay close. I'm preparing the summary for the flight surgeon.", "Que siga en reposo y quédate cerca. Preparo el resumen para el cirujano de vuelo.",
         ["ochmo_tb033", "hrp_cardiac"], True),
}
sc = {
 "s1": q("Is the pressure strong right now?", "¿La presión es intensa ahora mismo?", "Current intensity.", "Intensidad actual.", YN("s2", "s3"), src=["ochmo_tb033"]),
 "s2": q("Is it hard to breathe, or do you have a cold sweat?", "¿Te cuesta respirar o notas sudor frío?", "Warning signs.", "Signos de alarma.", YN("s6", "s9"), src=["ochmo_tb033"]),
 "s3": q("How long has it lasted?", "¿Cuánto tiempo lleva así?", "Duration.", "Duración.",
         [("lt10", "Less than 10 minutes", "Menos de 10 minutos", "s4"), ("gt10", "More than 10 minutes", "Más de 10 minutos", "s5")], src=["ochmo_tb033"]),
 "s4": q("Have you slept less than 6 hours the last few nights?", "¿Has dormido menos de 6 horas las últimas noches?", "Cross-checks with your sleep trend. Average sleep on the ISS is about 6 hours a night.", "Se cruza con tu tendencia de sueño. En la ISS se duerme de media unas 6 horas por noche.",
         YN("s7", "s8"), src=["sleep_barger"]),
 "s5": q("Does it spread to your arm, jaw or back?", "¿Se extiende al brazo, la mandíbula o la espalda?", "Location.", "Localización.", YN("s6", "s8"), src=["ochmo_tb033"]),
 "s6": r("rojo", "High priority: alert a crewmate and the CMO now", "Prioridad alta: avisa ya a un compañero y al CMO",
         [("Stop what you are doing and rest, secured.", "Para lo que estés haciendo y descansa, sujeto."),
          ("Alert a crewmate and your CMO now. Metis is calling them too.", "Avisa ya a un compañero y a tu CMO. Metis también les avisa."),
          ("Metis sends a summary to the flight surgeon.", "Metis envía un resumen al cirujano de vuelo."),
          (MED_EN, MED_ES)],
         "Chest pressure with warning signs, reported by the crewmember.", "Presión torácica con signos de alarma referida por el propio tripulante.",
         "Stop and rest. I'm calling your medical officer and a crewmate right now.", "Para y descansa. Aviso ahora mismo a tu oficial médico y a un compañero.",
         ["ochmo_tb033", "std3001_v1"], True),
 "s9": r("naranja", "Strong chest pressure: stop, rest and call your CMO now", "Presión torácica intensa: para, descansa y llama ya a tu CMO",
         [("Stop what you are doing and rest, secured.", "Para lo que estés haciendo y descansa, sujeto."),
          ("Call your CMO now and tell a crewmate. Metis is alerting them too.", "Llama ya a tu CMO y avisa a un compañero. Metis también les avisa."),
          ("If it gets worse, you feel short of breath or a cold sweat, say so: Metis raises the priority.", "Si empeora, te falta el aire o notas sudor frío, dilo: Metis sube la prioridad."),
          (MED_EN, MED_ES)],
         "Strong chest pressure without breathing difficulty or cold sweat, reported by the crewmember. CMO alerted.", "Presión torácica intensa sin dificultad respiratoria ni sudor frío, referida por el tripulante. Se avisó al CMO.",
         "Strong pressure needs your medical officer now. Stop and rest; I'm calling them.", "Una presión intensa necesita a tu oficial médico ya. Para y descansa; le aviso.",
         ["ochmo_tb033", "std3001_v1"], True),
 "s7": r("amarillo", "Possible link to sleep and cabin air: rest and recheck", "Posible relación con el sueño y el aire de cabina: descansa y repite medidas",
         [("Rest 10 minutes and recheck your pulse.", "Descansa 10 minutos y vuelve a tomarte el pulso."),
          ("Review your sleep and CO2 trend with Metis.", "Revisa con Metis tu tendencia de sueño y CO2."),
          ("If it gets worse, restart the triage or call your CMO.", "Si empeora, repite el triaje o llama a tu CMO.")],
         "Mild chest pressure with reduced sleep and elevated night-time CO2 (simulated data).", "Presión torácica leve con sueño reducido y CO2 nocturno elevado (datos simulados).",
         "Let's rest for ten minutes and check again. Your short nights and the bunk air may be part of this.", "Descansemos diez minutos y volvemos a medir. Tus noches cortas y el aire de la litera pueden influir.",
         ["sleep_barger", "co2_tb004"], False),
 "s8": r("naranja", "Rest, monitor and scheduled note to the flight surgeon", "Reposo, vigilancia y aviso programado al cirujano de vuelo",
         [("Rest and recheck in 15 minutes.", "Descansa y repite medidas en 15 minutos."),
          ("Log your symptoms with the time.", "Anota tus síntomas con la hora."),
          ("Inform your CMO; Metis queues the summary for the flight surgeon.", "Informa a tu CMO; Metis deja en cola el resumen para el cirujano de vuelo.")],
         "Chest pressure without reported warning signs.", "Presión torácica sin signos de alarma referidos.",
         "Rest for now. I'll check on you in fifteen minutes and let the flight surgeon know.", "Descansa de momento. Te pregunto en quince minutos y aviso al cirujano de vuelo.",
         ["ochmo_tb033", "hrp_cardiac"], True),
}
import os
_old = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "c3src.json"), encoding="utf-8"))["flows"]["companion_collapse"]["nodes"]["c3"]
_old.update({"title_en": "Not responding, not breathing normally: start CPR and get the AED", "title_es": "No responde y no respira con normalidad: empieza la RCP y trae el DEA",
             "surgeon_summary_en": "Crewmate collapsed, unresponsive and not breathing normally. Non-medical crewmember guided step by step by Metis; CPR and AED per onboard procedure.",
             "surgeon_summary_es": "Compañero desplomado, sin respuesta y sin respiración normal. Metis guio paso a paso a un tripulante no médico; RCP y DEA según el procedimiento de a bordo.",
             "sources": ["cpr_microgravity", "erc_bls_2021", "code_blue", "acls_iss", "std3001_v1"], "escalate": True})
cc["c3"] = _old
tree = {"_nota": "Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026. Árbol determinista bilingüe (EN/ES) con fuentes por nodo. Sin diagnósticos, sin fármacos ni dosis. NO revisado por un médico: ver investigacion/triaje-validado.md.",
        "sources": S,
        "flows": {
  "companion_collapse": {"title_en": "A crewmate collapses with chest pain", "title_es": "Un compañero se desploma con dolor torácico", "start": "c1", "nodes": cc},
  "self_chest_pressure": {"title_en": "I feel pressure in my chest", "title_es": "Noto presión en el pecho", "start": "s1", "nodes": sc}}}
for f in tree["flows"].values():
    for n in f["nodes"].values():
        for s in n["sources"]: assert s in S, s
        for o in n.get("options", []): assert o["next"] in f["nodes"], (o["next"], sorted(f["nodes"]))
_out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "triage_tree.json")
json.dump(tree, open(_out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok")
