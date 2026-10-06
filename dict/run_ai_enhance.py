#!/usr/bin/env python3
"""
AI를 활용하여 dictionary.ts의 description을 보강하는 스크립트
배치 프롬프트를 AI에 전달하고 결과를 적용합니다.
"""
import json
import os
import re
import shutil
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


def read_batch_result(batch_num):
    """Read the AI result file for a batch"""
    result_file = os.path.join(BATCH_DIR, f"batch_{batch_num}_result.json")
    if not os.path.exists(result_file):
        return None
    with open(result_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def apply_batch_result(batch_num, entries):
    """Apply a batch result to the entries list"""
    result = read_batch_result(batch_num)
    if result is None:
        print(f"  No result file for batch {batch_num}")
        return 0
    
    updated = 0
    for term, new_desc in result.items():
        for entry in entries:
            if entry.get('term') == term:
                old_desc = entry.get('description', '')
                if new_desc != old_desc:
                    entry['description'] = new_desc
                    updated += 1
                    old_preview = old_desc[:50].replace('\n', ' ')
                    new_preview = new_desc[:50].replace('\n', ' ')
                    print(f"  Updated [{term}]: {old_preview}... -> {new_preview}...")
                break
    
    return updated


def main():
    # Load entries
    result = read_ts_entries()
    if result is None or result[0] is None:
        print("Failed to read TS file")
        return
    entries, content, json_start, json_end = result
    
    # Check which batches have results
    batch_files = sorted([f for f in os.listdir(BATCH_DIR) if f.endswith('_result.json') and not f.startswith('batch_combined')])
    
    if not batch_files:
        print("No batch result files found. Generating AI descriptions first...")
        generate_descriptions()
        return
    
    print(f"Found {len(batch_files)} batch result files")
    
    total_updated = 0
    for bf in batch_files:
        batch_num = bf.replace('batch_', '').replace('_result.json', '')
        try:
            bn = int(batch_num)
        except ValueError:
            continue
        
        print(f"\nApplying batch {bn}...")
        count = apply_batch_result(bn, entries)
        if count > 0:
            total_updated += count
            print(f"  Updated {count} descriptions")
    
    if total_updated > 0:
        # Backup
        shutil.copy2(TS_PATH, TS_PATH + ".bak5")
        write_ts(entries, content, json_start, json_end)
        print(f"\n{'=' * 60}")
        print(f"Total updated: {total_updated} descriptions")
        print(f"Backup saved to: {TS_PATH}.bak5")
        print(f"{'=' * 60}")
    else:
        print("\nNo updates applied")


def generate_descriptions():
    """Generate AI descriptions by processing each batch prompt through AI"""
    batch_files = sorted(
        [f for f in os.listdir(BATCH_DIR) if f.endswith('_prompt.txt')],
        key=lambda x: int(x.replace('batch_', '').replace('_prompt.txt', ''))
    )
    
    total_batches = len(batch_files)
    print(f"Processing {total_batches} batches...")
    
    for i, bf in enumerate(batch_files):
        batch_num = bf.replace('batch_', '').replace('_prompt.txt', '')
        prompt_path = os.path.join(BATCH_DIR, bf)
        
        # Check if result already exists
        result_path = os.path.join(BATCH_DIR, f"batch_{batch_num}_result.json")
        if os.path.exists(result_path):
            print(f"Batch {batch_num}/{total_batches-1} - Result already exists, skipping")
            continue
        
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompt = f.read()
        
        print(f"\n{'=' * 60}")
        print(f"Batch {batch_num}/{total_batches-1}")
        print(f"{'=' * 60}")
        print(prompt)
        print(f"\n{'=' * 60}")
        print(f"Please provide the AI-generated descriptions as a JSON file.")
        print(f"Save the result to: {result_path}")
        print(f"{'=' * 60}")
        
        # Wait for user to provide the result
        input("\nPress Enter after you've saved the result file...")
        
        # Verify the result
        if os.path.exists(result_path):
            with open(result_path, 'r', encoding='utf-8') as f:
                try:
                    result_data = json.load(f)
                    print(f"  Loaded {len(result_data)} descriptions from result file")
                except json.JSONDecodeError as e:
                    print(f"  Invalid JSON in result file: {e}")
                    sys.exit(1)
        else:
            print(f"  No result file found. Skipping batch {batch_num}")
    
    print(f"\nAll batches processed!")
    print(f"Now run: python3 {__file__} apply")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "apply":
        # Apply existing results
        main()
    elif len(sys.argv) > 1 and sys.argv[1] == "generate":
        # Generate descriptions by showing prompts interactively
        generate_descriptions()
    else:
        # Default: try to apply if results exist, otherwise generate
        main()
