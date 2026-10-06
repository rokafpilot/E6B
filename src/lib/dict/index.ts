import { ALL_AVIATION_TERMS, TOTAL_TERMS } from './dictionary';
import type { AviationTerm, DictionaryMetadata } from './types';

const DICTIONARY = ALL_AVIATION_TERMS;

export function getDictionaryMetadata(): DictionaryMetadata {
  return {
    total_terms: TOTAL_TERMS,
    version: '1.0',
    last_updated: '2024-10-10',
    source: 'DOCARE10_1_v1.xlsx',
  };
}

export type { AviationTerm } from './types';

export { TOTAL_TERMS };

/**
 * 용어 검색 (대소문자 무시, 포함 검색)
 */
export function searchTerms(query: string): AviationTerm[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return DICTIONARY.filter((term) => {
    return term.term.toLowerCase().startsWith(q);
  });
}

/**
 * 정확히 일치하는 용어 찾기
 */
export function findExact(term: string): AviationTerm | undefined {
  return DICTIONARY.find((t) => t.term.toUpperCase() === term.toUpperCase());
}

/**
 * 특정 출처의 용어만 조회
 */
export function getTermsBySource(source: AviationTerm['source']): AviationTerm[] {
  return DICTIONARY.filter((t) => t.source === source);
}

/**
 * 한글 설명이 있는 용어만 조회
 */
export function getTermsWithKorean(): AviationTerm[] {
  return DICTIONARY.filter((t) => t.korean);
}

/**
 * 모든 용어 반환
 */
export function getAllTerms(): AviationTerm[] {
  return DICTIONARY;
}

/**
 * 용어 수 반환
 */
export function getTermCount(): number {
  return DICTIONARY.length;
}
