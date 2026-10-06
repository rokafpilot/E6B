const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PDF_PATH = path.join(__dirname, '../dict/pilot_controller_grossory.pdf');
const OUTPUT_PATH = path.join(__dirname, '../src/dict/pilot_controller_terms.json');

function convertPDFtoJSON() {
  console.log('Converting pilot_controller_grossory.pdf to JSON...');
  
  // Python 스크립트로 PDF 텍스트 추출
  const extractScript = `
import pdfplumber
import re
import json

pdf_path = '${PDF_PATH.replace(/'/g, "'\\''")}'
output_path = '${OUTPUT_PATH.replace(/'/g, "'\\''")}'

terms = []
with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages:
        page_number = page.page_number
        text = page.extract_text()
        
        # 용어 패턴: 대문자+기호로 시작, −로 구분 (예: "PAR−")
        term_pattern = re.compile(r'([A-Z][A-Z0-9/\\-]{1,10})\\s*−\\s*([\\s\\S]*?)(?=[A-Z][A-Z0-9/\\-]{1,10}\\s*−|$)')
        
        matches = term_pattern.findall(text)
        for term, description in matches:
            term = term.strip()
            description = description.strip()
            
            # 유효한 용어만 추가
            if term and description:
                terms.append({
                    "term": term,
                    "description": description,
                    "category": "PilotController",
                    "source": "pilot_controller_grossory.pdf",
                    "page": page_number
                })

# 결과 저장
result = {
    "meta": {
        "title": "Pilot/Controller Glossary",
        "source": "pilot_controller_grossory.pdf",
        "total_terms": len(terms),
        "description": "Pilot/Controller Glossary from FAA AIM"
    },
    "terms": terms
}

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Converted {len(terms)} terms successfully")
  `;
  
  fs.writeFileSync('/tmp/extract_pilot_controller.py', extractScript);
  
  try {
    const output = execSync('python3 /tmp/extract_pilot_controller.py', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    console.log(output);
    console.log(`JSON file created at: ${OUTPUT_PATH}`);
    
    return true;
  } catch (error) {
    console.error('Error converting PDF to JSON:', error.message);
    return false;
  }
}

// 주요 함수 실행
convertPDFtoJSON();
