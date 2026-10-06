import fs from 'fs';
import path from 'path';

const csvPath = path.join(process.cwd(), 'src', 'airports_timezones.csv');
const outputPath = path.join(process.cwd(), 'src', 'components', 'conv', 'TimeZoneScreen.tsx');

// CSV 파일 읽기
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());

// 헤더 파싱
const headers = lines[0].split(',');
const codeIdx = headers.indexOf('code');
const identIdx = headers.indexOf('ident');
const timezoneIdx = headers.indexOf('time_zone');
const nameIdx = headers.indexOf('name');

// 공항 데이터 추출
const airports = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const fields = [];
  let currentField = '';
  let inQuote = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField);
  
  if (fields.length >= 6) {
    const code = fields[codeIdx]; // IATA
    const ident = fields[identIdx]; // ICAO
    const timeZone = fields[timezoneIdx];
    const name = fields[nameIdx];
    
    // UTC 오프셋 계산 (UTC+9 → 540분)
    let offsetMin = 0;
    if (timeZone.startsWith('UTC')) {
      const offsetStr = timeZone.slice(3);
      if (offsetStr) {
        const sign = offsetStr.startsWith('+') ? 1 : -1;
        const absOffset = offsetStr.slice(1);
        if (absOffset.includes(':')) {
          const [h, m] = absOffset.split(':').map(Number);
          offsetMin = sign * (h * 60 + m);
        } else {
          offsetMin = sign * (Number(absOffset) * 60);
        }
      }
    }
    
    airports.push({
      code,
      ident,
      timeZone,
      offsetMin,
      name
    });
  }
}

// 시간대별로 공항 그룹화
const tzGroups = {};
airports.forEach(airport => {
  const tzKey = airport.timeZone;
  if (!tzGroups[tzKey]) {
    tzGroups[tzKey] = {
      offsetMin: airport.offsetMin,
      airports: []
    };
  }
  tzGroups[tzKey].airports.push(airport);
});

// 표준 시간대 prefix 매핑
const timeZonePrefixMap = {
  'UTC-10': 'P', // Pacific
  'UTC-9': 'P',  // Pacific
  'UTC-8': 'A',  // America
  'UTC-7': 'A',  // America
  'UTC-6': 'A',  // America
  'UTC-5': 'A',  // America
  'UTC-4': 'A',  // America
  'UTC-3': 'A',  // America
  'UTC-2': 'A',  // America
  'UTC-1': 'A',  // America
  'UTC+0': 'E',  // Europe
  'UTC+1': 'E',  // Europe
  'UTC+2': 'E',  // Europe
  'UTC+3': 'E',  // Europe
  'UTC+4': 'E',  // Europe
  'UTC+5': 'S',  // Asia
  'UTC+6': 'S',  // Asia
  'UTC+7': 'S',  // Asia
  'UTC+8': 'S',  // Asia
  'UTC+9': 'S',  // Asia
  'UTC+10': 'S',  // Asia
  'UTC+11': 'U',  // Australia
  'UTC+12': 'P'   // Pacific
};

// TZ_RAW 포맷으로 변환
const tzRawLines = [];
Object.entries(tzGroups).forEach(([timeZone, data]) => {
  const prefix = timeZonePrefixMap[timeZone] || 'S'; // 기본값 Asia
  const tzId = timeZone.replace('UTC', '').replace('+', '').replace(':', '_');
  const id = prefix + tzId;
  
  // 공항 이름 정제 (쉼표로 연결, 긴 이름은 축약)
  const airportNames = data.airports.map(airport => {
    let name = airport.name;
    // 공항 이름에서 "International Airport" 등을 제거하여 짧게 함
    name = name.replace(/International Airport/, '');
    name = name.replace(/Airport/, '');
    name = name.replace(/Air Base/, '');
    name = name.trim();
    // 괄호 안 내용 제거
    name = name.replace(/\s*\([^)]*\)/, '');
    // 쉼표나 슬래시로 구분된 첫 부분만 사용
    if (name.includes(',')) {
      name = name.split(',')[0];
    }
    if (name.includes('/')) {
      name = name.split('/')[0];
    }
    return name.trim();
  });
  
  // 중복 이름 제거
  const uniqueNames = [...new Set(airportNames)];
  
  // 알파벳 순으로 정렬
  uniqueNames.sort();
  
  // 이름 길이 제한 (안드로이드에서 겹치지 않게 하기 위해)
  const shortNames = uniqueNames.map(name => {
    if (name.length > 12) {
      // 중요한 부분만 남기기 (예: "Incheon International" → "Incheon")
      const parts = name.split(' ');
      if (parts.length > 1) {
        return parts[0];
      }
      return name.slice(0, 12);
    }
    return name;
  });
  
  const nameStr = shortNames.join(',');
  
  tzRawLines.push(`${id},${data.offsetMin},${nameStr}`);
});

// 시간대 오프셋 순으로 정렬
tzRawLines.sort((a, b) => {
  const aMin = parseInt(a.split(',')[1], 10);
  const bMin = parseInt(b.split(',')[1], 10);
  return aMin - bMin;
});

// TZ_RAW 문자열 생성
const tzRaw = tzRawLines.join('\n');

// TimeZoneScreen.tsx 파일 업데이트
const tsxContent = fs.readFileSync(outputPath, 'utf-8');

// 기존 TZ_RAW 교체
const updatedContent = tsxContent.replace(
  /const TZ_RAW = `[\s\S]*?`;/,
  `const TZ_RAW = \`${tzRaw}\`;`
);

// 파일 저장
fs.writeFileSync(outputPath, updatedContent);

console.log('Successfully updated TimeZoneScreen.tsx with airport timezone list');
console.log(`Generated ${Object.keys(tzGroups).length} timezone groups`);
console.log(`Total airports: ${airports.length}`);
