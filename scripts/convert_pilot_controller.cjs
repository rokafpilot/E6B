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
        # 더 정확한 패턴으로 개선
        term_pattern = re.compile(r'(?:^|\\n)([A-Z][A-Z0-9/\\-]{1,10})\\s*−\\s*([\\s\\S]*?)(?=(?:^|\\n)[A-Z][A-Z0-9/\\-]{1,10}\\s*−|$)')
        
        matches = term_pattern.findall(text)
        for term, description in matches:
            term = term.strip()
            description = description.strip()
            
            # 설명 정제:
            # 1. 줄바꿈 제거
            # 2. 불필요한 참조 제거 (예: "(See PAR.)")
            # 3. 중복 공백 제거
            # 4. 용어 자체를 포함하는 참조 제거
            description = re.sub(r'\\s+', ' ', description)
            description = re.sub(r'\\(See [^)]+\\)', '', description)
            description = re.sub(r'\\s+', ' ', description)
            description = description.strip()
            
            # 유효한 용어만 추가
            if term and description and len(description) > 5:
                terms.append({
                    "term": term,
                    "description": description,
                    "category": "PilotController",
                    "source": "pilot_controller_grossory.pdf",
                    "page": page_number
                })

# 중복 용어 제거 (같은 term이 다른 page에 있을 경우 첫 번째만 유지)
unique_terms = []
term_set = set()
for term in terms:
    if term['term'] not in term_set:
        term_set.add(term['term'])
        unique_terms.append(term)

# 결과 저장
result = {
    "meta": {
        "title": "Pilot/Controller Glossary",
        "source": "pilot_controller_grossory.pdf",
        "total_terms": len(unique_terms),
        "description": "Pilot/Controller Glossary from FAA AIM"
    },
    "terms": unique_terms
}

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Converted {len(unique_terms)} unique terms successfully")
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
