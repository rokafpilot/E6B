#!/usr/bin/env python3
"""
Pilot/Controller Glossary CSV와 dictionary.ts 병합 스크립트 (v2 - 개선된 매칭)

매칭 규칙:
1. CSV Term에 괄호 안 약어가 있으면 (예: "ADVISORY CIRCULAR (AC)") 
   dictionary.ts의 term(약어)과 매칭하여 description 업데이트
2. CSV Term을 dictionary.ts의 fullName과 대소문자 무시 매칭
3. 위 두 방식으로 매칭 안 되면 새 항목 추가
"""

import re
import csv
import json
import shutil

CSV_PATH = "/Users/sunghyunkim/Documents/E6B/dict/pilot_controller_glossary.csv"
TS_PATH = "/Users/sunghyunkim/Documents/E6B/src/dict/dictionary.ts"


def read_csv_terms():
    """CSV에서 용어 로드"""
    terms = []
    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            term = row['Term'].strip()
            definition = row['Definition'].strip()
            if term and definition:
                terms.append((term, definition))
    print(f"CSV: {len(terms)} terms loaded")
    return terms


def read_ts_entries():
    """dictionary.ts에서 기존 항목 로드"""
    with open(TS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    start_marker = "export const ALL_AVIATION_TERMS: AviationTerm[] = "
    start_idx = content.find(start_marker)
    if start_idx < 0:
        print("ERROR: Could not find ALL_AVIATION_TERMS in TS file")
        return None, None, None, None
    
    json_start = start_idx + len(start_marker)
    
    depth = 0
    json_end = -1
    for i in range(json_start, len(content)):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                json_end = i + 1
                break
    
    if json_end < 0:
        print("ERROR: Could not parse JSON array")
        return None, None, None, None
    
    json_str = content[json_start:json_end]
    json_str = re.sub(r'//.*', '', json_str)
    json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
    
    try:
        entries = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return None, None, None, None
    
    print(f"TS: {len(entries)} entries loaded")
    return entries, content, json_start, json_end


def normalize(s):
    """대문자 + 공백 정규화"""
    if not s:
        return ""
    t = s.strip().upper()
    t = re.sub(r'\s+', ' ', t)
    return t


def extract_acronym_from_csv_term(csv_term):
    """
    CSV Term에서 괄호 안 약어 추출
    예: "ADVISORY CIRCULAR (AC)" -> "AC"
         "AERONAUTICAL INFORMATION MANUAL (AIM)" -> "AIM"
    """
    m = re.search(r'\(([A-Z][A-Z0-9/]+)\)', csv_term)
    if m:
        return normalize(m.group(1))
    
    # "ACC [ICAO]" 같은 패턴
    m = re.search(r'\[([A-Z]+)\]', csv_term)
    if m:
        return normalize(m.group(1))
    
    return None


def get_keywords_from_fullname(full_name):
    """
    fullName에서 주요 키워드 추출
    예: "Airport collaborative decision making" -> {"AIRPORT", "COLLABORATIVE", "DECISION", "MAKING"}
    """
    if not full_name:
        return set()
    words = set(re.findall(r'[A-Z][a-z]+', full_name))
    return words


def main():
    print("=" * 60)
    print("Pilot/Controller Glossary Merge Script v2")
    print("=" * 60)
    
    # 먼저 백업된 파일에서 복원 (이전 실행 결과 초기화)
    try:
        shutil.copy2(TS_PATH + ".bak", TS_PATH)
        print("Restored from backup (reverting previous merge)")
    except:
        print("No backup found, using current file")
    
    # CSV 로드
    csv_terms = read_csv_terms()
    
    # TS 로드
    result = read_ts_entries()
    if result is None or result[0] is None:
        return
    entries, content, json_start, json_end = result
    
    # CSV Term -> Definition 맵
    csv_map = {}
    for term, def_text in csv_terms:
        csv_map[normalize(term)] = def_text
    
    # CSV Term에서 괄호 약어 추출 -> Definition 맵
    csv_acronym_map = {}  # 약어 -> (csv_term, definition)
    for term, def_text in csv_terms:
        acronym = extract_acronym_from_csv_term(term)
        if acronym:
            csv_acronym_map[acronym] = (term, def_text)
    
    # TS의 term(약어) -> entry 맵
    ts_term_map = {}  # normalize(term) -> entry
    for entry in entries:
        ts_term_map[normalize(entry.get('term', ''))] = entry
    
    # 매칭 통계
    matched_by_acronym = 0
    matched_by_fullname = 0
    updated = 0
    already_english = 0
    
    # Step 1: CSV Term의 괄호 약어로 TS term 매칭
    for acronym, (csv_term, def_text) in csv_acronym_map.items():
        if acronym in ts_term_map:
            entry = ts_term_map[acronym]
            old_desc = entry.get('description', '')
            has_korean = bool(re.search(r'[\uac00-\ud7af]', old_desc))
            
            if has_korean or old_desc == entry.get('term', ''):
                entry['description'] = def_text
                updated += 1
                matched_by_acronym += 1
                print(f"  [ACRONYM] {csv_term} -> [{entry['term']}]")
                print(f"    Old: {old_desc[:60]}")
                print(f"    New: {def_text[:60]}")
            else:
                already_english += 1
    
    # Step 2: CSV Term과 TS fullName 매칭 (위에서 매칭 안 된 것들)
    matched_ts_terms = set()
    for entry in entries:
        full_name = entry.get('fullName', '')
        if not full_name:
            continue
        
        fn_norm = normalize(full_name)
        
        if fn_norm in csv_map:
            old_desc = entry.get('description', '')
            has_korean = bool(re.search(r'[\uac00-\ud7af]', old_desc))
            
            if has_korean or old_desc == entry.get('term', ''):
                entry['description'] = csv_map[fn_norm]
                updated += 1
                matched_by_fullname += 1
                matched_ts_terms.add(entry['term'])
                print(f"  [FULLNAME] {full_name} -> [{entry['term']}]")
                print(f"    Old: {old_desc[:60]}")
                print(f"    New: {csv_map[fn_norm][:60]}")
            else:
                already_english += 1
    
    print(f"\n{'=' * 60}")
    print(f"Matched by acronym: {matched_by_acronym}")
    print(f"Matched by fullName: {matched_by_fullname}")
    print(f"Descriptions updated: {updated}")
    print(f"Already had English description: {already_english}")
    
    # Step 3: 매칭 안 된 CSV 용어를 새 항목으로 추가
    existing_set = set()
    for entry in entries:
        existing_set.add(normalize(entry.get('term', '')))
        if entry.get('fullName'):
            existing_set.add(normalize(entry['fullName']))
    
    # 이미 acronym으로 매칭된 CSV term들은 제외
    matched_csv_terms = set()
    for acronym in csv_acronym_map:
        if acronym in ts_term_map:
            matched_csv_terms.add(csv_acronym_map[acronym][0])
    
    new_entries = []
    for term, def_text in csv_terms:
        norm = normalize(term)
        if norm in existing_set:
            continue
        if term in matched_csv_terms:
            continue
        
        new_entry = {
            "term": term,
            "fullName": term,
            "description": def_text,
            "category": "P/C Glossary"
        }
        entries.append(new_entry)
        new_entries.append(term)
    
    print(f"New entries added: {len(new_entries)}")
    
    if new_entries:
        print(f"\nSample new terms (first 10):")
        for t in new_entries[:10]:
            print(f"  - {t}")
        if len(new_entries) > 10:
            print(f"  ... and {len(new_entries) - 10} more")
    
    # TS 파일 저장
    json_output = json.dumps(entries, indent=2, ensure_ascii=False)
    new_content = content[:json_start] + json_output + content[json_end:]
    
    shutil.copy2(TS_PATH, TS_PATH + ".bak2")
    print(f"\nBackup saved: {TS_PATH}.bak2")
    
    with open(TS_PATH, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Saved: {TS_PATH}")
    print(f"Total entries: {len(entries)}")


if __name__ == "__main__":
    main()
