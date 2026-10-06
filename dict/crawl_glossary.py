#!/usr/bin/env python3
"""
Pilot/Controller Glossary 크롤러 - Gleim FAR/AIM 사이트 각 알파벳 섹션을 방문하여 CSV 생성
"""
import re
import csv
import time
import urllib.request
import urllib.error
import ssl

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

BASE_URL = "https://www.gleim.com/aviation/faraim/index.php"
SECTIONS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def fetch_leaf(letter, max_retries=3):
    """특정 알파벳 섹션 페이지 가져오기 (재시도 포함)"""
    url = f"{BASE_URL}?leafNum=aim_glossary_{letter.lower()}"
    
    for attempt in range(max_retries):
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        try:
            with urllib.request.urlopen(req, timeout=60, context=ssl_context) as resp:
                return resp.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f"  Attempt {attempt+1}/{max_retries} failed for section {letter}: {e}")
            if attempt < max_retries - 1:
                time.sleep(3)
    
    print(f"  Error fetching section {letter} after {max_retries} attempts")
    return None


def parse_glossary_text(text, section_letter):
    """
    텍스트에서 용어(Term)와 정의(Definition) 추출.
    패턴:
      - ***TERM-*** definition  (bold italic)
      - TERM- definition        (일반 대문자 약어)
      - TERM [ICAO]- definition (ICAO 태그)
    """
    terms = []
    
    # 섹션 헤더 이후의 내용만 사용
    # "## A" 같은 섹션 헤더 찾기
    section_header = f"## {section_letter}"
    header_idx = text.find(section_header)
    if header_idx >= 0:
        content = text[header_idx + len(section_header):]
    else:
        content = text
    
    # "## B" 같은 다음 섹션 헤더가 있으면 자르기
    next_letter = chr(ord(section_letter) + 1) if section_letter != 'Z' else None
    if next_letter:
        next_header = f"## {next_letter}"
        next_idx = content.find(next_header)
        if next_idx >= 0:
            content = content[:next_idx]
    
    # 용어 패턴: ***TERM-*** 또는 ***TERM [ICAO]-*** 또는 일반 TERM-
    # 패턴 1: ***BOLD ITALIC*** - (가장 강조된 용어)
    pattern_bi = r'\*\*\*(.+?)\*\*\*\s*[-–]\s*'
    
    # 패턴 2: 대문자 약어 + 대시 (크로스레퍼런스가 아닌 실제 정의가 있는 것)
    # "ABBREVIATED IFR FLIGHT PLANS- " 같이 줄 끝에 대시가 오는 패턴
    # 크로스레퍼런스 [(See ...)] 패턴 제외
    pattern_normal = r'^([A-Z][A-Z0-9\s/\-\(\)\.\,\']+?)\s*[-–]\s*(?![(\[])'
    
    lines = content.split('\n')
    
    current_term = None
    current_def_lines = []
    in_definition = False
    
    for line in lines:
        stripped = line.strip()
        
        # 빈 줄은 정의 구분자
        if not stripped:
            if in_definition and current_term:
                # 정의 끝
                def_text = ' '.join(current_def_lines).strip()
                def_text = re.sub(r'\s+', ' ', def_text)
                terms.append((current_term, def_text))
                current_term = None
                current_def_lines = []
                in_definition = False
            continue
        
        # 크로스레퍼런스 라인은 정의에 포함하지 않음 (별도 처리)
        if re.match(r'^\[\(See\s+', stripped) or re.match(r'^\(See\s+', stripped) or \
           re.match(r'^\(Refer to\s+', stripped) or re.match(r'^\[\(ICAO term', stripped):
            if in_definition and current_term:
                # 크로스레퍼런스는 정의에 포함하지 않음
                pass
            continue
        
        # 크로스레퍼런스만 있는 라인 (예: "AAR-\n  [(See ...)]")
        if stripped.endswith('-') and not stripped.endswith('--'):
            # 대문자 약어 + 대시 패턴 (크로스레퍼런스 전용 용어)
            term_match = re.match(r'^([A-Z][A-Z0-9\s/\-\(\)]+?)\s*[-–]\s*$', stripped)
            if term_match:
                # 이전 용어 저장
                if in_definition and current_term:
                    def_text = ' '.join(current_def_lines).strip()
                    def_text = re.sub(r'\s+', ' ', def_text)
                    terms.append((current_term, def_text))
                
                # 크로스레퍼런스 전용 용어는 저장하지 않고 스킵
                current_term = None
                current_def_lines = []
                in_definition = False
                continue
        
        # ***BOLD ITALIC*** 패턴 확인
        bi_match = re.match(r'\*\*\*(.+?)\*\*\*\s*[-–]\s*(.*)', stripped)
        if bi_match:
            # 이전 용어 저장
            if in_definition and current_term:
                def_text = ' '.join(current_def_lines).strip()
                def_text = re.sub(r'\s+', ' ', def_text)
                terms.append((current_term, def_text))
            
            current_term = bi_match.group(1).strip()
            def_part = bi_match.group(2).strip()
            current_def_lines = [def_part] if def_part else []
            in_definition = True
            continue
        
        # 일반 용어 패턴: "TERM- definition" (대문자 시작, 대시로 끝나는 패턴이 아님)
        # "AERIAL REFUELING- A procedure used..."
        normal_match = re.match(r'^([A-Z][A-Z0-9\s/\-\(\)\.\,\']{2,}?)\s*[-–]\s+(.+)', stripped)
        if normal_match and not stripped.startswith('*'):
            # 이전 용어 저장
            if in_definition and current_term:
                def_text = ' '.join(current_def_lines).strip()
                def_text = re.sub(r'\s+', ' ', def_text)
                terms.append((current_term, def_text))
            
            term_text = normal_match.group(1).strip()
            # "AAR-" 같이 대시로 끝나는 크로스레퍼런스 전용 용어는 제외
            if not term_text.endswith('-') and len(term_text) > 1:
                current_term = term_text
                def_part = normal_match.group(2).strip()
                current_def_lines = [def_part]
                in_definition = True
                continue
        
        # 정의 계속
        if in_definition and current_term:
            # 숫자 리스트 라인 (1., 2., etc)
            if re.match(r'^\d+\.', stripped):
                current_def_lines.append('\n' + stripped)
            else:
                current_def_lines.append(stripped)
    
    # 마지막 용어 저장
    if in_definition and current_term:
        def_text = ' '.join(current_def_lines).strip()
        def_text = re.sub(r'\s+', ' ', def_text)
        terms.append((current_term, def_text))
    
    return terms


def main():
    print("=" * 60)
    print("Pilot/Controller Glossary Crawler")
    print("=" * 60)
    
    all_terms = []
    
    for letter in SECTIONS:
        print(f"\nFetching section {letter}...")
        html = fetch_leaf(letter)
        if not html:
            print(f"  Failed to fetch section {letter}")
            continue
        
        # HTML을 텍스트로 변환 (간단한 태그 제거)
        text = re.sub(r'<[^>]+>', '\n', html)
        text = re.sub(r'\n\s*\n', '\n\n', text)
        
        terms = parse_glossary_text(text, letter)
        print(f"  Found {len(terms)} terms")
        all_terms.extend(terms)
        
        # 첫 3개 샘플 출력
        for t, d in terms[:3]:
            print(f"    [{t}] -> {d[:60]}...")
    
    # 중복 제거 및 필터링
    seen = set()
    unique_terms = []
    # 제외할 용어들 (사이트 네비게이션 등)
    exclude_terms = {'FAR/AIM', 'Shop', 'Company', 'My Account', 'bold italics',
                     'PURPOSE', 'EXPLANATION OF CHANGES', 'PILOT/CONTROLLER GLOSSARY PURPOSE'}
    
    for term, def_text in all_terms:
        if term in exclude_terms:
            continue
        if term not in seen:
            seen.add(term)
            unique_terms.append((term, def_text))
    
    print(f"\n{'=' * 60}")
    print(f"Total unique terms: {len(unique_terms)}")
    
    # CSV 저장
    output_path = "/Users/sunghyunkim/Documents/E6B/dict/pilot_controller_glossary.csv"
    with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['Term', 'Definition'])
        for term, def_text in unique_terms:
            writer.writerow([term, def_text])
    
    print(f"CSV saved to: {output_path}")
    
    # 알파벳별 통계
    from collections import Counter
    letter_counts = Counter()
    for term, _ in unique_terms:
        if term and term[0].isalpha():
            letter_counts[term[0].upper()] += 1
    
    print("\nSection statistics:")
    for letter in SECTIONS:
        count = letter_counts.get(letter, 0)
        bar = '#' * (count // 5)
        print(f"  {letter}: {count:3d} {bar}")


if __name__ == "__main__":
    main()
