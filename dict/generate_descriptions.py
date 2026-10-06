#!/usr/bin/env python3
"""
dictionary.ts AI 설명 생성기 - 규칙 기반 + 패턴 매칭으로 description 생성
NOTAM, AIP, DOC8400 등 카테고리별 설명을 자동 생성
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
    shutil.copy2(TS_PATH, TS_PATH + ".bak4")
    json_output = json.dumps(entries, indent=2, ensure_ascii=False)
    new_content = content[:json_start] + json_output + content[json_end:]
    with open(TS_PATH, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Saved to {TS_PATH}")


def has_korean(text):
    return bool(re.search(r'[\uac00-\ud7af]', text))


def needs_improvement(entry):
    """설명 보강이 필요한지 판단"""
    desc = entry.get('description', '')
    cat = entry.get('category', '')
    
    # P/C Glossary는 이미 FAA 원문이므로 길면 스킵
    if cat == "P/C Glossary" and len(desc) >= 40:
        return False
    
    # NOTAM은 설명이 20자 이상이면 스킵
    if cat == "NOTAM" and len(desc) >= 25:
        return False
    
    # 충분히 긴 영어 설명은 스킵
    if len(desc) >= 80 and not has_korean(desc) and desc.count(' ') >= 8:
        return False
    
    # 한글만 있거나 너무 짧으면 보강
    return True


def generate_description(entry):
    """항목에 대한 설명 자동 생성"""
    term = entry.get('term', '')
    full_name = entry.get('fullName', '') or ''
    category = entry.get('category', '')
    old_desc = entry.get('description', '')
    
    # 이미 양호한 영어 설명이면 유지
    if len(old_desc) >= 50 and not has_korean(old_desc):
        return old_desc
    
    # fullName이 있고 한글 설명인 경우
    if full_name and full_name != term and has_korean(old_desc):
        return full_name  # fullName을 description으로 사용
    
    # fullName이 유용한 경우
    if full_name and full_name != term and len(full_name) > len(term) + 3:
        # fullName이 이미 좋은 설명 형태인 경우
        if len(full_name) >= 15:
            return full_name[0].upper() + full_name[1:] if full_name[0].islower() else full_name
    
    # NOTAM 코드: fullName이 이미 설명 역할을 하는 경우
    if category == "NOTAM" and full_name:
        return full_name
    
    # 카테고리별 기본 설명 생성
    desc_map = {
        # AIP 용어
        "A-CDM": "Airport Collaborative Decision Making - A process for sharing real-time operational information among airport stakeholders to improve efficiency and punctuality.",
        "AFP": "Airspace Flow Program - A traffic management program that controls the flow of air traffic through specific airspace sectors.",
        "CLDT": "Calculated Landing Time - The estimated time an aircraft will land, calculated by traffic management systems.",
        "COBT": "Calculated Off-Block Time - The estimated time an aircraft will depart from its parking position.",
        "CTO": "Calculated Time Over - The estimated time an aircraft will cross a specific waypoint or fix.",
        "CTOT": "Calculated Take-Off Time - The time assigned by air traffic control that an aircraft is expected to depart.",
        "D": "Downward tendency - Indicates that RVR (Runway Visual Range) values have been decreasing during the previous 10 minutes.",
        "ELDT": "Estimated Landing Time - The predicted time an aircraft will land at its destination.",
        "ETOT": "Estimated Take-Off Time - The predicted time an aircraft will depart from the runway.",
        "FDR": "Flight Data Recorder - An electronic device that records flight data for accident investigation purposes.",
        "GRID": "Gridded meteorological data - Weather information processed and presented in grid point format for aviation use.",
        "IC": "Ice Crystals - Very small ice crystals in suspension, also known as diamond dust.",
        "KST": "Korean Standard Time - The standard time zone used in South Korea (UTC+9).",
        "LSQ": "Line Squall - A squall line or line of active thunderstorms along a cold front.",
        "MINT": "Minutes In Trail - A spacing requirement expressed in minutes between successive aircraft.",
        "MIT": "Miles In Trail - A spacing requirement expressed in nautical miles between successive aircraft.",
        "OTLK": "Outlook - Used in SIGMET messages to describe forecast volcanic ash or other significant weather phenomena.",
        "RX": "Receiver - A device that receives radio signals for communication or navigation purposes.",
        "U": "Upward tendency - Indicates that RVR (Runway Visual Range) values have been increasing during the previous 10 minutes.",
        "ACDM": "Airport Collaborative Decision Making - A system where airport stakeholders share real-time operational data to optimize aircraft turnaround and reduce delays.",
        "DCL": "Departure Clearance - A digital data link service that delivers departure clearances to aircraft via text instead of voice communication.",
        "ADP": "ATFM Daily Plan - The daily plan developed for Air Traffic Flow Management to balance capacity and demand.",
        "CDM": "Collaborative Decision Making Meeting - A meeting where aviation stakeholders coordinate to optimize air traffic flow management.",
        
        # AIP/KMA
        "A": "Amber - The color amber used in aviation light signals and status indications.",
        "ARFOR": "Area Forecast - An aviation weather forecast covering a specific geographic area in aeronautical meteorological code.",
        "B": "Blue - The color blue used in aviation light signals and status indications.",
        "C": "Degrees Celsius (Centigrade) - The metric temperature scale used in aviation for temperature reporting.",
        "CIT": "Near or over large town - Indicates a position or weather phenomenon occurring near or above a populated area.",
        "DENEB": "Fog dispersal operations - Designation for operations involving fog dispersal systems at airports.",
        "E": "East or eastern longitude - Direction or coordinate reference in aviation navigation.",
        "ER": "Here or herewith - Used in aviation messages to indicate the current location or accompanying information.",
        "F": "Fixed - A term indicating a fixed setting, position, or configuration in aviation operations.",
        "G": "Green - The color green used in aviation light signals, status indications, and approach lighting.",
        "L": "Locator - A low-power radio beacon used for navigation, or Left as a runway designation.",
        "LTT": "Landing Teletypewriter - A teletypewriter circuit used for landing-related communications.",
        "MAS": "Manual Al Simplex - A manual simplex communication mode for aviation operational messages.",
        "N": "North or northern latitude - Direction or coordinate reference in aviation navigation.",
        "PE": "Ice Pellets - A form of precipitation consisting of small translucent ice particles.",
        "R": "Red - The color red used in aviation light signals, or Restricted area designation.",
        "RAFC": "Regional Area Forecast Centre - A facility that prepares and disseminates area forecasts for aviation.",
        "RITE": "Right - Indicates a right turn or right direction in aviation instructions.",
        "ROFOR": "Route Forecast - An aviation weather forecast for a specific flight route in meteorological code.",
        "S": "South or southern latitude - Direction or coordinate reference in aviation navigation.",
        "SAP": "As Soon As Possible - A term used in aviation communications to indicate urgency.",
        "SIGWX": "Significant Weather - Weather phenomena that are significant to aviation operations.",
        "SKC": "Sky Clear - A weather code indicating no cloud cover is present.",
        "T": "Temperature - The ambient air temperature at a given location.",
        "TEND": "Trend Forecast - A forecast indicating the expected trend of weather conditions.",
        "TIP": "Until past (place) - Used in navigation to indicate a route instruction until passing a specific point.",
        "TWYL": "Taxiway-Link - A connector between taxiways or between a taxiway and an apron.",
        "W": "West or western longitude - Direction or coordinate reference in aviation navigation.",
        "WAC": "World Aeronautical Chart - An ICAO standard chart at 1:1,000,000 scale for visual navigation.",
        "WINTEM": "Forecast upper wind and temperature - Aviation forecast for winds and temperatures at various flight levels.",
        "X": "Cross - Indicates crossing or transverse direction in aviation navigation.",
        "Y": "Yellow - The color yellow used in aviation light signals and markings.",
        "AMSS": "Aeronautical Mobile Satellite Service - Satellite-based communication service for aircraft.",
        "ANC": "Aeronautical Chart 1:500,000 - A sectional aeronautical chart at 1:500,000 scale.",
        "ANCS": "Aeronautical Navigation Chart - Small Scale - A small-scale chart for long-range navigation.",
        "AT": "At - Used in weather forecasts to indicate the time at which a weather change is expected.",
        "BLDU": "Blowing Dust - Dust raised by wind to reduce visibility, coded in aviation weather reports.",
        "ENRC": "Enroute Chart - An aeronautical chart designed for enroute navigation.",
        "GMC": "Ground Movement Chart - An aeronautical chart showing taxiways and aprons for ground operations.",
        "TX": "Transmitter - A device that transmits radio signals for communication or navigation.",
        "VC": "Vicinity of the aerodrome - Indicates weather phenomena occurring near but not at the airport.",
        
        # AIP/KMA/DOC8400
        "AOC": "Aerodrome Obstacle Chart - A chart depicting obstacles in the vicinity of an aerodrome.",
        "ATP": "At (time or place) - Used in aviation communications and documentation.",
        "ESE": "East South East - An intercardinal direction used in navigation.",
        "IAC": "Instrument Approach Chart - A chart depicting instrument approach procedures.",
        "TO": "To (place) - Used in navigation and flight planning to indicate destination.",
        "VAC": "Visual Approach Chart - A chart depicting visual approach procedures.",
        
        # DOC8400
        "BL": "Blowing - A prefix used in aviation weather codes for blowing phenomena.",
        "EQN": "Equatorial Latitudes Northern - Geographic reference for equatorial regions in the northern hemisphere.",
        "EQS": "Equatorial Latitudes Southern - Geographic reference for equatorial regions in the southern hemisphere.",
        "EUR": "European Regional OPMET Data - Meteorological data exchange for the European region.",
        "HNH": "High Latitudes Northern Hemisphere - Geographic reference for high-latitude regions in the northern hemisphere.",
        "HSH": "High Latitudes Southern Hemisphere - Geographic reference for high-latitude regions in the southern hemisphere.",
        "MNH": "Middle Latitudes Northern Hemisphere - Geographic reference for mid-latitude regions in the northern hemisphere.",
        "MSH": "Middle Latitudes Southern Hemisphere - Geographic reference for mid-latitude regions in the southern hemisphere.",
        "PATC": "Precision Approach Terrain Chart - A chart showing terrain for precision approach procedures.",
        "REPORT": "Local Routine Meteorological Report - A standard meteorological report format.",
        "SWX": "Space Weather - Solar and geomagnetic activity that can affect aviation communications and navigation.",
        "SWXC": "Space Weather Centre - A facility that monitors and forecasts space weather conditions.",
        "TCAS": "Traffic Alert and Collision Avoidance System - An aircraft system that monitors airspace for collision threats.",
        "TL": "Till - Used in weather forecasts to indicate the end time of a weather phenomenon.",
        "TN": "Minimum Temperature - The forecast minimum temperature in aviation weather reports.",
        "VOL": "Volume - Used to reference document volumes in aviation publications.",
        "VV": "Vertical Visibility - Vertical visibility in aviation weather reports, measured in feet.",
        
        # KMA
        "AMR": "At Sea - Indicates a location or phenomenon over the sea or ocean.",
        "AR": "End of Transmission - A Morse code prosign indicating the end of a transmission.",
        "AVASIS": "Abbreviated Visual Approach Slope Indicator System - A simplified version of VASIS for approach guidance.",
        "BLSN": "Blowing Snow - Snow raised by wind to reduce visibility.",
        "BT": "Separation Signal - The Morse code prosign indicating separation between messages.",
        "DRSN": "Low Drifting Snow - Snow raised less than 2 meters above ground by wind.",
        "ENRT": "Enroute - During the enroute phase of flight, between departure and arrival.",
        "INDB": "Inbound - Flying toward a specific point, fix, or airport.",
        "INTER": "Intermittent - Occurring at irregular intervals; used in weather descriptions.",
        "LB": "Pounds - A unit of weight measurement used in aviation for fuel and payload.",
        "LLZ": "Localizer - The lateral guidance component of the Instrument Landing System (ILS).",
        "M": "Mach Number - The ratio of true airspeed to the speed of sound.",
        "MB": "Millibars - A unit of atmospheric pressure measurement used in aviation.",
        "MPH": "Statute Miles Per Hour - A unit of speed measurement.",
        "NEH": "Connected to requested station - Communication status indicator.",
        "OCL": "Obstacle Clearance Limit - The minimum altitude required to clear obstacles during approach.",
        "QBI": "Compulsory IFR flight rules - Airspace where IFR flight is mandatory.",
        "RAPID": "Rapid or rapidly - Describes quickly changing weather conditions.",
        "RASH": "Rain Showers - Precipitation consisting of intermittent rain from convective clouds.",
        "RASN": "Rain and Snow - Mixed precipitation type.",
        "SNSH": "Snow Showers - Intermittent snow precipitation from convective clouds.",
        "TAANS": "Transmits or Transmitter - A device or action for sending radio signals.",
        "TRLVL": "Transition Level - The altitude at which aircraft change from local pressure to standard pressure setting.",
        "TSGR": "Thunderstorm with Hail - A thunderstorm producing hail.",
        "YD": "Yard - A unit of distance measurement.",
        "SH": "Shower - Intermittent precipitation from convective clouds, followed by precipitation type.",
    }
    
    # 직접 매핑된 설명이 있으면 사용
    if term in desc_map:
        return desc_map[term]
    
    # NOTAM 코드 설명 (fullName 기반)
    if category == "NOTAM" and full_name:
        # fullName이 이미 적절한 설명이면 그대로 사용
        return full_name
    
    # PilotController: term이 한 단어인 경우 기본 설명
    if category == "PilotController":
        return f"{term} - A term defined in the FAA Pilot/Controller Glossary."
    
    # DOC8400: 기본 설명
    if category == "DOC8400" and full_name:
        return full_name
    
    # AIP: 기본 설명
    if category == "AIP" and full_name and len(full_name) > 3:
        return full_name
    
    # KMA: 한글 설명을 영어로
    if category in ("KMA", "AIP/KMA") and full_name and len(full_name) > 3:
        return full_name
    
    # 나머지는 fullName이나 기존 설명 유지
    if full_name and len(full_name) > 3:
        return full_name
    if old_desc and not has_korean(old_desc) and len(old_desc) >= 5:
        return old_desc
    
    return f"{term} - Aviation term."


def main():
    print("=" * 60)
    print("Dictionary.ts Description Generator")
    print("=" * 60)
    
    result = read_ts_entries()
    if result is None or result[0] is None:
        return
    entries, content, json_start, json_end = result
    
    print(f"Total entries: {len(entries)}")
    
    # 각 카테고리별 통계
    from collections import Counter
    cat_stats = Counter()
    
    improved = 0
    skipped = 0
    
    for entry in entries:
        cat = entry.get('category', '')
        cat_stats[cat] += 1
        
        if needs_improvement(entry):
            old_desc = entry.get('description', '')
            new_desc = generate_description(entry)
            
            if new_desc != old_desc:
                entry['description'] = new_desc
                improved += 1
                
                if improved <= 20:
                    term = entry.get('term', '')
                    print(f"  [{term}] ({cat})")
                    print(f"    Old: {old_desc[:50]}")
                    print(f"    New: {new_desc[:50]}")
        else:
            skipped += 1
    
    print(f"\n{'=' * 60}")
    print(f"Improved: {improved}")
    print(f"Skipped (already good): {skipped}")
    
    # 저장
    write_ts(entries, content, json_start, json_end)
    
    print(f"\nCategory breakdown:")
    for cat, count in sorted(cat_stats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
