const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AIP_CSV_PATH = path.join(__dirname, '../dict/AIP약어.xlsx - Sheet1.csv');
const MET_CSV_PATH = path.join(__dirname, '../dict/기상용어.xlsx - 항공기상용어약어.csv');
const DOCX_PATH = path.join(__dirname, '../dict/DOC 8400 Abbreviations and Codes - 9th edition with amendment 33 (1) (1).docx');
const ENG_CSV_PATH = path.join(__dirname, '../dict/Abbreviations_English.csv');
const PILOT_CONTROLLER_PDF_PATH = path.join(__dirname, '../dict/pilot_controller_grossory.pdf');
const OUTPUT_JSON_PATH = path.join(__dirname, '../src/dict/dictionary.json');
const OUTPUT_TS_PATH = path.join(__dirname, '../src/dict/dictionary.ts');

function readCSVFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split(/\r?\n/).filter(line => line.trim());
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
}

function parseAIPCSV(lines) {
  const terms = [];
  console.log('Parsing AIP CSV...');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (!line || line.startsWith('#') || line.length < 3) continue;

    if (line.startsWith('"')) {
      const closingQuoteIndex = line.lastIndexOf('"');
      if (closingQuoteIndex > 0) {
        line = line.slice(1, closingQuoteIndex);
      }
    }

    const firstSpaceIndex = line.indexOf(' ');
    if (firstSpaceIndex <= 0) continue;
    
    const term = line.slice(0, firstSpaceIndex);
    
    if (!isValidTerm(term)) continue;
    
    const rest = line.slice(firstSpaceIndex + 1).trim();
    
    const koreanMatch = rest.match(/[\uAC00-\uD7AF]+.*$/);
    if (koreanMatch) {
      const description = koreanMatch[0].trim();
      const fullName = rest.slice(0, koreanMatch.index).trim();
      
      terms.push({
        term: term.toUpperCase().trim(),
        fullName: fullName || undefined,
        description: description,
        category: 'AIP'
      });
    } else {
      terms.push({
        term: term.toUpperCase().trim(),
        description: rest,
        category: 'AIP'
      });
    }
  }

  console.log(`Parsed ${terms.length} valid AIP terms`);
  return terms;
}

function parseMETCSV(lines) {
  const terms = [];
  console.log('Parsing MET CSV...');
  console.log(`Total lines read: ${lines.length}`);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (!line || line.startsWith('#') || line.includes('약 어')) continue;
    
    // CSV line structure: ,abbr1,desc1,,abbr2,desc2
    // Split by comma to get all columns
    const cols = line.split(',');
    
    // Each pair is (col1=abbr, col2=desc) starting at index 1 and index 4
    const pairs = [
      { abbr: cols[1]?.trim(), desc: cols[2]?.trim() },
      { abbr: cols[4]?.trim(), desc: cols[5]?.trim() }
    ];
    
    pairs.forEach(pair => {
      const termStr = pair.abbr;
      const descStr = pair.desc;
      
      if (!termStr || !descStr) return;
      if (!isValidTerm(termStr)) return;
      
      // Parse description format: (fullName) koreanDescription
      // or: (koreanDescription) englishDescription
      // or just: koreanDescription
      let fullName = '';
      let description = '';
      
      const parenMatch = descStr.match(/^\(([^)]+)\)\s*(.*)$/);
      if (parenMatch) {
        const inParen = parenMatch[1].trim();
        const afterParen = parenMatch[2].trim();
        
        // Check if content in parentheses is English (has no Korean chars)
        const hasKorean = /[\uAC00-\uD7AF]/.test(inParen);
        
        if (hasKorean) {
          // (한글설명) EnglishFullName
          description = inParen;
          fullName = afterParen;
        } else {
          // (EnglishName) 한글설명
          fullName = inParen;
          description = afterParen;
        }
      } else {
        // No parentheses, whole string is description
        description = descStr;
      }
      
      // If description is empty but fullName exists, swap them
      if (!description && fullName) {
        description = fullName;
        fullName = '';
      }
      
      terms.push({
        term: termStr.toUpperCase().trim(),
        fullName: fullName || undefined,
        description: description,
        category: 'KMA'
      });
    });
  }

  console.log(`Parsed ${terms.length} valid KMA terms`);
  return terms;
}

function isValidTerm(term) {
  // 유효한 항공 약어 규칙:
  // - 주로 대문자, 숫자, /, - 로 구성
  // - 너무 짧거나 특수문자만으로 구성된 약어는 무효
  const validPattern = /^[A-Z][A-Z0-9/-]{0,9}$/;
  return term.length >= 1 && term.length <= 10 && validPattern.test(term);
}

function extractDocx8400Text() {
  console.log('Extracting DOC 8400 text...');
  const script = `
from docx import Document
doc = Document('${DOCX_PATH.replace(/'/g, "'\\''")}')
# Extract paragraphs from DECODE section (P326) to ENCODE section (P1524)
for i in range(328, 1524):
    text = doc.paragraphs[i].text.strip()
    if text:
        print(text)
`;
  fs.writeFileSync('/tmp/extract_docx8400.py', script);
  try {
    const output = execSync('python3 /tmp/extract_docx8400.py', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return output.split('\n').filter(line => line.trim());
  } catch (e) {
    console.error('Error extracting DOCX:', e.message);
    return [];
  }
}

function parseDOC8400(lines) {
  const terms = [];
  console.log('Parsing DOC 8400...');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('_') || line.startsWith('†') || line.startsWith('‡') || line.startsWith('*') || line.startsWith('#')) continue;
    if (line.includes('ICAO Abbreviations and Codes')) continue;
    if (line.match(/^\d+-\d+/)) continue; // Skip page numbers like "1-2"
    if (line === '10/11/16' || line === '18/11/10' || line === '8/11/18') continue;
    if (line === 'A') continue; // Standalone letter
    
    // Simpler approach: split by 2+ spaces which separates abbreviation-desc pairs
    const pairs = line.split(/\s{2,}/);
    
    for (const pair of pairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      
      // Try to extract abbreviation at the beginning
      const abbrMatch = trimmed.match(/^([A-Z][A-Z0-9\/\-]{1,9})\s+(.*)$/);
      if (abbrMatch) {
        const term = abbrMatch[1].trim();
        let description = abbrMatch[2].trim();
        
        // Skip if description starts with lowercase (likely continuation)
        if (description.length > 0 && description[0] >= 'a' && description[0] <= 'z') {
          continue;
        }
        
        if (isValidTerm(term)) {
          description = description.replace(/\s+/g, ' ').trim();
          description = description.replace(/[\s]*[‡†*#]$/, '').trim();
          description = description.replace(/\s+\d+$/, '').trim();
          
          terms.push({
            term: term.toUpperCase(),
            description: description,
            category: 'DOC8400'
          });
        }
      }
    }
  }

  console.log(`Parsed ${terms.length} valid DOC 8400 terms`);
  return terms;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function extractPilotControllerPDFText() {
  try {
    const TXT_PATH = path.join(__dirname, '../dict', 'pilot_controller_grossory.txt');
    
    if (fs.existsSync(TXT_PATH)) {
      console.log('Reading Pilot/Controller Glossary text from file...');
      const text = fs.readFileSync(TXT_PATH, 'utf8');
      return text.split('\n').map(line => line.trim()).filter(line => line);
    }
    
    console.log('Extracting Pilot/Controller Glossary PDF text...');
    
    const pilotControllerScript = `
import pdfplumber
with pdfplumber.open('${PILOT_CONTROLLER_PDF_PATH}') as pdf:
    text = ''
    for i, page in enumerate(pdf.pages):
        page_text = page.extract_text()
        if page_text:
            text += page_text + '\\n'
    print(repr(text))
    `;
    
    fs.writeFileSync('/tmp/pilot_controller_pdf_extract.py', pilotControllerScript);
    
    const command = `python3 /tmp/pilot_controller_pdf_extract.py`;
    const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    
    const lines = output.split('\\n').map(line => line.trim()).filter(line => line);
    
    return lines;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return [];
  }
}

function parsePilotControllerPDF(lines) {
  const terms = [];
  console.log('Parsing Pilot/Controller Glossary...');
  console.log(`Total lines read: ${lines.length}`);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('_') || line.startsWith('†') || line.startsWith('‡') || line.startsWith('*') || line.startsWith('#')) continue;
    if (line.match(/^\d+-\d+/)) continue;
    if (line === '10/11/16' || line === '18/11/10' || line === '8/11/18') continue;
    
    // 약어-설명 쌍 추출 (대문자 약어로 시작)
    const abbrMatch = line.match(/^([A-Z][A-Z0-9\/\-]{1,10})\s+(.*)$/);
    if (abbrMatch) {
      const term = abbrMatch[1].trim();
      let description = abbrMatch[2].trim();
      
      if (description.length > 0 && description[0] >= 'a' && description[0] <= 'z') {
        continue;
      }
      
      if (isValidTerm(term)) {
        description = description.replace(/\s+/g, ' ').trim();
        description = description.replace(/[\s]*[‡†*#]$/, '').trim();
        description = description.replace(/\s+\d+$/, '').trim();
        
        terms.push({
          term: term.toUpperCase(),
          description: description,
          category: 'PilotController'
        });
      }
    }
  }

  // Extract additional terms using different patterns
  const extractedTerms = new Set();
  const filteredTerms = terms.filter(term => {
    if (extractedTerms.has(term.term)) {
      return false;
    }
    extractedTerms.add(term.term);
    return true;
  });

  console.log(`Parsed ${filteredTerms.length} valid Pilot/Controller terms`);
  return filteredTerms;
}

function parseEnglishCSV(lines) {
  const terms = [];
  console.log('Parsing Abbreviations_English CSV...');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle multi-line quoted fields
    let fullLine = line;
    let quoteCount = (line.match(/"/g) || []).length;
    let j = i;
    while (quoteCount % 2 !== 0 && j + 1 < lines.length) {
      j++;
      fullLine += '\n' + lines[j];
      quoteCount = (fullLine.match(/"/g) || []).length;
    }
    if (j > i) i = j;
    
    const cols = parseCSVLine(fullLine);
    if (cols.length < 3) continue;
    
    let abbr = cols[1].trim().replace(/\s+/g, ' ');
    let meaning = cols[2].trim().replace(/\s+/g, ' ').replace(/"/g, '');
    
    if (!abbr || !meaning) continue;
    
    // Handle special abbreviations with dots/spaces like ". . . R", "...C", "MET REPORT"
    // For standard abbreviations, validate
    const cleanAbbr = abbr.replace(/[.\s]/g, '');
    const isValid = /^[A-Z0-9/.-]{1,15}$/.test(abbr) || /^[A-Z][A-Z0-9]{1,10}$/.test(cleanAbbr);
    
    if (!isValid) continue;
    
    // Skip if it's just a single letter like "A", "B" etc (already covered)
    if (/^[A-Z]$/.test(abbr) && abbr !== 'Z') continue;
    
    terms.push({
      term: abbr.toUpperCase(),
      description: meaning,
      category: 'NOTAM'
    });
  }

  console.log(`Parsed ${terms.length} valid English CSV terms`);
  return terms;
}

function removeDuplicates(terms) {
  const termMap = new Map();
  const uniqueTerms = [];

  terms.forEach(term => {
    const key = term.term.toUpperCase();
    
    if (!termMap.has(key)) {
      termMap.set(key, term);
      uniqueTerms.push(term);
    } else {
      const existing = termMap.get(key);
      // Keep the best fullName
      if (term.fullName && !existing.fullName) {
        existing.fullName = term.fullName;
      }
      // Keep the best description (prefer longer/more descriptive)
      if (term.description && (!existing.description || term.description.length > existing.description.length)) {
        existing.description = term.description;
      }
      // Merge categories without duplication
      // Do NOT replace PilotController category with other categories
      if (existing.category === 'PilotController') {
        // Keep PilotController category even if other terms are added
      } else if (term.category === 'PilotController') {
        // If existing term is not PilotController and new term is PilotController, replace category
        existing.category = 'PilotController';
      } else if (term.category === 'NOTAM') {
        // Only replace category with NOTAM if existing is not PilotController
        if (existing.category !== 'PilotController') {
          existing.category = 'NOTAM';
        }
      } else {
        const existingCats = existing.category.split('/');
        const newCats = term.category.split('/');
        const merged = [...new Set([...existingCats, ...newCats])];
        existing.category = merged.join('/');
      }
    }
  });

  console.log(`Removed duplicates: ${terms.length - uniqueTerms.length}`);
  return uniqueTerms;
}

function main() {
  console.log('Starting dictionary parsing...');

  const aipLines = readCSVFile(AIP_CSV_PATH);
  const metLines = readCSVFile(MET_CSV_PATH);
  const docxLines = extractDocx8400Text();
  const engLines = readCSVFile(ENG_CSV_PATH);
  const pilotControllerLines = extractPilotControllerPDFText();

  const aipTerms = parseAIPCSV(aipLines);
  const metTerms = parseMETCSV(metLines);
  const docx8400Terms = parseDOC8400(docxLines);
  const engCsvTerms = parseEnglishCSV(engLines);
  const pilotControllerTerms = parsePilotControllerPDF(pilotControllerLines);

  const allTerms = [...pilotControllerTerms, ...aipTerms, ...metTerms, ...docx8400Terms, ...engCsvTerms];
  console.log(`Total valid terms before dedup: ${allTerms.length}`);

  const uniqueTerms = removeDuplicates(allTerms);
  console.log(`Total terms after dedup: ${uniqueTerms.length}`);

  const sortedTerms = uniqueTerms.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.term.localeCompare(b.term);
  });

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(sortedTerms, null, 2));
  console.log(`JSON file saved: ${OUTPUT_JSON_PATH}`);

  const tsContent = `export interface AviationTerm {
  term: string;
  fullName?: string;
  description: string;
  category: string;
}

export const ALL_AVIATION_TERMS: AviationTerm[] = ${JSON.stringify(sortedTerms, null, 2)};`;

  fs.writeFileSync(OUTPUT_TS_PATH, tsContent);
  console.log(`TypeScript module saved: ${OUTPUT_TS_PATH}`);

  console.log('Dictionary parsing complete!');
}

main();