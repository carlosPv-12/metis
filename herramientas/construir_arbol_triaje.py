# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
# Genera backend/triage_tree.json (árbol de triaje determinista EN/ES con fuentes). Uso: python3 construir_arbol_triaje.py [salida.json]
# Ampliado el 14-nov-2026: conserva los dos flujos originales y añade escenarios EN/ES con fuentes y metadatos.
# Edita solo este script y regenera el JSON; nunca edites el JSON a mano.
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
# Corregido el 14-nov (revisión de los 13 flujos, investigacion/triaje-revision-flujos-nuevos.md): las fuentes respaldan que
# estos problemas ocurren en vuelo, no los pasos concretos, que son criterios de primeros auxilios en tierra.
W = {"en": "Prototype guidance, NOT reviewed by a physician. The sources show these conditions occur in spaceflight; the questions and steps follow common first-aid practice. Follow your approved onboard medical procedures and your CMO.",
     "es": "Guía de prototipo, NO revisada por un médico. Las fuentes muestran que estos problemas ocurren en vuelo; las preguntas y los pasos siguen prácticas habituales de primeros auxilios. Sigue los procedimientos médicos aprobados de a bordo y a tu CMO."}
def q(en, es, why_en, why_es, opts, say_en=None, say_es=None, src=(), esc=False):
    return {"type": "question", "text_en": en, "text_es": es, "why_en": why_en, "why_es": why_es,
            "options": [{"id": i, "label_en": a, "label_es": b, "next": n} for i, a, b, n in opts],
            "say_en": say_en or en, "say_es": say_es or es, "sources": list(src), "escalate": esc}
def r(level, t_en, t_es, steps, sum_en, sum_es, say_en, say_es, src, esc):
    return {"type": "result", "level": level, "title_en": t_en, "title_es": t_es,
            "steps_en": [a for a, _ in dict.fromkeys(steps)], "steps_es": [b for _, b in dict.fromkeys(steps)],
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
# Sources below occur in the read-only team research. They establish scope and
# operational context, not clinical validation of these conservative branches.
S.update({
    "imm_ranking": {
        "title": "NASA, Ranking of Medical Conditions by Probability (iMED v5.0, 2014 data)",
        "url": "https://www.nasa.gov/wp-content/uploads/2026/08/ranking-of-medical-conditions-by-probability.pdf",
        "kind": "NASA mission-planning model"},
    "hrp_orthostatic": {
        "title": "NASA HRP Evidence Report, Risk of Orthostatic Intolerance During Re-exposure to Gravity (NTRS 20150007319)",
        "url": "https://ntrs.nasa.gov/api/citations/20150007319/downloads/20150007319.pdf",
        "kind": "NASA evidence report (historical)"},
    "immune_crucian": {
        "title": "Crucian et al. 2016, Incidence of clinical symptoms during long-duration orbital spaceflight",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5098747",
        "kind": "peer-reviewed"},
    "sleep_tb041": {
        "title": "NASA OCHMO-TB-041 Rev A, Sleep Accommodations",
        "url": "https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf",
        "kind": "NASA technical brief"},
    "eimo_levin": {
        "title": "Levin et al. 2023, Enabling Human Space Exploration Missions Through Progressively Earth Independent Medical Operations (EIMO)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10810302/",
        "kind": "peer-reviewed"},
    # Añadidas el 14-nov (investigacion/triaje-y-bienestar-referencias.md, secciones B y C).
    "bh_tb016": {
        "title": "NASA OCHMO-TB-016 Rev B, Behavioral Health (stressors: sleep, workload, CO2, isolation, family news; private psychological conferences)",
        "url": "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-016-behavioral-health.pdf",
        "kind": "NASA technical brief"},
    "rst_sleep": {
        "title": "Reaction Self Test on the ISS (2022): under 6 h of sleep linked to slower responses, more stress and workload",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197",
        "kind": "peer-reviewed"},
    "cssrs": {
        "title": "Columbia Suicide Severity Rating Scale (C-SSRS): stepped questions (thoughts, then intent, plan and recent behaviour). Structure only; Metis uses its own wording",
        "url": "https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/about-the-scale/",
        "kind": "clinical screening structure"},
    "asking_safe": {
        "title": "Blades et al. 2018: asking about suicidal thoughts does not increase them (meta-analysis)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/30014862/",
        "kind": "peer-reviewed"},
})

# New flows retain the q/r/YN node contract. Shared branches are copied into
# each flow, so option.next is always local; cross-flow referrals are in steps.
NEW_MED = ("Use medication only as your flight surgeon or onboard procedures indicate.",
           "Usa medicación solo como indique tu cirujano de vuelo o los procedimientos de a bordo.")
CALL_NOW = ("Tell the CMO now and contact the flight surgeon at the next available link. Follow onboard emergency procedures without waiting for a reply.",
            "Avisa ya al CMO y contacta con el cirujano de vuelo en cuanto haya enlace. Sigue los procedimientos de emergencia de a bordo sin esperar respuesta.")
LOG = ("Record when this started, what changed and any measurements for the CMO.",
       "Anota cuándo empezó, qué ha cambiado y las medidas que tengas para el CMO.")
COLLAPSE = ("If they stop responding or are not breathing normally, open the triage \"A crewmate has collapsed\" and follow the onboard resuscitation procedure.",
            "Si deja de responder o no respira con normalidad, abre el triaje «Un compañero se ha desplomado» y sigue el procedimiento de reanimación de a bordo.")
CHEST = ("For chest pain or pressure, open the triage \"I feel pressure in my chest\" while the CMO comes.",
         "Si hay dolor u opresión en el pecho, abre el triaje «Noto presión en el pecho» mientras acude el CMO.")
AIR_STEPS = [
    ("Follow the vehicle emergency procedure for fire or toxic atmosphere now, led by the commander.",
     "Sigue ya el procedimiento de emergencia de la nave para fuego o atmósfera tóxica, dirigido por el comandante."),
    ("Leave the affected area now by the safe route in the onboard procedure; do not re-enter.",
     "Sal ya de la zona afectada por la ruta segura del procedimiento de a bordo; no vuelvas a entrar."),
    ("Use the prescribed protective mask and oxygen only as the onboard smoke or toxic-exposure procedure indicates.",
     "Usa la mascarilla de protección y el oxígeno solo como indique el procedimiento de humo o exposición tóxica de a bordo."),
    ("Alert the whole crew, commander and CMO now; account for everyone from a safe area.",
     "Avisa ya a toda la tripulación, al comandante y al CMO; comprobad desde una zona segura que estáis todos."),
    ("Contact the flight surgeon at the next link; do not wait for ground advice before taking protective action.",
     "Contacta con el cirujano de vuelo en cuanto haya enlace; no esperes indicaciones de Tierra para protegerte."),
    ("If a chemical reached the eyes or skin, rinse it once safe, following the onboard eye-irrigation or skin-exposure procedure.",
     "Si un producto químico llegó a los ojos o a la piel, acláralo cuando estés a salvo según el procedimiento de irrigación ocular o de exposición cutánea de a bordo."),
    COLLAPSE,
]


def result(level, en, es, steps, summary_en, summary_es, src):
    return r(level, en, es, steps, summary_en, summary_es, en, es,
             list(dict.fromkeys([*src, "ochmo_tb033"])), level in ("rojo", "naranja"))


def urgent(en, es, summary_en, summary_es, src, first=None):
    return result("rojo", en, es, [
        first or ("Stop the task and rest, secured, with a crewmate beside you.",
                  "Deja la tarea y descansa con una sujeción segura y un compañero a tu lado."),
        CALL_NOW, LOG, COLLAPSE], summary_en, summary_es, src)


def question(en, es, yes, no, src, why_en, why_es, unsure=None):
    """unsure: destino de «No estoy seguro». En las señales de alarma va al camino más grave (en caso de duda, se escala)."""
    opts = YN(yes, no) + ([("unsure", "Not sure", "No estoy seguro", unsure)] if unsure else [])
    return q(en, es, why_en, why_es, opts, src=src)


def safety_nodes(next_id):
    """Señales de alarma comunes. Humo, fuego o tóxico va PRIMERO: quien respira mal por humo tiene que salir de la zona,
    no quedarse descansando (revisión de los 13 flujos, problema grave 1)."""
    src = ["ochmo_tb033", "hrp_risks"]
    return {
        "air": question("Is there suspected smoke, fire or toxic exposure?", "¿Se sospecha humo, fuego o exposición tóxica?",
                        "air_now", "awake", ["imm_ranking", "hrp_risks"],
                        "An environmental hazard comes first: it can affect everyone.", "Un peligro ambiental va primero: puede afectar a todos.", unsure="air_now"),
        "awake": question("Is the affected person responding normally?", "¿La persona afectada responde con normalidad?",
                          "breathing", "collapse_now", ["erc_bls_2021"],
                          "Check responsiveness before continuing.", "Comprueba si responde antes de continuar.", unsure="collapse_now"),
        "breathing": question("Are they having trouble breathing?", "¿Le cuesta respirar?",
                              "breathing_now", "chest", src,
                              "Breathing difficulty needs immediate help.", "La dificultad para respirar necesita ayuda inmediata.", unsure="breathing_now"),
        "chest": question("Is there chest pain or pressure?", "¿Hay dolor u opresión en el pecho?",
                          "chest_now", next_id, src,
                          "Chest symptoms need their own urgent assessment.", "Los síntomas en el pecho necesitan una valoración urgente propia.", unsure="chest_now"),
        "collapse_now": urgent("Not responding: get help now", "No responde: pide ayuda ya",
                               "Unresponsiveness reported; breathing must be checked with the collapse protocol.",
                               "Se comunica falta de respuesta; hay que comprobar la respiración con el protocolo de desplome.",
                               ["erc_bls_2021", "cpr_microgravity"], COLLAPSE),
        "breathing_now": urgent("Breathing difficulty: alert the CMO now", "Dificultad para respirar: avisa ya al CMO",
                                "Breathing difficulty reported; cause not established.", "Se comunica dificultad respiratoria; causa sin determinar.", src),
        "chest_now": urgent("Chest symptoms: alert the CMO now", "Síntomas en el pecho: avisa ya al CMO",
                            "Chest pain or pressure reported; urgent assessment required.", "Se comunica dolor u opresión torácica; precisa valoración urgente.", src, CHEST),
        "air_now": result("rojo", "Leave the hazard and alert the whole crew now", "Sal de la zona de peligro y avisa ya a toda la tripulación",
                          AIR_STEPS, "Suspected smoke, fire or toxic exposure; whole-crew protective action required.",
                          "Sospecha de humo, fuego o exposición tóxica; se requiere protección de toda la tripulación.", ["imm_ranking", "hrp_risks"]),
    }


def add_flow(fid, group, en, es, icon, nodes, start="air"):
    tree["flows"][fid] = {"title_en": en, "title_es": es, "start": start, "nodes": nodes,
                          "group": group, "summary_en": en, "summary_es": es, "icon": icon}


# 3.2 / 3.13: symptoms, ability to retain fluids, and practical adaptation support.
src = ["imm_ranking", "hrp_risks"]
n = safety_nodes("vomit_blood")
n.update({
    "vomit_blood": q("Which warning sign is present?", "¿Qué señal de alarma hay?",
                     "Any of these signs needs immediate assessment.", "Cualquiera de estas señales necesita valoración inmediata.", [
                         ("blood", "Blood in vomit", "Sangre en el vómito", "vomit_red"),
                         ("pain", "Severe pain not settling", "Dolor intenso que no cede", "vomit_red"),
                         ("confused", "New confusion", "Confusión nueva", "vomit_red"),
                         ("none", "None of these", "Nada de esto", "fluids")], src=src),
    "fluids": question("Can you keep small sips of fluid down?", "¿Puedes retener pequeños sorbos de líquido?", "settling", "vomit_orange", src,
                       "Repeated vomiting can prevent hydration.", "Los vómitos repetidos pueden impedir que te hidrates."),
    "settling": question("Are the symptoms easing with rest?", "¿Los síntomas van mejorando con el reposo?", "vomit_yellow", "vomit_orange", src,
                         "Persistent symptoms need review, whatever the cause.", "Los síntomas que persisten necesitan revisión, sea cual sea la causa."),
    "vomit_red": urgent("Vomiting with a warning sign: call the CMO now", "Vómitos con señal de alarma: llama ya al CMO",
                        "Blood in vomit, severe persistent pain or new confusion reported; clarify selected sign.", "Se comunica sangre en el vómito, dolor intenso persistente o confusión nueva; concretar la señal elegida.", src),
    "vomit_orange": result("naranja", "Vomiting needs a prompt medical review", "Los vómitos necesitan una revisión médica pronta", [
        ("Stop demanding tasks and rest secured with a crewmate nearby.", "Deja las tareas exigentes y descansa con una sujeción segura y un compañero cerca."),
        ("Tell the CMO now if fluids will not stay down or vomiting continues; arrange flight-surgeon review at the next link.", "Avisa ya al CMO si no retienes líquidos o sigues vomitando; pide revisión con el cirujano de vuelo en el próximo enlace."),
        ("Record vomiting episodes and fluid intake; do not force food or drink.", "Anota los vómitos y lo que bebes; no fuerces la comida ni la bebida."), NEW_MED,
        ("Get urgent help for blood in vomit, confusion, severe pain that does not settle or worsening weakness.", "Pide ayuda urgente si hay sangre en el vómito, confusión, dolor intenso que no cede o debilidad creciente.")],
        "Vomiting persists or fluids cannot be retained; CMO review required.", "Persisten los vómitos o no se retienen líquidos; requiere revisión del CMO.", src),
    "vomit_yellow": result("amarillo", "Rest and monitor the nausea", "Descansa y vigila las náuseas", [
        ("Rest secured and reduce head movements for now.", "Descansa con una sujeción segura y reduce de momento los movimientos de cabeza."),
        ("Take small sips of fluid if fully alert and swallowing normally; use a contained vomit bag if needed.", "Toma pequeños sorbos si estás bien despierto y tragas con normalidad; usa una bolsa para vómitos si la necesitas."),
        ("Tell the CMO and log symptoms, fluid intake and vomiting.", "Coméntaselo al CMO y anota los síntomas, lo que bebes y los vómitos."), NEW_MED,
        ("Ask the CMO promptly if this stops improving; seek urgent help for blood in vomit or severe pain that does not settle.", "Pide revisión pronta al CMO si dejas de mejorar; pide ayuda urgente si vomitas sangre o tienes dolor intenso que no cede.")],
        "Nausea or vomiting easing with rest; fluids retained. Motion sickness not confirmed.", "Náuseas o vómitos que mejoran con reposo; retiene líquidos. Mareo espacial sin confirmar.", src),
})
add_flow("space_motion_sickness", "health", "I feel sick and I'm vomiting", "Tengo náuseas y estoy vomitando", "Activity", n)

# 3.3 / 3.15: do not infer CO2 or intracranial pressure from a headache.
src = ["co2_tb004", "hrp_risks"]
n = safety_nodes("head_flags")
n.update({
    "head_flags": q("Which best describes the headache?", "¿Qué describe mejor el dolor de cabeza?",
                    "These warning signs need help before checking cabin trends.", "Estas señales de alarma requieren ayuda antes de revisar las tendencias de cabina.", [
                        ("sudden", "Sudden, at its worst", "Repentino y máximo", "head_red"),
                        ("neck", "Fever and stiff neck", "Fiebre y rigidez de cuello", "head_red"),
                        ("neuro", "New vision, speech or movement problem", "Problema nuevo de visión, habla o movimiento", "head_red"),
                        ("pressure", "During or after an EVA or a pressure change", "Durante o después de una EVA o un cambio de presión", "head_pressure"),
                        ("none", "None of these", "Nada de esto", "head_pain")], src=src),
    # Revisión de los 13 flujos, problema grave 2: una cefalea tras una EVA o un cambio de presión no puede esperar al próximo enlace.
    "head_pressure": result("rojo", "Headache after an EVA or pressure change: alert the CMO now", "Cefalea tras una EVA o un cambio de presión: avisa ya al CMO", [
        ("Stop the task and tell the CMO now; follow the onboard post-EVA or decompression procedure without waiting for ground.", "Deja la tarea y avisa ya al CMO; sigue el procedimiento de a bordo posterior a la EVA o de descompresión sin esperar a Tierra."),
        ("Report when the EVA or pressure change happened, and any joint pain, skin changes, dizziness, vision or breathing problems.", "Comunica cuándo fue la EVA o el cambio de presión y si hay dolor articular, cambios en la piel, mareo o problemas de visión o respiración."),
        ("Rest secured with a crewmate beside you; do not start another EVA or pressure change until the CMO clears you.", "Descansa sujeto con un compañero al lado; no empieces otra EVA ni otro cambio de presión hasta que el CMO lo autorice."),
        CALL_NOW, LOG, COLLAPSE],
        "Headache during or after an EVA or cabin pressure change; decompression-related cause not excluded.",
        "Cefalea durante o tras una EVA o un cambio de presión de cabina; no se descarta una causa relacionada con la descompresión.", src),
    "head_pain": question("Is the pain severe and not settling?", "¿El dolor es intenso y no cede?", "head_red", "head_air", src,
                          "Severe persistent pain needs urgent assessment.", "El dolor intenso que no cede necesita valoración urgente."),
    "head_air": question("Is there a cabin CO2 or pressure warning?", "¿Hay un aviso de CO2 o presión de cabina?", "head_environment", "head_orange", src,
                         "Use actual cabin warnings; symptoms alone do not identify the cause.", "Usa los avisos reales de cabina; los síntomas por sí solos no identifican la causa."),
    "head_red": urgent("Headache warning sign: alert the CMO now", "Señal de alarma con cefalea: avisa ya al CMO",
                       "Headache with sudden maximal onset, fever with stiff neck, new vision/speech/movement symptoms or severe unrelenting pain reported; selected sign needs confirmation.",
                       "Cefalea con inicio súbito máximo, fiebre y rigidez de cuello, síntomas neurológicos nuevos o dolor intenso que no cede; confirmar la señal elegida.", src),
    "head_environment": result("rojo", "Cabin warning with symptoms: act now", "Aviso de cabina con síntomas: actúa ya", [
        ("Stop the task and follow the cabin CO2 or pressure emergency checklist now.", "Deja la tarea y sigue ya la lista de emergencia de CO2 o presión de cabina."),
        ("Move to the designated safe area and use mask or oxygen as the relevant onboard procedure indicates.", "Ve a la zona segura designada y usa mascarilla u oxígeno como indique el procedimiento correspondiente de a bordo."),
        ("Alert the whole crew, commander and CMO; report the actual alarm and readings.", "Avisa a toda la tripulación, al comandante y al CMO; comunica el aviso real y las lecturas."), CALL_NOW, LOG],
        "Headache with a reported cabin CO2 or pressure warning; environmental cause not confirmed.", "Cefalea con aviso referido de CO2 o presión de cabina; causa ambiental sin confirmar.", src),
    "head_orange": result("naranja", "Strong headache needs medical review", "El dolor de cabeza fuerte necesita revisión médica", [
        ("Stop demanding work and rest secured in a comfortable place.", "Deja el trabajo exigente y descansa con una sujeción segura en un lugar cómodo."),
        ("Tell the CMO now and request flight-surgeon review at the next link.", "Avisa ya al CMO y pide revisión con el cirujano de vuelo en el próximo enlace."),
        ("Record onset, sleep and actual cabin CO2 readings with their time and averaging period; do not assume a cause.", "Anota el inicio, el sueño y las lecturas reales de CO2 con su hora y periodo de promedio; no des por hecha la causa."), NEW_MED,
        ("Get immediate help if pain becomes sudden or unrelenting, vision changes suddenly, or fever with a stiff neck appears.", "Pide ayuda inmediata si el dolor se vuelve súbito o no cede, cambia la visión de repente o aparece fiebre con rigidez de cuello.")],
        "Strong headache; no listed warning sign or cabin warning selected. Cause remains undetermined.", "Cefalea fuerte; no se han elegido las señales de alarma indicadas ni avisos de cabina. Causa sin determinar.", src),
})
add_flow("strong_headache", "health", "I have a strong headache", "Me duele mucho la cabeza", "Brain", n)

# 3.8: new vision symptoms do not establish SANS.
src = ["hrp_risks", "imm_ranking"]
n = safety_nodes("vision_loss")
n.update({
    # Revisión de los 13 flujos, problema grave 4: la salpicadura química va primero (irrigar no puede esperar a 5 preguntas).
    "eye_splash": question("Did a chemical splash into your eye?", "¿Te ha salpicado un producto químico en el ojo?", "eye_chemical", "air", src,
                           "A chemical in the eye needs rinsing straight away.", "Un producto químico en el ojo hay que aclararlo enseguida.", unsure="eye_chemical"),
    "vision_loss": question("Has any vision suddenly been lost?", "¿Has perdido visión de repente?", "eye_red", "eye_kind", src,
                            "Sudden vision loss needs immediate help.", "La pérdida repentina de visión necesita ayuda inmediata.", unsure="eye_red"),
    # Problema grave 3: un impacto fuerte o algo clavado escala aunque duela poco.
    "eye_kind": q("What is bothering the eye?", "¿Qué te pasa en el ojo?", "The next action depends on the type of problem.", "El siguiente paso depende del tipo de problema.", [
        ("impact", "Something hit it hard or is stuck in it", "Algo lo golpeó fuerte o está clavado", "eye_red"),
        ("object", "Something loose in it", "Tengo algo suelto dentro", "eye_pain"),
        ("blur", "Blurred vision", "Veo borroso", "eye_orange")], src=src),
    "eye_pain": question("Is the eye pain severe?", "¿El dolor del ojo es intenso?", "eye_red", "eye_particle", src,
                          "Severe eye pain needs urgent assessment.", "El dolor ocular intenso necesita valoración urgente."),
    "eye_red": urgent("Sudden vision loss or severe eye pain: get help now", "Pérdida súbita de visión o dolor ocular intenso: pide ayuda ya",
                      "Sudden vision loss or severe eye pain reported; urgent eye assessment required.", "Se comunica pérdida súbita de visión o dolor ocular intenso; precisa valoración ocular urgente.", src,
                      ("Stop work; do not rub, press on the eye or try to remove an embedded object.", "Deja el trabajo; no frotes ni presiones el ojo ni intentes sacar un objeto clavado.")),
    "eye_chemical": result("rojo", "Chemical in the eye: start the approved eye procedure now", "Producto químico en el ojo: inicia ya el procedimiento ocular aprobado", [
        ("Alert the CMO now and begin the onboard chemical eye-exposure and irrigation procedure immediately.", "Avisa ya al CMO e inicia de inmediato el procedimiento de exposición química ocular e irrigación de a bordo."),
        ("Use the designated eye-irrigation kit with the trained fluid-containment method; do not wait for a ground reply.", "Usa el equipo de irrigación ocular previsto con el método de contención de líquidos que has entrenado; no esperes respuesta de Tierra."),
        ("Do not rub the eye or attempt to neutralise the chemical.", "No frotes el ojo ni intentes neutralizar el producto."), CALL_NOW, LOG],
        "Chemical eye splash reported; immediate onboard eye-exposure procedure required.", "Se comunica salpicadura química ocular; requiere procedimiento inmediato de exposición ocular de a bordo.", src),
    "eye_particle": result("amarillo", "Protect the eye and ask the CMO for help", "Protege el ojo y pide ayuda al CMO", [
        ("Stop the task and avoid rubbing the eye.", "Deja la tarea y evita frotarte el ojo."),
        ("Ask the CMO to use the approved eye-irrigation procedure for a loose particle, with fluid containment.", "Pide al CMO que use el procedimiento aprobado de irrigación ocular para una partícula suelta, con contención de líquidos."),
        ("Do not use tools or remove anything embedded in the eye.", "No uses herramientas ni saques nada que esté clavado en el ojo."),
        ("If discomfort or blur persists, arrange prompt medical review; sudden vision loss or severe pain needs help now.", "Si persisten las molestias o la visión borrosa, pide revisión médica pronta; la pérdida súbita de visión o el dolor intenso requieren ayuda ya.")],
        "Foreign-body sensation without reported sudden vision loss or severe pain; eye examination needed if persistent.", "Sensación de cuerpo extraño sin pérdida súbita de visión ni dolor intenso referidos; precisa exploración si persiste.", src),
    "eye_orange": result("naranja", "New blurred vision needs a medical review", "La visión borrosa nueva necesita revisión médica", [
        ("Stop visually demanding or hazardous tasks and ask a crewmate for help moving safely.", "Deja las tareas de exigencia visual o peligrosas y pide ayuda a un compañero para moverte con seguridad."),
        ("Tell the CMO now; arrange flight-surgeon review and the onboard eye assessment at the next link.", "Avisa ya al CMO; organiza la revisión con el cirujano de vuelo y la valoración ocular de a bordo en el próximo enlace."),
        ("Record onset and whether one or both eyes are affected; do not label this as SANS.", "Anota el inicio y si afecta a uno o a los dos ojos; no lo des por SANS."),
        ("Seek immediate help for sudden vision loss, severe eye pain or new speech or movement difficulty.", "Pide ayuda inmediata si pierdes visión de repente, aparece dolor ocular intenso o dificultad nueva al hablar o moverte.")],
        "Blurred vision reported; no sudden vision loss selected. SANS or another diagnosis not established.", "Se comunica visión borrosa; no se ha elegido pérdida súbita de visión. No se establece SANS ni otro diagnóstico.", src),
})
add_flow("eye_problem", "health", "My vision is blurred or something is in my eye", "Veo borroso o tengo algo en el ojo", "Eye", n, "eye_splash")

# 3.4 / 3.15: basic protection and procedure referral for injury.
src = ["imm_ranking", "hrp_risks"]
n = safety_nodes("injury_severity")
n.update({
    "injury_severity": q("Which injury sign is present?", "¿Qué señal presenta la lesión?", "A large, deep, chemical or electrical burn is serious, as is heavy bleeding or severe persistent pain.", "Una quemadura extensa, profunda, química o eléctrica es grave, igual que el sangrado abundante o el dolor intenso persistente.", [
        ("blood", "Heavy bleeding", "Sangrado abundante", "injury_red"),
        ("burn", "Serious burn", "Quemadura grave", "injury_red"),
        ("pain", "Severe pain not settling", "Dolor intenso que no cede", "injury_red"),
        ("none", "None of these", "Nada de esto", "injury_kind")], src=src),
    "injury_kind": question("Is this a burn?", "¿Es una quemadura?", "burn_cause", "wound_depth", src,
                           "Burns and wounds use different onboard procedures.", "Las quemaduras y las heridas tienen procedimientos distintos de a bordo."),
    # Revisión de los 13 flujos, problema grave 5: química o eléctrica siempre escala, aunque no se marque «grave».
    "burn_cause": question("Was it caused by a chemical or by electricity?", "¿La ha causado un producto químico o la electricidad?", "injury_red", "burn_yellow", src,
                           "Chemical and electrical burns can be deeper than they look.", "Las quemaduras químicas y eléctricas pueden ser más profundas de lo que parecen.", unsure="injury_red"),
    "wound_depth": question("Is the wound deep or gaping?", "¿La herida es profunda o está abierta de lado a lado?", "wound_orange", "wound_yellow", src,
                            "A deeper wound needs prompt assessment.", "Una herida profunda necesita valoración pronta."),
    "injury_red": urgent("Serious injury: alert the CMO now", "Lesión grave: avisa ya al CMO",
                         "Heavy bleeding, large/deep/chemical/electrical burn or severe persistent injury pain reported; clarify selected sign.", "Se comunica sangrado abundante, quemadura extensa/profunda/química/eléctrica o dolor intenso persistente; concretar la señal elegida.", src,
                         ("For bleeding, apply firm direct pressure with a clean dressing per procedure; do not remove an embedded object. For a burn, stop exposure if safe.", "Si sangra, aplica presión directa firme con un apósito limpio según el procedimiento; no saques objetos clavados. Si es una quemadura, interrumpe la exposición si es seguro.")),
    "burn_yellow": result("amarillo", "Protect the burn and show it to the CMO", "Protege la quemadura y enséñasela al CMO", [
        ("Stop contact with the heat source if safe.", "Interrumpe el contacto con el calor si es seguro."),
        ("Use the approved onboard burn-cooling and dressing procedure with contained fluids; do not use ice or improvised creams.", "Usa el procedimiento aprobado de enfriamiento y cura de quemaduras con líquidos contenidos; no uses hielo ni cremas improvisadas."),
        ("Ask the CMO to assess the area and depth, especially on the face, hands or joints.", "Pide al CMO que valore la extensión y la profundidad, sobre todo en cara, manos o articulaciones."),
        ("Get immediate help for increasing severe pain, a large or deep burn, or any breathing difficulty.", "Pide ayuda inmediata si aumenta el dolor intenso, la quemadura es extensa o profunda o cuesta respirar.")],
        "Burn without listed severe signs selected; area, depth and exposure mechanism need CMO assessment.", "Quemadura sin las señales graves indicadas; el CMO debe valorar extensión, profundidad y mecanismo.", src),
    "wound_orange": result("naranja", "Deep wound: ask the CMO to assess it promptly", "Herida profunda: pide al CMO que la valore pronto", [
        ("Control bleeding with a clean dressing and direct pressure per onboard procedure.", "Controla el sangrado con un apósito limpio y presión directa según el procedimiento de a bordo."),
        ("Tell the CMO now and request flight-surgeon advice at the next link.", "Avisa ya al CMO y pide consejo al cirujano de vuelo en el próximo enlace."),
        ("Cover the wound; do not probe it, remove embedded objects or attempt to close it yourself.", "Cubre la herida; no la explores por dentro, saques objetos clavados ni intentes cerrarla por tu cuenta."),
        ("Get immediate help if bleeding becomes heavy or will not stop with pressure.", "Pide ayuda inmediata si el sangrado se vuelve abundante o no para con la presión.")],
        "Deep or gaping wound reported without heavy bleeding selected; prompt wound assessment required.", "Se comunica herida profunda o abierta sin sangrado abundante elegido; precisa valoración pronta.", src),
    "wound_yellow": result("amarillo", "Clean and cover the small wound", "Limpia y cubre la herida pequeña", [
        ("Wash your hands and use the onboard wound-cleaning procedure.", "Lávate las manos y sigue el procedimiento de limpieza de heridas de a bordo."),
        ("Cover with the approved clean dressing and contain any loose material.", "Cubre con el apósito limpio previsto y recoge cualquier material suelto."),
        ("Show the CMO and record the injury time and cause.", "Enséñasela al CMO y anota la hora y la causa de la lesión."),
        ("Ask for review if redness spreads, swelling or fever appears; uncontrolled bleeding or severe persistent pain needs help now.", "Pide revisión si se extiende el enrojecimiento, aparece hinchazón o fiebre; el sangrado que no se controla o el dolor intenso persistente requieren ayuda ya.")],
        "Apparently small wound without reported heavy bleeding, severe persistent pain or gaping; monitor healing.", "Herida aparentemente pequeña sin sangrado abundante, dolor intenso persistente ni apertura referidos; vigilar evolución.", src),
})
add_flow("wound_or_burn", "health", "I have a wound or a burn", "Tengo una herida o una quemadura", "Bandage", n)

# 3.6 / 3.7: flank pain is not a kidney-stone diagnosis.
src = ["imm_ranking", "hrp_risks"]
n = safety_nodes("flank_severe")
n.update({
    "flank_severe": question("Is the pain severe and not settling?", "¿El dolor es intenso y no cede?", "flank_red", "flank_fever", src,
                             "Severe persistent pain needs urgent help.", "El dolor intenso que no cede necesita ayuda urgente."),
    "flank_fever": question("Do you also have fever?", "¿Tienes también fiebre?", "flank_red", "flank_urine", src,
                            "Fever with flank pain needs urgent assessment.", "La fiebre con dolor en el costado necesita valoración urgente."),
    "flank_urine": question("Can you pass urine?", "¿Puedes orinar?", "flank_orange", "flank_red", src,
                            "Inability to pass urine changes the urgency.", "No poder orinar cambia la urgencia."),
    "flank_red": urgent("Flank or back pain with a warning sign: get help now", "Dolor de costado o espalda con señal de alarma: pide ayuda ya",
                        "Flank/back pain with severe unrelenting pain, fever or inability to pass urine reported; selected sign needs clarification.",
                        "Dolor de costado/espalda con dolor intenso que no cede, fiebre o imposibilidad de orinar; concretar la señal elegida.", src),
    "flank_orange": result("naranja", "Flank or back pain needs prompt medical review", "El dolor de costado o espalda necesita revisión médica pronta", [
        ("Stop exercise and rest secured in a comfortable position.", "Deja el ejercicio y descansa con una sujeción segura en una postura cómoda."),
        ("Tell the CMO now; request flight-surgeon review at the next link and any onboard examination they indicate.", "Avisa ya al CMO; pide revisión con el cirujano de vuelo en el próximo enlace y la exploración de a bordo que indique."),
        ("Record pain location, onset, urine changes and fluid intake; do not assume a kidney stone.", "Anota dónde duele, cuándo empezó, los cambios en la orina y lo que bebes; no des por hecho que es un cálculo renal."),
        ("If alert and swallowing normally, take usual small drinks within your mission fluid plan; do not force large volumes.", "Si estás bien despierto y tragas con normalidad, bebe pequeñas cantidades habituales dentro de tu plan de misión; no fuerces grandes volúmenes."), NEW_MED,
        ("Get urgent help if severe pain does not settle, fever appears, you cannot pass urine or new leg weakness occurs.", "Pide ayuda urgente si el dolor intenso no cede, aparece fiebre, no puedes orinar o notas debilidad nueva en las piernas.")],
        "Flank/back pain; no severe unrelenting pain or fever selected, able to urinate. Cause not established.", "Dolor de costado/espalda; no se eligen dolor intenso persistente ni fiebre, puede orinar. Causa sin determinar.", src),
})
add_flow("flank_back_pain", "health", "My side or back hurts badly", "Me duele mucho el costado o la espalda", "Activity", n)

# 3.5: infection support without diagnostic or drug claims.
src = ["immune_crucian", "hrp_risks"]
n = safety_nodes("fever_neck")
n.update({
    "fever_neck": q("Which warning sign is present?", "¿Qué señal de alarma hay?",
                    "These signs with illness need immediate assessment.", "Estas señales cuando estás enfermo necesitan valoración inmediata.", [
                        ("neck", "Fever and stiff neck", "Fiebre y rigidez de cuello", "fever_red"),
                        ("confusion", "New confusion", "Confusión nueva", "fever_red"),
                        ("pain", "Severe pain not settling", "Dolor intenso que no cede", "fever_red"),
                        ("none", "None of these", "Nada de esto", "fever_fluids")], src=src),
    "fever_fluids": question("Can you keep fluids down?", "¿Puedes retener líquidos?", "fever_worse", "fever_orange", src,
                            "Being unable to drink needs prompt review.", "No poder beber necesita revisión pronta."),
    "fever_worse": question("Are symptoms getting worse?", "¿Los síntomas están empeorando?", "fever_orange", "fever_yellow", src,
                            "A worsening illness needs prompt review.", "Una enfermedad que empeora necesita revisión pronta."),
    "fever_red": urgent("Illness with a warning sign: get help now", "Malestar con señal de alarma: pide ayuda ya",
                        "Fever with stiff neck, new confusion or severe persistent pain reported; clarify selected sign.", "Se comunica fiebre con rigidez de cuello, confusión nueva o dolor intenso persistente; concretar la señal elegida.", src),
    "fever_orange": result("naranja", "Worsening illness: contact the CMO now", "Malestar que empeora: contacta ya con el CMO", [
        ("Pause work and tell the CMO now; arrange flight-surgeon review at the next link.", "Deja el trabajo y avisa ya al CMO; organiza revisión con el cirujano de vuelo en el próximo enlace."),
        ("Measure temperature with the approved device and record the time, symptoms and fluid intake.", "Mide la temperatura con el equipo aprobado y anota la hora, los síntomas y lo que bebes."),
        ("Use hand hygiene and follow the onboard infection-control and shared-equipment cleaning procedures.", "Cuida la higiene de manos y sigue los procedimientos de control de infecciones y limpieza del material compartido."), NEW_MED,
        ("Get urgent help for breathing difficulty, new confusion, fever with a stiff neck or severe pain that does not settle.", "Pide ayuda urgente si cuesta respirar, aparece confusión, fiebre con rigidez de cuello o dolor intenso que no cede.")],
        "Fever or infection symptoms worsening; no listed emergency sign selected. Infection not confirmed.", "Fiebre o síntomas de infección que empeoran; no se eligen las señales de emergencia indicadas. Infección sin confirmar.", src),
    "fever_yellow": result("amarillo", "Rest, record symptoms and tell the CMO", "Descansa, anota los síntomas y avisa al CMO", [
        ("Rest and take regular fluids within your mission plan if you can swallow normally.", "Descansa y bebe con regularidad dentro de tu plan de misión si tragas con normalidad."),
        ("Measure and log temperature with the approved device; tell the CMO about the symptoms.", "Mide y anota la temperatura con el equipo aprobado; comenta los síntomas al CMO."),
        ("Wash hands and follow onboard infection-control procedures for contact and shared equipment.", "Lávate las manos y sigue los procedimientos de control de infecciones para el contacto y el material compartido."), NEW_MED,
        ("Ask for prompt review if symptoms persist or worsen; breathing difficulty, confusion or fever with a stiff neck needs immediate help.", "Pide revisión pronta si los síntomas persisten o empeoran; la dificultad respiratoria, la confusión o la fiebre con rigidez de cuello necesitan ayuda inmediata.")],
        "Fever or infection symptoms without worsening or listed emergency signs selected; temperature and course need recording.", "Fiebre o síntomas de infección sin empeoramiento ni las señales de emergencia indicadas; registrar temperatura y evolución.", src),
})
add_flow("fever_infection", "health", "I feel feverish or think I have an infection", "Tengo sensación de fiebre o creo que tengo una infección", "Thermometer", n)

# 3.10: gravity context is recorded, never assumed to explain a faint.
src = ["hrp_orthostatic", "hrp_cardiac"]
n = safety_nodes("faint_neuro")
n.update({
    "fainted": question("Did you lose consciousness, even briefly?", "¿Has perdido el conocimiento, aunque haya sido un momento?", "faint_orange", "faint_settle", src,
                        "A recovered faint still needs medical assessment.", "Un desmayo necesita valoración médica aunque te hayas recuperado."),
    "faint_neuro": question("Do you have new weakness on one side?", "¿Tienes debilidad nueva en un lado del cuerpo?", "faint_red", "fainted", src,
                            "New one-sided weakness needs immediate help.", "La debilidad nueva de un lado necesita ayuda inmediata."),
    "faint_settle": question("Does the faint feeling settle when you rest?", "¿La sensación de desmayo cede al descansar?", "faint_yellow", "faint_orange", src,
                            "Persistent symptoms need prompt review.", "Los síntomas persistentes necesitan revisión pronta."),
    "faint_red": urgent("New one-sided weakness: get help now", "Debilidad nueva en un lado: pide ayuda ya",
                        "Feeling faint with new one-sided weakness reported; urgent assessment required.", "Sensación de desmayo con debilidad nueva en un lado; precisa valoración urgente.", src),
    "faint_orange": result("naranja", "A faint or persistent faint feeling needs the CMO now", "Un desmayo o una sensación persistente de desmayo necesita al CMO ya", [
        ("Stop activity. In gravity, lie down safely; in microgravity, rest secured. Do not move alone.", "Para la actividad. Si hay gravedad, túmbate con seguridad; en microgravedad, descansa sujeto. No te muevas sin compañía."),
        ("Ask a crewmate to stay and call the CMO now; request flight-surgeon review at the next link.", "Pide a un compañero que se quede y llame ya al CMO; solicita revisión con el cirujano de vuelo en el próximo enlace."),
        ("Record any loss of consciousness, injury, recent gravity transition and available pulse or blood-pressure readings.", "Anota si perdiste el conocimiento, si te lesionaste, si ha cambiado la gravedad y las lecturas disponibles de pulso o tensión."),
        CHEST, COLLAPSE],
        "Recovered loss of consciousness or persistent presyncope reported; cause not established.", "Se comunica pérdida de conocimiento recuperada o sensación persistente de desmayo; causa sin determinar.", src),
    "faint_yellow": result("amarillo", "Rest safely and report the faint feeling", "Descansa con seguridad y comunica la sensación de desmayo", [
        ("Pause activity; lie down in gravity or rest secured in microgravity.", "Para la actividad; túmbate si hay gravedad o descansa sujeto en microgravedad."),
        ("Ask a crewmate to stay nearby and tell the CMO before resuming work.", "Pide a un compañero que se quede cerca y avisa al CMO antes de volver al trabajo."),
        ("Record timing, fluid intake, gravity context and available measurements; get up or move gradually with help.", "Anota la hora, lo que has bebido, la situación de gravedad y las medidas disponibles; incorpórate o muévete poco a poco con ayuda."),
        ("Seek prompt review if it returns; loss of responsiveness, abnormal breathing, chest pain or new one-sided weakness needs help now.", "Pide revisión pronta si vuelve; si no respondes, respiras de forma anormal, tienes dolor en el pecho o debilidad nueva de un lado, hace falta ayuda ya.")],
        "Presyncope settles with rest; no loss of consciousness or new one-sided weakness reported. Cause not established.", "Sensación de desmayo que cede con reposo; sin pérdida de conocimiento ni debilidad nueva de un lado referidas. Causa sin determinar.", src),
})
add_flow("fainting", "health", "I fainted or feel as if I might faint", "Me he desmayado o siento que voy a desmayarme", "Activity", n)

# 3.15 / section 5: protective action precedes every smoke-flow question.
air_intro_en = "Leave the affected area, use mask/oxygen per onboard procedure and alert the whole crew NOW. Do not wait to answer."
air_intro_es = "Sal de la zona afectada, usa mascarilla/oxígeno según el procedimiento de a bordo y avisa a toda la tripulación YA. No esperes a responder."
src = ["imm_ranking", "hrp_risks", "eimo_levin"]
n = {
    # Revisión de los 13 flujos, problema grave 6: la orden va en el titular, no en la letra pequeña.
    "safe": q("Leave now and follow the vehicle fire or toxic-atmosphere procedure with the commander. Are you in the safe area?",
              "Sal ya y sigue con el comandante el procedimiento de la nave para fuego o atmósfera tóxica. ¿Estás en la zona segura?",
              air_intro_en, air_intro_es, YN("air_awake", "exposure_red"),
              say_en=air_intro_en + " Have you reached the safe area?", say_es=air_intro_es + " ¿Has llegado a la zona segura?", src=src, esc=True),
    "air_awake": question("Is everyone responding normally?", "¿Todos responden con normalidad?", "air_breathing", "exposure_collapse", src,
                          "Only assess from safety; never re-enter a hazardous area to answer.", "Valora solo desde un lugar seguro; no vuelvas a una zona peligrosa para responder."),
    "air_breathing": question("Is anyone having trouble breathing?", "¿A alguien le cuesta respirar?", "exposure_breathing", "exposure_review", src,
                              "Symptoms can continue after leaving the area.", "Los síntomas pueden continuar tras salir de la zona."),
}
for nid, en, es, detail_en, detail_es in [
    ("exposure_red", "Leave the hazard now", "Sal ya de la zona de peligro", "Safe area not yet reached.", "Todavía no se ha llegado a la zona segura."),
    ("exposure_collapse", "Exposure with unresponsiveness: get help now", "Exposición con falta de respuesta: pide ayuda ya", "Someone is not responding normally.", "Alguien no responde con normalidad."),
    ("exposure_breathing", "Exposure with breathing difficulty: get help now", "Exposición con dificultad respiratoria: pide ayuda ya", "Breathing difficulty reported.", "Se comunica dificultad respiratoria."),
    ("exposure_review", "Stay in safety and get medical assessment now", "Quédate en la zona segura y pide valoración médica ya", "No current breathing difficulty reported; exposure still requires assessment.", "No se comunica dificultad respiratoria actual; la exposición sigue necesitando valoración."),
]:
    n[nid] = result("rojo", en, es, AIR_STEPS + [
        ("Once safe, report exposure time, location and symptoms to the CMO; for chest pain open the triage \"I feel pressure in my chest\".", "Una vez a salvo, comunica al CMO la hora, el lugar y los síntomas de la exposición; si hay dolor en el pecho, abre el triaje «Noto presión en el pecho».")],
        "Suspected smoke/fire/toxic exposure. " + detail_en, "Sospecha de exposición a humo/fuego/tóxicos. " + detail_es, src)
# Every question in an active exposure remains an escalation, including after evacuation.
for node in n.values():
    node["escalate"] = True
add_flow("smoke_fire_toxic", "emergency", "There is smoke, fire or a possible toxic exposure", "Hay humo, fuego o una posible exposición tóxica", "Flame", n, "safe")

# 3.1 / 3.12 / section 5: supportive, non-diagnostic care. Rehecho el 14-nov (Carlos: «al decir que estaba cansado me
# preguntó si quería hacerme daño»). Orden de investigacion/triaje-y-bienestar-referencias.md (B.3) y de
# investigacion/triaje-revision-flujos-nuevos.md: contexto y señales de alarma del síntoma → funcionamiento → puerta de
# ánimo → preguntas de riesgo solo si hacen falta (siempre antes de un naranja, y siempre en el ánimo bajo persistente).
# Riesgo en escalera, con la estructura del C-SSRS pero con texto propio: pensamientos → intención, plan o conducta.
# Nada de esto lo ha revisado un clínico.
MIND_SRC = ["hrp_risks", "bh_tb016", "eimo_levin"]
RISK_SRC = ["cssrs", "asking_safe", "bh_tb016"]

HARM_STEPS = [
    ("You do not have to handle this alone. Tell a crewmate you trust or the CMO right now, and stay with them.",
     "No tienes que pasar por esto a solas. Díselo ahora a un compañero de confianza o al CMO y quédate con esa persona."),
    ("The CMO and commander will follow the onboard behavioural health emergency procedure: that is what it is for.",
     "El CMO y el comandante seguirán el procedimiento de emergencia de salud mental de a bordo: para eso existe."),
    ("With the CMO, put distance between you and anything you could use to hurt yourself or someone else.",
     "Con el CMO, aleja de ti cualquier cosa con la que pudieras hacerte daño o hacérselo a otra persona."),
    ("The flight surgeon and behavioural health team are contacted at the next link; the crew does not wait for the reply to support you.",
     "Se avisa al cirujano de vuelo y al equipo de salud mental en cuanto haya enlace; la tripulación no espera la respuesta para apoyarte."),
]
MIND_HELP = ("Talk to someone you trust today; you can request a private psychological conference with the flight surgeon or psychologist at the next window.",
             "Habla hoy con alguien de confianza; puedes pedir una conferencia psicológica privada con el cirujano de vuelo o el psicólogo en la próxima ventana.")
MIND_RETURN = ("Open this check again if it persists or gets worse. If thoughts of hurting yourself or someone else appear, tell a crewmate or the CMO straight away.",
               "Vuelve a abrir este chequeo si persiste o empeora. Si aparecen pensamientos de hacerte daño o hacérselo a otra persona, díselo enseguida a un compañero o al CMO.")


def risk_nodes(no_next, suffix=""):
    """Escalera de riesgo. «I'd rather not say» es una salida válida y respetada."""
    return {
        "risk" + suffix: q(
            "Some people who feel this way have thoughts of not wanting to be alive, or of hurting themselves or someone else. I ask everyone this. Has that been happening to you?",
            "Hay personas que, cuando se sienten así, piensan en no querer vivir o en hacerse daño o hacérselo a otra persona. Se lo pregunto a todo el mundo. ¿Te está pasando a ti?",
            "Asking directly does not put the idea in anyone's head; it lets us get you the right support.",
            "Preguntarlo directamente no le mete la idea a nadie; sirve para darte el apoyo adecuado.",
            [("si", "Yes", "Sí", "risk_plan"), ("no", "No", "No", no_next), ("skip", "I'd rather not say", "Prefiero no decirlo", "mind_private")],
            src=RISK_SRC),
    }


def risk_common():
    return {
        "risk_plan": q("Thank you for telling me. Are you thinking about acting on these thoughts, have you made a plan, or have you done something to hurt yourself recently?",
                       "Gracias por contármelo. ¿Estás pensando en actuar según esos pensamientos, has hecho un plan o has hecho algo recientemente para hacerte daño?",
                       "This tells us how quickly to bring someone to you.", "Esto nos dice con qué rapidez hay que llevarte a alguien.",
                       [("si", "Yes", "Sí", "harm_now"), ("no", "No", "No", "risk_support"), ("unsure", "Not sure", "No estoy seguro", "harm_now")],
                       src=RISK_SRC, esc=True),
        "harm_now": result("rojo", "Stay with someone and get help now", "Quédate con alguien y pide ayuda ya", HARM_STEPS,
                           "Thoughts of self-harm or of harming others with intent, a plan or recent behaviour (or unsure). Immediate company and CMO/commander support required.",
                           "Pensamientos de hacerse daño o de dañar a otros con intención, plan o conducta reciente (o no lo sabe). Requiere compañía inmediata y apoyo del CMO/comandante.", RISK_SRC),
        "risk_support": result("naranja", "Thank you for telling me: let's get you support today", "Gracias por contármelo: busquemos apoyo hoy", [
            ("Tell the CMO today, in private, about these thoughts; you decide how much to share.", "Cuéntale hoy al CMO, en privado, esos pensamientos; tú decides cuánto compartir."),
            ("Request a private psychological conference with the flight surgeon or psychologist at the next window.", "Pide una conferencia psicológica privada con el cirujano de vuelo o el psicólogo en la próxima ventana."),
            ("If the thoughts get stronger or you feel you might act on them, tell a crewmate or the CMO right away and do not stay alone.", "Si los pensamientos se hacen más fuertes o sientes que podrías actuar, díselo enseguida a un compañero o al CMO y no te quedes a solas.")],
            "Thoughts of not wanting to be alive or of harm reported, without intent, plan or recent behaviour. CMO support today and private psychological conference.",
            "Refiere pensamientos de no querer vivir o de hacer daño, sin intención, plan ni conducta reciente. Apoyo del CMO hoy y conferencia psicológica privada.", RISK_SRC),
        "mind_private": result("amarillo", "That's okay. A private conversation can help", "Está bien. Una conversación en privado puede ayudar", [
            ("You decide what to share. A private talk with the CMO today, or a private psychological conference at the next window, stays between you and them.", "Tú decides qué contar. Una charla privada con el CMO hoy, o una conferencia psicológica privada en la próxima ventana, queda entre vosotros."),
            ("If you ever have thoughts of hurting yourself or someone else, tell a crewmate or the CMO straight away.", "Si en algún momento piensas en hacerte daño o en hacérselo a otra persona, díselo enseguida a un compañero o al CMO."),
            MIND_HELP],
            "Preferred not to answer the risk question. Offered private support; no automatic alert.",
            "Prefirió no contestar la pregunta de riesgo. Se le ofrece apoyo privado; sin aviso automático.", RISK_SRC),
    }


MOOD_GATE = ("Over the last two weeks, have you often felt down or hopeless, or lost interest in things you usually enjoy?",
             "En las dos últimas semanas, ¿te has sentido a menudo decaído o sin esperanza, o has perdido el interés por lo que sueles disfrutar?",
             "Two quick mood questions help decide whether to offer more support.", "Dos preguntas rápidas de ánimo ayudan a decidir si conviene ofrecer más apoyo.")


def mood_gate(node_id, yes, no, src):
    return {node_id: question(MOOD_GATE[0], MOOD_GATE[1], yes, no, src, MOOD_GATE[2], MOOD_GATE[3])}


def mind_results(en, es, steps, low_level, orange_steps=(), src=MIND_SRC):
    return {
        "mind_orange": result("naranja", "You deserve support: speak to the CMO today", "Mereces apoyo: habla hoy con el CMO", [
            ("Pause demanding or safety-critical work; ask the CMO or commander to arrange cover if needed.", "Para las tareas exigentes o críticas para la seguridad; pide al CMO o al comandante que organice un relevo si lo necesitas."),
            ("Tell the CMO what is happening; request a private review with the flight surgeon or behavioural health team at the next window.", "Cuéntale al CMO qué te pasa; pide una revisión privada con el cirujano de vuelo o el equipo de salud mental en la próxima ventana."),
            *orange_steps, steps[0], MIND_RETURN],
            en + ". Daily functioning affected or initial support not enough; no thoughts of harm reported; no psychiatric diagnosis established.",
            es + ". Afecta al funcionamiento diario o el apoyo inicial no basta; no refiere pensamientos de hacer daño; no se establece un diagnóstico psiquiátrico.", src),
        "mind_yellow": result(low_level, "Take this one step at a time", "Vamos paso a paso", [*steps, MIND_HELP, MIND_RETURN],
            en + ". No thoughts of harm reported; initial support available, without reported major functional impact.",
            es + ". No refiere pensamientos de hacer daño; dispone de apoyo inicial, sin impacto importante referido en el funcionamiento.", src),
    }


def add_mind_flow(fid, en, es, icon, start, nodes, group="mind"):
    nodes = {**risk_common(), **nodes}
    seen, todo = set(), [start]                  # solo los nodos a los que se llega desde el inicio
    while todo:
        k = todo.pop()
        if k in seen: continue
        seen.add(k); todo += [o["next"] for o in nodes[k].get("options", [])]
    add_flow(fid, group, en, es, icon, {k: v for k, v in nodes.items() if k in seen}, start)


# --- Ansiedad o pánico: primero lo físico (el pánico se confunde con el corazón y con el CO2 alto).
src = [*MIND_SRC]
steps = [
    ("Move to a quiet, safe place and ask a trusted crewmate to sit with you.", "Ve a un lugar tranquilo y seguro y pide a un compañero de confianza que se siente contigo."),
    ("Breathe gently at a comfortable pace, letting the out-breath be slow; do not force deep breaths or use a paper bag.", "Respira suavemente a un ritmo cómodo, soltando el aire despacio; no fuerces respiraciones profundas ni uses una bolsa de papel."),
    ("Notice things you can see and feel around you; describe what is happening without judging yourself.", "Fíjate en lo que ves y sientes a tu alrededor; describe lo que te pasa sin juzgarte."),
]
n = {
    "body": question("Is there chest pain or pressure, trouble breathing, or a cabin air or CO2 alarm right now?",
                     "¿Hay ahora dolor u opresión en el pecho, te cuesta respirar o hay una alarma de aire o de CO2 en la cabina?",
                     "body_now", "anx_function", ["co2_tb004", "hrp_cardiac", "ochmo_tb033"],
                     "Panic can feel like a heart problem or high CO2; those are ruled out first.", "El pánico puede parecerse a un problema de corazón o a un CO2 alto; eso se descarta primero.", unsure="body_now"),
    "body_now": urgent("Physical warning sign: alert the CMO now", "Señal física de alarma: avisa ya al CMO",
                       "Anxiety with chest symptoms, breathing difficulty or a cabin air/CO2 alarm reported; physical cause not excluded.",
                       "Ansiedad con síntomas en el pecho, dificultad para respirar o alarma de aire/CO2 de cabina; no se descarta una causa física.",
                       ["co2_tb004", "hrp_cardiac", "ochmo_tb033"],
                       ("For chest pain open the triage \"I feel pressure in my chest\"; for a cabin alarm follow the vehicle procedure first.",
                        "Si hay dolor en el pecho abre el triaje «Noto presión en el pecho»; si hay una alarma de cabina, sigue primero el procedimiento de la nave.")),
    "anx_function": question("Is the anxiety stopping you from doing essential or safety-critical tasks?", "¿La ansiedad te impide hacer las tareas esenciales o críticas para la seguridad?",
                             "risk_o", "anx_easing", src,
                             "When it affects critical work, support comes sooner.", "Si afecta al trabajo crítico, el apoyo llega antes."),
    "anx_easing": question("Is it easing with quiet support?", "¿Va bajando con apoyo y tranquilidad?", "anx_gate", "risk_o", src,
                           "This helps choose the next support step; it is not a diagnosis.", "Esto ayuda a elegir el siguiente apoyo; no es un diagnóstico."),
    **mood_gate("anx_gate", "risk_y", "mind_yellow", src),
    **risk_nodes("mind_orange", "_o"), **risk_nodes("mind_yellow", "_y"),
    **mind_results("I feel anxious or panicky", "Siento ansiedad o pánico", steps, "amarillo"),
}
add_mind_flow("anxiety_panic", "I feel anxious or panicky", "Siento ansiedad o pánico", "Wind", "body", n)

# --- Ánimo bajo persistente: aquí el cribado va siempre, en segunda posición.
steps = [
    ("Choose one small, manageable activity today, such as a meal with the crew or a short scheduled exercise session.", "Elige hoy una actividad pequeña y asequible, como comer con la tripulación o hacer una sesión corta de ejercicio del plan."),
    ("Keep a simple note of mood, sleep and appetite to share privately with the CMO.", "Anota de forma sencilla el ánimo, el sueño y el apetito para comentarlo en privado con el CMO."),
    ("Get light and routine on your side: time at the window or under the bright light panel, and regular meals.", "Pon la luz y la rutina de tu parte: un rato en la ventana o bajo el panel de luz y comidas regulares."),
]
n = {
    "lm_duration": q("How long has your mood been low?", "¿Cuánto tiempo llevas con el ánimo bajo?",
                     "Two weeks or more is a reason to bring in more support.", "Dos semanas o más es motivo para sumar más apoyo.", [
                         ("days", "A few days", "Unos días", "risk_d"),
                         ("weeks", "Two weeks or more", "Dos semanas o más", "risk_w")], src=MIND_SRC),
    **risk_nodes("lm_func_d", "_d"), **risk_nodes("lm_func_w", "_w"),
    "lm_func_d": question("Is your low mood making everyday tasks hard?", "¿El ánimo bajo te dificulta las tareas del día a día?", "mind_orange", "lm_talk", MIND_SRC,
                          "When it affects daily functioning, support comes sooner.", "Si afecta a tu funcionamiento diario, el apoyo llega antes."),
    "lm_func_w": question("Is your low mood making everyday tasks hard?", "¿El ánimo bajo te dificulta las tareas del día a día?", "mind_orange", "mind_orange", MIND_SRC,
                          "After two weeks a private review is worth it either way; this tells the CMO how urgent it is.", "Tras dos semanas merece la pena una revisión privada en cualquier caso; esto le dice al CMO lo urgente que es."),
    "lm_talk": question("Is there someone you feel able to talk to today?", "¿Hay alguien con quien te veas capaz de hablar hoy?", "mind_yellow", "mind_orange", MIND_SRC,
                        "Talking to someone is one of the most useful first steps.", "Hablar con alguien es uno de los primeros pasos más útiles."),
    **mind_results("My low mood is not going away", "Llevo tiempo con el ánimo bajo y no se me pasa", steps, "amarillo"),
}
add_mind_flow("persistent_low_mood", "My low mood is not going away", "Llevo tiempo con el ánimo bajo y no se me pasa", "CloudRain", "lm_duration", n)

# --- No consigo dormir: contexto de a bordo (litera, CO2, turnos, EVA) antes que nada emocional.
SLEEP_SRC = ["sleep_barger", "sleep_tb041", "rst_sleep", "bh_tb016"]
steps = [
    ("Protect the next scheduled sleep period; agree a regular sleep and wake time with the crew.", "Protege el próximo periodo de descanso; acuerda con la tripulación una hora regular para acostarte y levantarte."),
    ("Use your approved sleep space and its light and noise controls; wind down quietly before bed.", "Usa el espacio de descanso aprobado y sus controles de luz y ruido; baja el ritmo antes de acostarte."),
    ("Log sleep and shifts. Use sleep medication only as your flight surgeon or onboard procedures indicate.", "Anota el sueño y los turnos. Usa medicación para dormir solo como indique tu cirujano de vuelo o los procedimientos de a bordo."),
]
ENV_STEPS = [
    ("Check the bunk CO2 reading on the station screen; if the night peak is above 3 mmHg, ask the crew to check the airflow and the scrubber.", "Mira la lectura de CO2 de la litera en la pantalla de la centralita; si el pico nocturno pasa de 3 mmHg, pide a la tripulación que revise la ventilación y el filtro."),
    ("Make sure the sleep station fan is on and nothing blocks the vent; use the earplugs and eye mask from your kit.", "Comprueba que el ventilador del camarote está encendido y que nada tapa la rejilla; usa los tapones y el antifaz del kit."),
    ("Dim the cabin lights an hour before sleep and keep the light panel bright in the morning.", "Baja las luces una hora antes de dormir y pon el panel de luz fuerte por la mañana."),
]
SCHED_STEPS = [
    ("Shift changes, EVA preparation and early wake-ups disrupt sleep: tell the commander so the schedule can protect your next sleep period.", "Los cambios de turno, la preparación de una EVA y los despertares tempranos alteran el sueño: díselo al comandante para que el horario proteja tu próximo descanso."),
    ("Use the bright light panel at the start of your new day and keep the hour before sleep dim and quiet.", "Usa el panel de luz fuerte al empezar tu nuevo día y deja la hora antes de dormir con poca luz y en calma."),
    ("Under 6 hours of sleep slows reactions: ask for a second check on safety-critical steps until you catch up.", "Dormir menos de 6 horas ralentiza los reflejos: pide una segunda comprobación en los pasos críticos hasta que te recuperes."),
]
LONG_STEP = ("This has lasted a week or more: tell the CMO so they can review it with the flight surgeon.", "Esto dura una semana o más: díselo al CMO para que lo revise con el cirujano de vuelo.")
SAFE_Q = ("Is sleepiness making safety-critical tasks such as an EVA, robotics or piloting unsafe today?",
          "¿La somnolencia hace que hoy sean inseguras las tareas críticas, como una EVA, la robótica o el pilotaje?")
ENV_Q = ("Is your sleep station noisy, bright, too warm or stuffy?", "¿Tu camarote tiene ruido, luz, demasiado calor o el aire cargado?")
SCHED_Q = ("Has your schedule shifted recently, for example a shift change, EVA preparation or an early wake-up?",
           "¿Ha cambiado tu horario hace poco, por ejemplo un cambio de turno, la preparación de una EVA o un despertar temprano?")


def sleep_env_res(long):
    return result("amarillo", "Fix the sleep station first", "Arregla primero el camarote", [*ENV_STEPS, *([LONG_STEP] if long else []), steps[2], MIND_RETURN],
                  "Poor sleep with a noisy, bright, warm or stuffy sleep station reported" + ("; a week or more" if long else "") + ". Check bunk CO2 and airflow.",
                  "Mal sueño con camarote ruidoso, con luz, caluroso o con el aire cargado" + ("; una semana o más" if long else "") + ". Revisar CO2 y ventilación de la litera.",
                  [*SLEEP_SRC, "co2_tb004"])


def sleep_sched_res(long):
    return result("amarillo", "Your schedule is the main suspect", "El horario es el principal sospechoso", [*SCHED_STEPS, *([LONG_STEP] if long else []), steps[2], MIND_RETURN],
                  "Poor sleep after a recent schedule shift (shift change, EVA prep or early wake)" + ("; a week or more" if long else "") + ".",
                  "Mal sueño tras un cambio reciente de horario (turno, preparación de EVA o despertar temprano)" + ("; una semana o más" if long else "") + ".", SLEEP_SRC)


n = {
    "sl_nights": q("How many nights has this been going on?", "¿Cuántas noches llevas así?",
                   "One bad night and a week of them need different help.", "Una mala noche y una semana de ellas necesitan ayudas distintas.", [
                       ("one", "Just last night", "Solo anoche", "sl_safe"),
                       ("few", "2 to 6 nights", "De 2 a 6 noches", "sl_safe"),
                       ("week", "A week or more", "Una semana o más", "sl_safe_l")], src=SLEEP_SRC),
    "sl_safe": question(*SAFE_Q, "risk_o", "sl_env", SLEEP_SRC, "Safety first: under 6 hours of sleep slows reactions.", "Lo primero es la seguridad: dormir menos de 6 horas ralentiza los reflejos."),
    "sl_safe_l": question(*SAFE_Q, "risk_o", "risk_l", SLEEP_SRC, "Safety first: under 6 hours of sleep slows reactions.", "Lo primero es la seguridad: dormir menos de 6 horas ralentiza los reflejos."),
    "sl_env": question(*ENV_Q, "sl_env_res", "sl_sched", [*SLEEP_SRC, "co2_tb004"], "Noise, light, heat and CO2 at the bunk are common causes on board.", "El ruido, la luz, el calor y el CO2 en la litera son causas frecuentes a bordo."),
    "sl_env_l": question(*ENV_Q, "sl_env_res_l", "sl_sched_l", [*SLEEP_SRC, "co2_tb004"], "Noise, light, heat and CO2 at the bunk are common causes on board.", "El ruido, la luz, el calor y el CO2 en la litera son causas frecuentes a bordo."),
    "sl_sched": question(*SCHED_Q, "sl_sched_res", "sl_worry", SLEEP_SRC, "Shifting schedules are a known cause of short sleep in flight.", "Los cambios de horario son una causa conocida de dormir poco en vuelo."),
    "sl_sched_l": question(*SCHED_Q, "sl_sched_res_l", "mind_orange", SLEEP_SRC, "Shifting schedules are a known cause of short sleep in flight.", "Los cambios de horario son una causa conocida de dormir poco en vuelo."),
    "sl_worry": question("Is something on your mind keeping you awake, or have you been feeling low lately?", "¿Te quita el sueño algo que te preocupa, o te has sentido decaído últimamente?",
                         "risk_y", "mind_yellow", SLEEP_SRC, "Worries are a common cause of poor sleep; I only ask to offer the right help.", "Las preocupaciones son una causa frecuente de dormir mal; lo pregunto solo para ofrecerte la ayuda adecuada."),
    "sl_env_res": sleep_env_res(False), "sl_env_res_l": sleep_env_res(True),
    "sl_sched_res": sleep_sched_res(False), "sl_sched_res_l": sleep_sched_res(True),
    **risk_nodes("mind_orange", "_o"), **risk_nodes("mind_yellow", "_y"), **risk_nodes("sl_env_l", "_l"),
    **mind_results("I cannot sleep", "No consigo dormir", steps, "amarillo", [LONG_STEP], SLEEP_SRC),
}
add_mind_flow("cant_sleep", "I cannot sleep", "No consigo dormir", "Moon", "sl_nights", n)

# --- Cansancio (nuevo): «estoy cansado» no es insomnio. Causas de a bordo y seguridad operativa primero.
FAT_SRC = ["rst_sleep", "sleep_barger", "bh_tb016"]
fat_steps = [
    ("Drink regularly within your mission fluid plan and keep regular meals.", "Bebe con regularidad dentro de tu plan de misión y mantén las comidas regulares."),
    ("Use the bright light panel in the morning and keep a short nap under 30 minutes if the schedule allows.", "Usa el panel de luz fuerte por la mañana y, si el horario lo permite, una siesta corta de menos de 30 minutos."),
    ("Do the hardest tasks at your best time of day and ask for a second check on critical steps.", "Haz las tareas más difíciles a tu mejor hora del día y pide una segunda comprobación en los pasos críticos."),
]
n = {
    "fa_safe": question("Is tiredness making safety-critical tasks unsafe today, or have you nodded off during work?",
                        "¿El cansancio hace que hoy sean inseguras las tareas críticas, o te has quedado dormido trabajando?",
                        "fa_orange", "fa_ill", FAT_SRC, "Safety first: fatigue is a known cause of errors in flight.", "Lo primero es la seguridad: el cansancio es una causa conocida de errores en vuelo.", unsure="fa_orange"),
    "fa_orange": result("naranja", "Too tired for critical work: tell the commander and the CMO", "Demasiado cansancio para el trabajo crítico: avisa al comandante y al CMO", [
        ("Stop safety-critical tasks (EVA, robotics, piloting) and tell the commander so they can be reassigned.", "Deja las tareas críticas (EVA, robótica, pilotaje) y avisa al comandante para que se reasignen."),
        ("Tell the CMO today and log your recent sleep and shifts.", "Avísale hoy al CMO y anota el sueño y los turnos recientes."),
        ("Protect your next sleep period; open the triage \"I cannot sleep\" if sleeping is the problem.", "Protege tu próximo periodo de descanso; abre el triaje «No consigo dormir» si el problema es dormir."), MIND_RETURN],
        "Fatigue making safety-critical tasks unsafe or nodding off at work. Critical tasks to be reassigned; CMO review.",
        "Cansancio que hace inseguras las tareas críticas o se queda dormido trabajando. Reasignar tareas críticas; revisión del CMO.", FAT_SRC),
    "fa_ill": question("Do you also have a fever, feel unwell, or wake up with headaches?", "¿Tienes también fiebre, te encuentras mal o te despiertas con dolor de cabeza?",
                       "fa_ill_res", "fa_sleep", [*FAT_SRC, "immune_crucian", "co2_tb004"],
                       "Illness and high CO2 can both make you tired.", "Una enfermedad y un CO2 alto pueden cansarte.", unsure="fa_ill_res"),
    "fa_ill_res": result("amarillo", "Tiredness with feeling unwell: tell the CMO today", "Cansancio y malestar: avisa hoy al CMO", [
        ("Tell the CMO today; for fever open the triage \"I feel feverish or think I have an infection\".", "Avísale hoy al CMO; si hay fiebre, abre el triaje «Tengo sensación de fiebre o creo que tengo una infección»."),
        ("For morning headaches, check the bunk CO2 reading on the station screen and ask the crew to check the airflow.", "Si te despiertas con dolor de cabeza, mira la lectura de CO2 de la litera en la centralita y pide a la tripulación que revise la ventilación."),
        fat_steps[0], NEW_MED, MIND_RETURN],
        "Fatigue with fever, feeling unwell or morning headaches. Cause not established; check temperature and bunk CO2.",
        "Cansancio con fiebre, malestar o dolor de cabeza al despertar. Causa sin determinar; revisar temperatura y CO2 de la litera.", [*FAT_SRC, "immune_crucian", "co2_tb004"]),
    "fa_sleep": question("Have you slept less than 6 hours on most of the last 3 nights?", "¿Has dormido menos de 6 horas casi todas las últimas 3 noches?",
                         "fa_sleep_res", "fa_load", FAT_SRC, "On the ISS, under 6 hours was linked to slower reactions and more stress.", "En la ISS, dormir menos de 6 horas se asoció a reflejos más lentos y más estrés."),
    "fa_sleep_res": result("amarillo", "You are short of sleep: protect the next nights", "Te falta sueño: protege las próximas noches", [
        ("Protect your next sleep period and tell the commander if the schedule keeps cutting it short.", "Protege tu próximo periodo de descanso y avisa al comandante si el horario lo sigue recortando."),
        ("If you cannot fall or stay asleep, open the triage \"I cannot sleep\".", "Si no consigues dormirte o seguir dormido, abre el triaje «No consigo dormir»."),
        *fat_steps[1:], MIND_RETURN],
        "Fatigue with under 6 h of sleep on most of the last 3 nights (sleep debt).", "Cansancio con menos de 6 h de sueño casi todas las últimas 3 noches (deuda de sueño).", FAT_SRC),
    "fa_load": question("Has your workload been unusually heavy, or the days long and monotonous?", "¿Has tenido una carga de trabajo inusualmente alta, o días largos y monótonos?",
                        "fa_load_res", "fa_gate", FAT_SRC, "Both peaks of work and long quiet stretches wear people down in isolation.", "En aislamiento desgastan tanto los picos de trabajo como las rachas largas y monótonas."),
    "fa_load_res": result("amarillo", "Talk about the workload with the commander", "Habla de la carga de trabajo con el comandante", [
        ("Tell the commander how the workload is going; schedules can be adjusted before it becomes a safety issue.", "Cuéntale al comandante cómo va la carga de trabajo; el horario se puede ajustar antes de que sea un problema de seguridad."),
        ("Plan real breaks and one thing you enjoy each day, especially on monotonous days.", "Planea descansos de verdad y una cosa que disfrutes cada día, sobre todo en los días monótonos."),
        *fat_steps, MIND_RETURN],
        "Fatigue with heavy workload or monotony reported.", "Cansancio con carga de trabajo alta o monotonía.", FAT_SRC),
    **mood_gate("fa_gate", "risk_y", "mind_yellow", FAT_SRC),
    **risk_nodes("mind_yellow", "_y"),
    **mind_results("I feel very tired", "Me siento muy cansado", fat_steps, "verde", src=FAT_SRC),
}
add_mind_flow("fatigue", "I feel very tired", "Me siento muy cansado", "Battery", "fa_safe", n)

# --- Conflicto con un compañero: primero si alguien corre peligro, y por separado.
CONF_SRC = [*MIND_SRC]
steps = [
    ("Take a brief pause in a safe place and agree how essential duties will be covered.", "Haz una pausa breve en un lugar seguro y acordad cómo se cubrirán las tareas esenciales."),
    ("When you are ready, describe one specific event and what you need, without blaming; listen in turn.", "Cuando estés listo, describe un hecho concreto y lo que necesitas, sin culpar; escuchad por turnos."),
    ("Ask a neutral crewmate or the commander to help mediate; Metis can help you prepare what to say.", "Pide a un compañero neutral o al comandante que ayude a mediar; Metis puede ayudarte a preparar qué decir."),
]
n = {
    "cc_danger": question("Is anyone in physical danger right now, or have you been threatened or hurt?", "¿Alguien corre peligro físico ahora mismo, o te han amenazado o hecho daño?",
                          "threat_now", "cc_control", CONF_SRC, "Physical safety comes before anything else.", "La seguridad física va antes que todo lo demás.", unsure="threat_now"),
    "threat_now": result("rojo", "Get to safety and tell the commander now", "Ponte a salvo y avisa ya al comandante", [
        ("Move away to a safe module and do not stay alone with the person; stay with another crewmate.", "Aléjate a un módulo seguro y no te quedes a solas con esa persona; quédate con otro compañero."),
        ("Tell the commander and the CMO now; they will follow the onboard procedure for a crew safety incident.", "Avisa ya al comandante y al CMO; seguirán el procedimiento de a bordo para un incidente de seguridad de la tripulación."),
        ("If someone is hurt, the CMO assesses them first; open the triage that fits the injury.", "Si alguien está herido, el CMO lo valora primero; abre el triaje que corresponda a la lesión."),
        ("The flight surgeon and behavioural health team are contacted at the next link; do not wait for the reply to stay safe.", "Se avisa al cirujano de vuelo y al equipo de salud mental en cuanto haya enlace; no esperes la respuesta para ponerte a salvo.")],
        "Crew conflict with physical danger, threat or harm reported. Immediate separation and commander/CMO response.",
        "Conflicto de tripulación con peligro físico, amenaza o daño. Separación inmediata y respuesta del comandante/CMO.", CONF_SRC),
    "cc_control": question("Are you worried you might lose control and hurt someone, or yourself?", "¿Te preocupa perder el control y hacer daño a alguien, o a ti?",
                           "harm_now", "cc_work", RISK_SRC, "Asking this directly is part of keeping everyone safe.", "Preguntarlo directamente es parte de mantener a todos a salvo.", unsure="harm_now"),
    "cc_work": question("Is the conflict making it hard to work safely together?", "¿El conflicto os dificulta trabajar juntos con seguridad?", "mind_orange", "cc_talk", CONF_SRC,
                        "Shared tasks have to stay safe while the conflict is sorted out.", "Las tareas compartidas tienen que seguir siendo seguras mientras se arregla el conflicto."),
    "cc_talk": question("Do you feel able to have a calm conversation with support?", "¿Te ves capaz de tener una conversación tranquila, con apoyo?", "mind_yellow", "cc_mediate", CONF_SRC,
                        "This helps choose the next support step.", "Esto ayuda a elegir el siguiente apoyo."),
    "cc_mediate": result("amarillo", "Ask the commander to help mediate", "Pide al comandante que ayude a mediar", [
        ("Ask the commander or a neutral crewmate for a short, structured conversation with both of you.", "Pide al comandante o a un compañero neutral una conversación breve y ordenada con los dos."),
        *steps[:2], MIND_HELP, MIND_RETURN],
        "Crew conflict; not ready for a calm conversation yet. No danger or loss of control reported; mediation offered.",
        "Conflicto de tripulación; aún no se ve capaz de una conversación tranquila. Sin peligro ni pérdida de control referidos; se ofrece mediación.", CONF_SRC),
    **mind_results("I am having a conflict with a crewmate", "Tengo un conflicto con un compañero", steps, "verde",
                   [("Ask the commander to arrange how shared tasks will be covered safely for now.", "Pide al comandante que organice cómo cubrir de momento las tareas compartidas con seguridad.")]),
}
add_mind_flow("crew_conflict", "I am having a conflict with a crewmate", "Tengo un conflicto con un compañero", "Users", "cc_danger", n)

# --- Aislamiento y nostalgia: lo que pasa en casa primero (TB-016: una mala noticia tardía llevó a un cosmonauta a aislarse).
ISO_SRC = [*MIND_SRC]
steps = [
    ("Choose a small shared activity with a crewmate today, while keeping some private time for yourself.", "Elige hoy una actividad pequeña con un compañero y reserva también un rato a solas para ti."),
    ("Plan a private family conference or a recorded message per the mission schedule; slow replies are the link delay, not a lack of care.", "Planea una conferencia familiar privada o un mensaje grabado según el horario de la misión; que las respuestas tarden es el retraso del enlace, no falta de cariño."),
    ("Keep a familiar daily ritual, regular meals and your scheduled movement and rest.", "Mantén una rutina cotidiana que te resulte familiar, las comidas regulares y el movimiento y descanso del plan."),
]
n = {
    "is_news": question("Has something happened at home, like bad news or a loss?", "¿Ha pasado algo en casa, como una mala noticia o una pérdida?",
                        "risk_n", "is_function", ISO_SRC, "News from home lands differently when you cannot be there.", "Las noticias de casa pesan de otra manera cuando no puedes estar allí."),
    **risk_nodes("is_news_res", "_n"),
    "is_news_res": result("naranja", "Hard news from home: let's get you support today", "Una noticia dura de casa: busquemos apoyo hoy", [
        ("Tell the CMO and the commander, so the crew can give you room and support.", "Díselo al CMO y al comandante, para que la tripulación te dé espacio y apoyo."),
        ("Ask for a private family conference and a private psychological conference at the next window.", "Pide una conferencia familiar privada y una conferencia psicológica privada en la próxima ventana."),
        ("Ask the commander to lighten safety-critical work for now if you need it.", "Pide al comandante que aligere de momento el trabajo crítico si lo necesitas."),
        steps[0], MIND_RETURN],
        "Bad news or a loss at home reported; no thoughts of harm reported. CMO/commander support, private family and psychological conference.",
        "Refiere una mala noticia o una pérdida en casa; sin pensamientos de hacer daño. Apoyo del CMO/comandante, conferencia familiar y psicológica privada.", ISO_SRC),
    "is_function": question("Is feeling isolated making everyday tasks hard?", "¿Sentirte aislado te dificulta las tareas del día a día?", "risk_o", "is_gate", ISO_SRC,
                            "When it affects daily functioning, support comes sooner.", "Si afecta a tu funcionamiento diario, el apoyo llega antes."),
    **mood_gate("is_gate", "risk_y", "is_connect", ISO_SRC),
    "is_connect": question("Can you connect with someone you trust today?", "¿Puedes conectar hoy con alguien de confianza?", "mind_yellow", "risk_o", ISO_SRC,
                           "Connection is the main help for isolation.", "Conectar con alguien es la principal ayuda contra el aislamiento."),
    **risk_nodes("mind_orange", "_o"), **risk_nodes("mind_yellow", "_y"),
    **mind_results("I feel isolated and miss home", "Me siento aislado y echo de menos mi casa", steps, "verde"),
}
add_mind_flow("isolation_homesickness", "I feel isolated and miss home", "Me siento aislado y echo de menos mi casa", "Users", "is_news", n)

for fid, en, es in [
    ("companion_collapse", "A crewmate has collapsed", "Un compañero se ha desplomado"),
    ("self_chest_pressure", "I feel pressure in my chest", "Noto presión en el pecho"),
]:
    tree["flows"][fid].update(group="emergency", summary_en=en, summary_es=es, icon="HeartPulse")


for f in tree["flows"].values():
    for n in f["nodes"].values():
        for s in n["sources"]: assert s in S, s
        for o in n.get("options", []): assert o["next"] in f["nodes"], (o["next"], sorted(f["nodes"]))
    seen, todo = set(), [f["start"]]
    while todo:
        k = todo.pop()
        if k not in seen: seen.add(k); todo += [o["next"] for o in f["nodes"][k].get("options", [])]
    assert seen == set(f["nodes"]), ("inalcanzables", f.get("title_en"), sorted(set(f["nodes"]) - seen))
_out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "triage_tree.json")
json.dump(tree, open(_out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok")
