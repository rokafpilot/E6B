const fs = require('fs');
const path = require('path');

const MET_CSV_PATH = path.join(__dirname, '../dict/기상용어.xlsx - 항공기상용어약어.csv');
const AIP_CSV_PATH = path.join(__dirname, '../dict/AIP약어.xlsx - Sheet1.csv');
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
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (!line || line.startsWith('#') || line.startsWith(',') || line.includes('약 어')) continue;
    
    // 간단한 파싱: "A,(호박색) Amber" 형식에서 A 추출
    const parts = line.split(',');
    
    for (let j = 0; j < parts.length; j++) {
      const item = parts[j].trim();
      
      if (!item) continue;
      
      // 약어 패턴: 대문자, 숫자, /, -로 구성
      const match = item.match(/^([A-Z0-9/-]+)/);
      if (match) {
        const term = match[1];
        
        if (!isValidTerm(term)) continue;
        
        // 설명 찾기: 동일 라인의 다른 파트에서 한글 찾기
        const description = findKoreanDescription(line);
        const fullName = findEnglishDescription(line, term);
        
        terms.push({
          term: term.toUpperCase(),
          fullName: fullName,
          description: description,
          category: 'MET'
        });
      }
    }
  }

  console.log(`Parsed ${terms.length} valid MET terms`);
  return terms;
}

function findKoreanDescription(line) {
  const koreanMatch = line.match(/[\uAC00-\uD7AF]+.*?(?=[A-Z]|$)/);
  return koreanMatch ? koreanMatch[0].trim() : '';
}

function findEnglishDescription(line, term) {
  const englishMatch = line.match(/[A-Za-z\s-]+?(?=[\uAC00-\uD7AF]|$)/);
  return englishMatch ? englishMatch[0].replace(term, '').trim() : undefined;
}

function isValidTerm(term) {
  const validPattern = /^[A-Z0-9/-]+$/;
  return term.length >= 1 && term.length <= 10 && validPattern.test(term);
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
      if (term.fullName && !existing.fullName) {
        existing.fullName = term.fullName;
      }
      if (term.description && !existing.description) {
        existing.description = term.description;
      }
      if (term.category !== existing.category) {
        existing.category = existing.category + '/' + term.category;
      }
    }
  });

  console.log(`Removed duplicates: ${terms.length - uniqueTerms.length}`);
  return uniqueTerms;
}

function main() {
  console.log('Starting dictionary parsing with simple MET CSV parser...');

  const aipLines = readCSVFile(AIP_CSV_PATH);
  const metLines = readCSVFile(MET_CSV_PATH);

  const aipTerms = parseAIPCSV(aipLines);
  const metTerms = parseMETCSV(metLines);

  const allTerms = [...aipTerms, ...metTerms];
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