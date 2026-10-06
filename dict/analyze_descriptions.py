#!/usr/bin/env python3
"""
dictionary.ts AI 설명 보강 스크립트
- description이 부족한 항목을 찾아 AI로 영어 설명 생성
- 전체 항목 검토 후 부족한 항목만 보강
"""
import re
import json
import shutil

TS_PATH = "/Users/sunghyunkim/Documents/E6B/src/dict/dictionary.ts"


def read_ts_entries():
    with open(TS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    start_marker = "export const ALL_AVIATION_TERMS: AviationTerm[] = "
    start_idx = content.find(start_marker)
    if start_idx < 0:
        print("ERROR: Could not find ALL_AVIATION_TERMS")
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
    
    return entries, content, json_start, json_end


def needs_ai_improvement(entry):
    """
    AI 설명 보강이 필요한 항목인지 판단
    """
    desc = entry.get('description', '')
    term = entry.get('term', '')
    full_name = entry.get('fullName', '')
    category = entry.get('category', '')
    
    # 이미 충분히 긴 영어 설명이면 스킵 (P/C Glossary는 이미 양호)
    if len(desc) >= 80 and not has_korean(desc):
        # 설명에 문장 부호와 공백이 적절히 있으면 완전한 설명으로 간주
        if desc.count(' ') >= 8:
            return False
    
    # P/C Glossary 카테고리는 FAA 원문이 들어있으므로 체크
    if category == "P/C Glossary" and len(desc) >= 50:
        return False
    
    # NOTAM 중 설명이 짧은 것만 보강
    if category == "NOTAM" and len(desc) >= 30:
        # NOTAM 설명에 한글만 있거나 너무 짧은 경우만
        if not has_korean(desc) and desc.count(' ') >= 3:
            return False
    
    # PilotController 중 설명이 적절한 것 제외
    if category == "PilotController" and len(desc) >= 60 and desc.count(' ') >= 8:
        return False
    
    return True


def has_korean(text):
    return bool(re.search(r'[\uac00-\ud7af]', text))


def build_prompt_batch(entries_to_fix):
    """AI 설명 생성을 위한 프롬프트 배치 구성"""
    prompts = []
    for entry in entries_to_fix:
        term = entry.get('term', '')
        full_name = entry.get('fullName', '')
        category = entry.get('category', '')
        old_desc = entry.get('description', '')
        
        context = f"term: {term}"
        if full_name and full_name != term:
            context += f", fullName: {full_name}"
        context += f", category: {category}"
        if old_desc:
            context += f", old_description: {old_desc[:80]}"
        
        prompts.append({
            "index": entries_to_fix.index(entry),
            "term": term,
            "full_name": full_name if full_name and full_name != term else "",
            "category": category,
            "old_desc": old_desc
        })
    
    return prompts


def main():
    print("=" * 60)
    print("Dictionary.ts AI Description Enhancer")
    print("=" * 60)
    
    # 읽기
    result = read_ts_entries()
    if result is None or result[0] is None:
        return
    entries, content, json_start, json_end = result
    
    print(f"Total entries: {len(entries)}")
    
    # 보강이 필요한 항목 찾기
    needs_fix = []
    already_good = 0
    
    for entry in entries:
        if needs_ai_improvement(entry):
            needs_fix.append(entry)
        else:
            already_good += 1
    
    print(f"\nAlready have good descriptions: {already_good}")
    print(f"Need AI improvement: {len(needs_fix)}")
    
    # 카테고리별 통계
    from collections import Counter
    cat_counts = Counter()
    for entry in needs_fix:
        cat_counts[entry.get('category', '')] += 1
    
    print("\nCategories needing improvement:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")
    
    # 샘플 출력
    print(f"\nSample entries needing improvement (first 20):")
    for entry in needs_fix[:20]:
        term = entry.get('term', '')
        desc = entry.get('description', '')
        cat = entry.get('category', '')
        fn = entry.get('fullName', '')
        print(f"  [{term}] ({cat}) desc='{desc[:60]}' fn='{fn[:50]}'")
    
    print(f"\n... and {len(needs_fix) - 20 if len(needs_fix) > 20 else 0} more")
    
    # 결과 저장 (분석 결과만 출력, 실제 AI 처리는 아래에서)
    print(f"\n{'=' * 60}")
    print("Analysis complete. Ready for AI description generation.")
    print(f"{'=' * 60}")
    
    # AI description generation instructions
    print(f"""
To generate AI descriptions for {len(needs_fix)} entries, I need to process them in batches.
Each entry needs a concise English description based on the term, fullName, and category context.

The categories and their description patterns:
- NOTAM: ICAO code definitions (e.g., "YR" = "Your")
- PilotController: FAA Pilot/Controller glossary terms (need full definitions)
- AIP/AIP-KMA/KMA: Korean aviation terms (need English descriptions)
- DOC8400: ICAO document 8400 abbreviations
""")

    # 실제 설명 생성을 위한 JSON 추출
    output = []
    for entry in needs_fix:
        output.append({
            "term": entry.get('term', ''),
            "fullName": entry.get('fullName', ''),
            "category": entry.get('category', ''),
            "old_description": entry.get('description', ''),
        })
    
    json_path = "/Users/sunghyunkim/Documents/E6B/dict/needs_ai_description.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Saved entries needing AI description to: {json_path}")


if __name__ == "__main__":
    main()
