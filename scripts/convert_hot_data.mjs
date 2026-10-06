import fs from 'fs';

// 엑셀 데이터 읽기
const excelData = JSON.parse(fs.readFileSync('/Users/sunghyunkim/Documents/E6B/holdover_data.json', 'utf8'));

// MM:SS → HH:MM 변환 함수
function mmssToHhmm(mmss) {
  if (!mmss || mmss === '00:00') return null;
  const parts = mmss.split(':');
  const mm = parseInt(parts[0], 10);
  const ss = parseInt(parts[1], 10);
  
  if (mm === 0 && ss === 0) return null;
  
  // 60 분 이상이면 시간으로 변환
  const hours = Math.floor(mm / 60);
  const mins = mm % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  } else {
    return `${mins}:${ss.toString().padStart(2, '0')}`;
  }
}

// 엑셀 데이터를 기존 형식으로 변환
function convertFluid(fluid) {
  const { type, brand, data } = fluid;
  const ranges = [];
  
  // -30°C 부터 0°C 까지 모든 온도 데이터 처리
  for (let temp = -30; temp <= 0; temp++) {
    const tempData = data.find(d => d.temp === temp);
    if (!tempData) continue;
    
    const values = tempData.values;
    
    if (type === 'II') {
      // Type II: [Snow 10g, Snow 25g, Mixed 10g, Mixed 25g] = 인덱스 0, 1, 2, 3
      const converted = [
        mmssToHhmm(values[0]),
        mmssToHhmm(values[1]),
        mmssToHhmm(values[2]),
        mmssToHhmm(values[3]),
      ];
      
      // 모든 값이 null 이면 스킵
      if (converted.every(v => v === null)) continue;
      
      ranges.push({ t: temp, c: converted });
    } else if (type === 'IV') {
      // Type IV: [Snow 3g, Snow 4g, Snow 10g, Snow 25g, Mixed 10g, Mixed 25g]
      // 기존 코드에서는 [Snow 3g, Snow 4g, Snow 10g, Snow 25g] = 인덱스 0, 1, 2, 3
      const converted = [
        mmssToHhmm(values[0]),
        mmssToHhmm(values[1]),
        mmssToHhmm(values[2]),
        mmssToHhmm(values[3]),
      ];
      
      if (converted.every(v => v === null)) continue;
      
      ranges.push({ t: temp, c: converted });
    }
  }
  
  if (ranges.length === 0) return null;
  
  return {
    type: type,
    brand: brand,
    ranges: ranges
  };
}

// 모든 유체 변환
const convertedFluids = [];

// Type II, IV 변환
for (const fluid of excelData) {
  const converted = convertFluid(fluid);
  if (converted) {
    convertedFluids.push(JSON.stringify(converted, null, 1).replace(/"([^"]+)":/g, '$1:').replace(/'/g, "\\'"));
  }
}

console.log(`총 ${convertedFluids.length}개 유체 변환 완료`);
console.log(convertedFluids.join(',\n  '));
