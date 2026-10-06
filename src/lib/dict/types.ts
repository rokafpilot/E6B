export interface AviationTerm {
  term: string;
  english: string;
  korean: string;
  source: 'AIP' | '기상' | 'AllAviation' | 'ICAO8400' | 'Glossary';
}

export interface DictionaryMeta {
  title: string;
  version: string;
  total_terms: number;
  sources: string[];
}

export interface DictionaryMetadata {
  total_terms: number;
  version: string;
  last_updated: string;
  source: string;
}

export interface DictionaryData {
  meta: DictionaryMeta;
  terms: AviationTerm[];
}
