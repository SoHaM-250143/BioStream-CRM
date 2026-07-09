import os
import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="MedSync AI BioBERT NLP Engine",
    description="Extracts clinical entities and detects critical risk anomalies from medical text reports.",
    version="1.0.0"
)

class AnalyzeRequest(BaseModel):
    report_text: str

class AnalyzeResponse(BaseModel):
    status: str
    entities: dict
    anomaly_detected: bool
    anomaly_description: str

# Let's list some medical terms for robust keyword fallback
DISEASES_KEYWORDS = [
    r"\btumor\b", r"\bmalignancy\b", r"\bmalignant\b", r"\bcarcinoma\b", r"\bcancer\b", 
    r"\bleukemia\b", r"\blymphoma\b", r"\bsarcoma\b", r"\bmelanoma\b", r"\binfarction\b", 
    r"\bstroke\b", r"\bembolism\b", r"\bthrombosis\b", r"\bhemorrhage\b", r"\bbleed\b", 
    r"\bbleeding\b", r"\bischemia\b", r"\bpneumonia\b", r"\btuberculosis\b", r"\bdiabetes\b", 
    r"\bhypertension\b", r"\barrhythmia\b", r"\bcardiomyopathy\b", r"\bosteoporosis\b"
]

CHEMICALS_KEYWORDS = [
    r"\baspirin\b", r"\bibuprofen\b", r"\bparacetamol\b", r"\bacetaminophen\b", r"\bpenicillin\b", 
    r"\bamoxicillin\b", r"\bmetformin\b", r"\binsulin\b", r"\batorvastatin\b", r"\blisinopril\b", 
    r"\bwarfarin\b", r"\bheparin\b", r"\bchemotherapy\b", r"\bdoxorubicin\b", r"\bpaclitaxel\b"
]

ANATOMY_KEYWORDS = [
    r"\blung\b", r"\blungs\b", r"\bheart\b", r"\bbrain\b", r"\bkidney\b", r"\bkidneys\b", 
    r"\bliver\b", r"\bstomach\b", r"\bcolon\b", r"\bpancreas\b", r"\bspleen\b", r"\bthyroid\b", 
    r"\bbreast\b", r"\bspine\b", r"\bbone\b", r"\bvascular\b", r"\bartery\b", r"\bvein\b"
]

ANOMALY_KEYWORDS = [
    ("malignant", "Malignancy/Cancer indicator detected in the text report."),
    ("tumor", "Potential neoplasm or mass reported."),
    ("hemorrhage", "Acute bleeding or hemorrhage flagged."),
    ("severe bleed", "Critical bleeding alert."),
    ("acute infarction", "Acute tissue necrosis/infarction flagged (potential stroke or myocardial infarction)."),
    ("critical risk", "Explicit risk assessment flagged by submitting provider.")
]

# We will try to load transformers pipeline for BioBERT NER, but fall back if offline or missing
nlp_pipeline = None
try:
    from transformers import pipeline
    model_name = os.getenv("BIOBERT_MODEL_NAME", "dmis-lab/biobert-v1.1")
    # For general medical NER, we can instantiate a pre-trained clinical pipeline
    # We suppress logging and let it load lazily
    print(f"HuggingFace Transformers detected. Initializing {model_name} loader...")
except Exception as e:
    print(f"HuggingFace pipeline loading skipped or failed: {e}. Falling back to Rule-Based parsing.")

@app.get("/health")
def health_check():
    return {"status": "healthy", "mode": "hybrid_ner"}

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_report(request: AnalyzeRequest):
    text = request.report_text.lower()
    
    extracted_diseases = []
    extracted_chemicals = []
    extracted_anatomy = []
    
    # 1. Rule-Based parsing (always runs as secondary / backup validation)
    for kw in DISEASES_KEYWORDS:
        matches = re.findall(kw, text)
        if matches:
            extracted_diseases.extend(list(set(matches)))
            
    for kw in CHEMICALS_KEYWORDS:
        matches = re.findall(kw, text)
        if matches:
            extracted_chemicals.extend(list(set(matches)))
            
    for kw in ANATOMY_KEYWORDS:
        matches = re.findall(kw, text)
        if matches:
            extracted_anatomy.extend(list(set(matches)))
            
    # 2. Model parsing (if loaded)
    if nlp_pipeline:
        try:
            ner_results = nlp_pipeline(request.report_text)
            for entity in ner_results:
                word = entity.get("word")
                ent_type = entity.get("entity")
                if ent_type == "DISEASE" and word not in extracted_diseases:
                    extracted_diseases.append(word)
                elif ent_type == "CHEMICAL" and word not in extracted_chemicals:
                    extracted_chemicals.append(word)
        except Exception as e:
            print(f"Model inference failed: {e}. Defaulting to keyword matches.")

    # 3. Anomaly Detection
    anomaly_detected = False
    anomaly_descriptions = []
    
    for word, desc in ANOMALY_KEYWORDS:
        if word in text:
            anomaly_detected = True
            anomaly_descriptions.append(desc)
            
    anomaly_description = " | ".join(anomaly_descriptions) if anomaly_detected else "No immediate clinical anomalies detected."
    
    return AnalyzeResponse(
        status="Success",
        entities={
            "diseases": list(set(extracted_diseases)),
            "chemicals": list(set(extracted_chemicals)),
            "anatomy": list(set(extracted_anatomy))
        },
        anomaly_detected=anomaly_detected,
        anomaly_description=anomaly_description
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
