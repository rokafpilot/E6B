import { ALL_AVIATION_TERMS as RAW_TERMS } from '../../dict/dictionary';
import type { AviationTerm } from './types';

const sourceMap: Record<string, AviationTerm['source']> = {
  'AIP': 'AIP',
  'AIP/MET': 'AIP',
  'MET/DOC8400': 'ICAO8400',
  'DOC8400': 'ICAO8400',
  '기상': '기상',
  'AllAviation': 'AllAviation',
  'PilotController': 'Glossary',
  'WEATHER': '기상',
  'KMA': '기상',
  'A-CDM': 'AllAviation',
};

function mapSource(category: string): AviationTerm['source'] {
  return sourceMap[category] || 'AllAviation';
}

// 용어 정제 및 변환
export const ALL_AVIATION_TERMS: AviationTerm[] = RAW_TERMS
  .filter(item => !item.term.startsWith('...'))
  .map(item => ({
    term: item.term,
    english: item.fullName || item.term,
    korean: item.description,
    source: mapSource(item.category),
  }))
  .sort((a, b) => a.term.localeCompare(b.term));

export const TOTAL_TERMS = ALL_AVIATION_TERMS.length;
