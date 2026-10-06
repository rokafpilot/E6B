#!/usr/bin/env python3
"""
dictionary.ts AI 설명 보강 - 배치 처리 스크립트
JSON 파일에서 설명이 필요한 항목을 읽어 배치별로 AI에게 질의하고 결과를 반영
"""
import re
import json
import shutil
import os
import subprocess
import sys

TS_PATH = "/Users/sunghyunkim/Documents/E6B/src/dict/dictionary.ts"
NEEDS_JSON = "/Users/sunghyunkim/Documents/E6B/dict/needs_ai_description.json"
BATCH_DIR = "/Users/sunghyunkim/Documents/E6B/dict/batches"


def read_ts_entries():
    with open(TS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    start_marker = "export const ALL_AVIATION_TERMS: AviationTerm[] = "
    start_idx = content.find(start_marker)
    if start_idx < 0:
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


def write_ts(entries, content, json_start, json_end):
    json_output = json.dumps(entries, indent=2, ensure_ascii=False)
    new_content = content[:json_start] + json_output + content[json_end:]
    
    with open(TS_PATH, 'w', encoding='utf-8') as f:
        f.write(new_content)


def create_batches(items, batch_size=50):
    """항목을 배치로 분할"""
    batches = []
    for i in range(0, len(items), batch_size):
        batches.append(items[i:i+batch_size])
    return batches


def build_batch_prompt(batch, batch_num, total_batches):
    """배치에 대한 AI 프롬프트 생성"""
    lines = []
    for i, item in enumerate(batch):
        term = item.get('term', '')
        full_name = item.get('fullName', '') or ''
        category = item.get('category', '') or ''
        old_desc = item.get('old_description', '') or ''
        lines.append(f"{i}|{term}|{full_name}|{category}|{old_desc}")
    
    prompt = f"""You are an aviation terminology expert. Generate concise English descriptions for the following aviation terms.

For each term, provide a brief but informative description (1-2 sentences) that explains what the term means in aviation context.

Guidelines:
- NOTAM terms: ICAO meteorological code definitions (e.g., "YR" = "Your", used in NOTAM text)
- PilotController: FAA Pilot/Controller Glossary terms (aviation operational definitions)
- AIP/KMA/KMA: Korean aviation terms - provide English equivalent
- DOC8400: ICAO Document 8400 abbreviations
- P/C Glossary: Only improve if the current description is very short or Korean

Format your response as a JSON object with term as key and description as value.
Only return valid JSON, no other text.

Example format:
{{{{
  "ACDM": "A collaborative decision-making process involving airport stakeholders to optimize aircraft turnaround and reduce delays.",
  "YR": "Your. Used in NOTAM text to indicate possession or association."
}}}}

Terms to process (batch {batch_num+1}/{total_batches}):
Format: index|term|fullName|category|old_description
"""
    
    for line in lines:
        prompt += line + "\n"
    
    return prompt


def main():
    os.makedirs(BATCH_DIR, exist_ok=True)
    
    # 읽기
    result = read_ts_entries()
    if result is None or result[0] is None:
        print("Failed to read TS file")
        return
    entries, content, json_start, json_end = result
    
    # 보강이 필요한 항목 로드
    with open(NEEDS_JSON, 'r', encoding='utf-8') as f:
        needs_fix = json.load(f)
    
    print(f"Loaded {len(needs_fix)} entries needing improvement")
    
    # 배치 생성
    batches = create_batches(needs_fix, batch_size=50)
    print(f"Created {len(batches)} batches")
    
    # 각 배치 처리
    all_new_descriptions = {}
    
    for batch_num, batch in enumerate(batches):
        batch_file = os.path.join(BATCH_DIR, f"batch_{batch_num}.json")
        result_file = os.path.join(BATCH_DIR, f"batch_{batch_num}_result.json")
        
        # 배치 데이터 저장
        with open(batch_file, 'w', encoding='utf-8') as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)
        
        prompt = build_batch_prompt(batch, batch_num, len(batches))
        
        # 프롬프트 저장
        prompt_file = os.path.join(BATCH_DIR, f"batch_{batch_num}_prompt.txt")
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(prompt)
        
        print(f"\nBatch {batch_num+1}/{len(batches)} ({len(batch)} items)")
        print(f"  Prompt saved to: {prompt_file}")
        
        # AI 호출 프롬프트 출력
        print(f"\n  --- PROMPT for Batch {batch_num+1} ---")
        print(f"  Generate descriptions for these {len(batch)} terms:")
        for item in batch:
            term = item.get('term', '')
            fn = item.get('fullName', '') or ''
            cat = item.get('category', '') or ''
            print(f"    [{cat}] {term} ({fn})")
        print(f"  --- END PROMPT ---\n")
    
    print(f"\n{'=' * 60}")
    print(f"All {len(batches)} batch prompts have been generated.")
    print(f"Batch files saved in: {BATCH_DIR}")
    print(f"{'=' * 60}")
    
    # 각 배치의 결과를 적용하는 함수
    print("\nTo apply results, run this script with the result files:")
    print("  python3 enhance_descriptions.py apply <batch_num> <result_json_path>")


def apply_result(batch_num, result_path):
    """배치 처리 결과를 TS 파일에 적용"""
    result = read_ts_entries()
    if result is None or result[0] is None:
        print("Failed to read TS file")
        return
    entries, content, json_start, json_end = result
    
    # 결과 로드
    with open(result_path, 'r', encoding='utf-8') as f:
        new_descs = json.load(f)
    
    # 항목 찾아서 업데이트
    updated = 0
    for term, new_desc in new_descs.items():
        for entry in entries:
            if entry.get('term') == term:
                old_desc = entry.get('description', '')
                has_korean = bool(re.search(r'[\uac00-\ud7af]', old_desc))
                is_short = len(old_desc) < 30
                
                if has_korean or is_short:
                    entry['description'] = new_desc
                    updated += 1
                    print(f"  Updated [{term}]: {old_desc[:40]} -> {new_desc[:40]}")
                break
    
    if updated > 0:
        # 백업
        shutil.copy2(TS_PATH, TS_PATH + ".bak3")
        write_ts(entries, content, json_start, json_end)
        print(f"\nUpdated {updated} descriptions in {TS_PATH}")
    else:
        print("No updates needed")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "apply":
        if len(sys.argv) < 4:
            print("Usage: python3 enhance_descriptions.py apply <batch_num> <result_json_path>")
        else:
            apply_result(sys.argv[2], sys.argv[3])
    else:
        main()
