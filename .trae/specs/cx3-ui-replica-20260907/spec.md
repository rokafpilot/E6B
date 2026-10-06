# ASA CX-3 1:1 UI & Function Replica - Product Requirements Document

## Overview
- **Summary**: 기존 React+TypeScript+Vite E6B 앱의 UI/UX를 ASA CX-3 Electronic E6-B Flight Computer 실제 기기와 1:1로 동일하게 재구축. 상단 Status Bar + 가상 Color LCD 화면 + 하단 35키 물리 키패드를 픽셀 퍼펙트로 구현하고, 매뉴얼에 정의된 메뉴 순서, 라인 아이콘(4종), 약어, SET UNIT / CONV UNIT 의미론, PLAN 글로벌 파란 ● 아이콘 등 모든 인터랙션을 CX-3 매뉴얼대로 재현. 계산 코어(`src/lib/flightCalc.ts`)는 기존 22/22 유닛 테스트를 유지하며 재사용.
- **Purpose**: 조종사가 실제 ASA CX-3 기기와 완전히 동일한 조작 감각과 화면 레이아웃으로 훈련하고 실사용할 수 있도록 하기 위함. 기존 카드형 터치 UI는 ASA CX-3와 전혀 달라 조종사에게 혼선을 주므로 실제 기기 오퍼레이션과 100% 동일한 UX를 확보.
- **Target Users**: FAA/CAA 시험 준비 조종사, 실제 비행 계획 수행 조종사, CX-3 기기 소유자 (안드로이드 모바일 + 웹 브라우저).

## Goals
- ASA CX-3 기기의 Status Bar(E6-B/시간/BATT) + LCD 메뉴 화면 + 35키 물리 키패드를 1:1 시각적 재현
- CX-3 매뉴얼 12장 FLT 15종 기능을 메뉴 순서·약어·라인 아이콘까지 완벽히 매칭
- SET UNIT / CONV UNIT 키 의미론(단위 선택 vs 값 환산) 12카테고리 38단위 완벽 지원
- PLAN Leg 1..N 구조 + 파란 ● 글로벌 반복값 + Total Trip 집계(거리/ETE/ETA/연료) 구현
- SET Preferences: Theme 3종 + 백라이팅 4레벨 + Time Set + Default Units + Favorite + Aircraft Profile + User Data + Version 8메뉴 구현
- 22/22 유닛 테스트 통과 유지 + 웹 빌드 exit 0 + 안드로이드 Debug APK 5MB 이하 생성

## Non-Goals
- 실제 CX-3 하드웨어 칩셋 펌웨어 에뮬레이션 (소프트웨어 UX/UI 한정)
- USB micro-B를 통한 data.cx3 백업/리스토어 기능 (로컬 localStorage로 영속화하는 것으로 대체)
- 배터리 소모 실제 측정 (가상 BATT 4칸 아이콘으로 시뮬레이션)
- iOS 빌드 (이번 단계는 Android APK + PWA 웹만 지원)
- 음성 입력 / 터치 제스처 스와이프 (▲▼ 키 + 35키 패드 클릭으로 제한)

## Background & Context
- 사용자 피드백(VERBATIM 2026-09-07): "interface가 전혀 ASA CX-3와 다른데, https://www.youtube.com/shorts/rcDRgQUQQ3Q 이걸 참고해서 똑같은 interface로 만들어줘 /Users/sunghyunkim/Documents/E6B/CX-3_Manual.pdf 이게 매뉴얼이야 이거 보고 기능도 똑같이 만들어야 해"
- 유튜브 실사용 스크린샷 검증 완료: 검은 LCD 바탕 → 상단 좌측 `E6-B` 흰굵은글씨 / 중앙 `20:25Z` 시각 / 우측 `BATT` 4칸 아이콘 → FLT 수직 메뉴 리스트 (Unit Conversions 주황 하이라이트 → Altitude / Cloud Base / Standard Atmosphere / Airspeed / Fuel / Ground Speed 흰굵은글씨 → 각 라인마다 가는 회색 가로구분선) → 하단 좌측 ASA 날개 로고 + `CX-3 FLIGHT COMPUTER` 소문자 레전설
- `CX-3_Manual.txt` 1282라인 전문 검토 완료: Keypad 35키 배열(p2), Screen Overview/Line Icons/배터리(p3), SET Preferences 8항목(p4-5), Menu System(p6), FLT(p7-12), PLAN(p13-14), TIMER(p15), CALC(p15), W/B(p16-17), 약어 Appendix D(p21) 전부 추출 완료
- 기존 구현 아카이브: 하단 5탭 Material 카드형 UI는 완전히 폐기하고, 계산 코어 flightCalc.ts 22/22 통과 로직만 그대로 재사용. 입력상태 string blank 관리 패턴은 계속 유지.

## Functional Requirements
- **FR-1: 디바이스 프레임 & Status Bar**: 상단 3구역 Status Bar (좌:현재메뉴 E6-B/PLAN/TIMER/CALC/W/B, 중:시계 HH:MM[:SS][Z], 우:BATT 4칸 레벨 + 25% 이하 빨강) + 하단 푸터 (ASA 날개로고 + CX-3 FLIGHT COMPUTER 텍스트)
- **FR-2: LCD 디스플레이 & 라인 아이콘 4종**: 라인 좌측 아이콘 (① 녹색✓ = 사용자 입력, ② 녹색= = 계산출력, ③ 주황? = 미입력 → 우측값 `--`, ④ 파란● = PLAN 글로벌 반복값) + 현재 커서 주황색 백라이트 하이라이트 + 하단 반가림 표시
- **FR-3: 35키 물리 키패드**: 5열 배치 (FLT/PLAN/TIMER/CALC/W/B 상단행 → ▲▼ → Orange POWER → ★FAV → BACK → SET → M → SET UNIT → CONV UNIT → 0-9 → : → +- → . → ÷×-+ → C → BKSP → √ → =) 모든 키 클릭이벤트 정상 동작
- **FR-4: FLT 메뉴 15종 수직 네비게이션**: Unit Conversions → Altitude → Cloud Base → Standard Atmosphere → Airspeed(5모드: Planned TAS/Actual TAS/Required CAS/Planned MACH/Actual MACH) → Fuel(4모드: Burn/Rate/Endurance/GS) → Ground Speed → Glide → Climb & Descent → Wind Component → ETA → To-From → Compass Heading → Wind Correction → Rhumb Line → Holding Pattern 순서, ▲▼키 스크롤 후 POWER=ENTER 선택
- **FR-5: SET UNIT / CONV UNIT**: SET UNIT=현재 커서 라인의 단위를 12카테고리(Distance/Speed/Duration/Temperature/Pressure/Volume/Rate/Weight/RoC/AoC/Torque/Angle) 38단위 내에서 순회(값 유지, 단위만 변경) / CONV UNIT=현재 라인의 값을 다음 단위 수치로 즉시 환산(값+단위 모두 변경), Altimeter Baro는 inHg ↔ hPa 자동 연동
- **FR-6: PLAN (Trip Functions)**: Leg 1..N CRUD (각 Leg: Dist/TCrs/TAS/WDir/WSpd/Var/Dev/FuelRate/DepTime → 출력: THdg/GS/WCA/ETE/Fuel/ETA Arrival) → Total Trip 집계 (Total Dist/Total ETE/Overall ETA/Total Fuel) + 파란 ● 아이콘으로 Leg 간 반복 글로벌값(TAS/Var/Dev/FuelRate 등) 표시
- **FR-7: W/B 4종**: Weight & Balance (RF + Items 8개 + Totals Wt/Mom/CG) → Weight Shift Formula (Total Wt/ΔCG/ΔArm → Item Wt) → %MAC (CG/MAC/LMAC → %MAC) → Holding Pattern (Turn Dir/Heading/Radial → Entry Dir + Inbound Hdg)
- **FR-8: TIMER**: Stopwatch (Start/Stop/Reset, 0~99:59:59 카운트 업) + Count Down (사용자 설정값 → 0 도달 시 빨강 폰트 + 마이너스 표시, AudioContext beep 선택)
- **FR-9: CALC**: 4칙연산 + √ + 부호반전 + C전체클리어 + BKSP 1자삭제 + HH:MM:SS 시간 산술 지원 (CONV UNIT으로 10진↔시간 변환), 최대 8자리 소수점
- **FR-10: SET Preferences 8메뉴**: Theme(Standard/Night/Daylight) → Backlighting(4레벨 Normal/Daylight/Dusk/Night) → Time Set(UTC/Local/Dest TZ + 24h) → Default Units(US / Metric) → Favorite(FAV 키로 바로가기 1개 저장) → Aircraft Profile(K factor/Empty Wt+BEM/FuelType/Pax Arms/Cargo Arms 3Custom) → User Data(Save/Recall/Cancel) → Version(표시)
- **FR-11: BACK 키 & 메뉴 Depth**: BACK = 직전 메뉴로 복귀, FLT PLAN TIMER CALC W/B 키 = 언제든 해당 루트 메뉴로 즉시 이동, 최대 2키 스트로크로 모든 함수 접근
- **FR-12: Chain Calculations**: 직전 함수의 출력값을 다음 함수의 입력으로 자동 제안 (예: Altitude에서 계산된 PAlt → Airspeed의 PAlt 라인에 녹색= 프리필)

## Non-Functional Requirements
- **NFR-1: 시각적 동일성**: 유튜브 스크린샷 rcDRgQUQQ3Q + CX-3 매뉴얼 스크린샷과 비교 시 숙련 CX-3 사용자가 1초만에 구분 불가능한 수준의 픽셀 레벨 동일성 (색상 팔레트 · 폰트 비율 · 여백 · 아이콘 위치)
- **NFR-2: 키 반응속도**: 35개 키 모두 클릭 → LCD 반영 ≤ 50ms, Android 7.0 (minSdk 24) 이상에서 60fps 유지
- **NFR-3: 계산 정확도**: 기존 22개 유닛 테스트 100% 통과 유지, 신규로 AC-15 Airspeed 5모드 / PLAN Leg / Holding / SET UNIT 환산까지 포함해 10-4 단위 정확도
- **NFR-4: 영속성**: SET Preferences, Aircraft Profile, PLAN 레그, Favorite, 입력 상태 전부 localStorage에 저장, 앱 재시작 시 마지막 사용 메뉴 복귀
- **NFR-5: 빌드 품질**: `npm run build` tsc+vite exit 0, vitest 100% pass, `npm run android:build` BUILD SUCCESSFUL, APK ≤ 5MB

## Constraints
- **Technical**:
  - 계산 코어 `src/lib/flightCalc.ts`는 순수함수 유지, React 의존 주입 금지 (기존 22/22 테스트 깨지지 않아야 함)
  - React 18 + TypeScript strict 모드 유지, 입력 상태는 `string | ''` blank 관리 (선행 0 입력 방지 UX 유지)
  - Android 빌드: Gradle 8.13+ / JDK 21 Temurin / minSdk 24 / targetSdk 36 / AGP 8.13 호환
- **Business**:
  - ASA 상표/디자인 공정사용(Fair Use): 교육용 비영리 조종사 훈련 목적, CX-3 FLIGHT COMPUTER 레이블은 기기 표현 목적으로만 렌더링
- **Dependencies**:
  - 기존 의존성 외 추가 라이브러리 금지 (CSS pure variable + React state로만 UI 구현, no UI kit)
  - localStorage만 영속 스토리지 사용, 외부 네트워크 콜 전혀 없음 (오프라인 완전 동작)

## Assumptions
- 조종사는 실제 CX-3 키패드 조작법을 숙지하고 있으므로 온스크린 사용설명서/가이드 툴팁 불필요
- POWER 키: 토글 ON/OFF 대신 앱 내 Enter/Select 키 기능으로 대체 (웹/앱 종료는 브라우저/OS가 담당)
- BATT 아이콘: 디바이스 실제 배터리 대신 100% 고정 표시로 시작 + SET에서 백라이팅 레벨 변경시 레벨 시뮬레이션

## Acceptance Criteria

### AC-1: Status Bar 3구역 렌더링 규칙
- **Type**: `rule`
- **Given**: 앱 최초 로드 시 FLT 메인 메뉴에 진입한 상태
- **When**: LCD 상단 Status Bar를 검사
- **Then**: ① 좌측 `E6-B`(FLT) 혹은 현재 메뉴명(PLAN/TIMER/CALC/W/B)이 흰색 굵은 폰트로 표시 ② 중앙에 시계(24h HH:MM, TZ Zulu면 Z 접미)가 실시간 업데이트 ③ 우측에 BATT 4칸 배터리 아이콘(기본 100% 흰색, ≤25% 레벨이면 빨강)이 표시 ④ Status Bar 하단 전체폭 가는 회색 구분선 1px
- **Pass Condition**: 4가지 요소가 전부 한번에 보이며 시계가 1분마다 tick, BACK 키로 메뉴 이동 시 좌측 메뉴명이 동기화
- **Evidence**: 유튜브 스크린샷 비교 + CX-3 매뉴얼 p3 Screen Overview 일치

### AC-2: LCD 라인 아이콘 4종 Semantics
- **Type**: `rule`
- **Given**: Altitude 함수 진입 상태 (IAlt / Baro / OAT / PAlt / DAlt 5라인 구성)
- **When**: 각 라인의 상태별 아이콘을 확인
- **Then**: ① IAlt 미입력시: 좌측 주황? 아이콘 + 우측 `--` ② IAlt 4500 입력 후 엔터: 좌측 녹색✓ + 값 4500 + 단위 ③ Baro 29.92 + OAT 모두 입력 후: PAlt/DAlt 라인 좌측 녹색= + 계산값 표시 ④ PLAN에서 Leg 2 TAS가 Leg1과 110 KTS로 동일하면 좌측 파란● + 자동 프리필
- **Pass Condition**: 4가지 아이콘 타입이 상태 전이마다 정확히 렌더링, 색상 코드 (녹색 #00ff66 / 주황 #ffaa00 / 파랑 #3399ff / 흰색 #ffffff / 배경 #000000)
- **Evidence**: 매뉴얼 p3 Line Icons 규칙 + 유튜브 FLT 메뉴 실제 색상 매칭

### AC-3: 35키 물리 키패드 배치 & 인터랙션
- **Type**: `rubric`
- **Dimension**: CX-3 기기 실제 키패드와의 시각적·기능적 일치도
- **Scale**: 1-5
- **Anchors**: 1 = 키 20개 미만 구현 / 레이아웃 완전 상이 ; 3 = 키 30개 이상 구현 / 상단 5메뉴키 + 숫자키만 일치 ; 5 = 35개 키 100% 동일 배치(FLT PLAN TIMER CALC W/B ▲▼ POWER ★ BACK SET M SETUNIT CONVUNIT 0-9 : +- . ÷×-+ C BKSP √ =) / Orange POWER 키 색상 / 키캡 그라디언트 / 눌림 feedback까지 일치
- **Pass Threshold**: >= 4
- **Evidence**: 매뉴얼 p2 KEYPAD 다이어그램 겹쳐 비교시 위치 오차 2px 이내

### AC-4: FLT 메뉴 15종 순서 & 네비게이션
- **Type**: `rule`
- **Given**: FLT 키를 눌러 FLT 메인 메뉴 진입
- **When**: ▼ 키를 15회 연속 입력
- **Then**: 하이라이트(주황색)가 Unit Conversions → Altitude → Cloud Base → Standard Atmosphere → Airspeed → Fuel → Ground Speed → Glide → Climb & Descent → Wind Component → ETA → To-From → Compass Heading → Wind Correction → Rhumb Line → Holding Pattern 순서로 정확히 이동, 범위 초과시 순환하지 않고 첫/끝에서 정지, 하단 마지막 라인 절반 가림 표시 활성화
- **Pass Condition**: 15개 메뉴 순서 100% 일치 + 하이라이트 색상 주황 + 가로구분선 1px 회색
- **Evidence**: 매뉴얼 p7 FLT 목차 + 유튜브 스크린샷 FLT 메뉴 순서 교차 검증

### AC-5: Altitude 함수 (IAlt/Baro/OAT → PAlt/DAlt)
- **Type**: `rule`
- **Given**: Altitude 함수 진입 (5라인: IAlt / Baro / OAT / PAlt / DAlt)
- **When**: 매뉴얼 p8 샘플문제: IAlt=5900 FT / Baro=29.75 IN HG / OAT=75 °F
- **Then**: PAlt = 6059 FT (녹색=) + DAlt = 8427 FT (녹색=) 정확히 ±1 허용오차 내 일치
- **Pass Condition**: 숫자값 + 라인아이콘 + 단위(FT / IN HG / °F) 전부 일치
- **Evidence**: flightCalc.calculateAltitude() 유닛테스트 + 매뉴얼 p8 Worked Example

### AC-6: Airspeed 5가지 모드 (PlannedTAS / ActualTAS / ReqCAS / PlannedMACH / ActualMACH)
- **Type**: `rule`
- **Given**: Airspeed 서브메뉴 진입 (▼로 5모드 순차 접근 가능)
- **When**: Planned TAS 모드 → CAS=125 KTS / OAT=23 °F / PAlt=8500 FT 입력
- **Then**: TAS=141.03 KTS, TAT=28 °F, MACH=0.221 전부 매뉴얼 p9 샘플과 ±0.1 단위 일치, Actual TAS(166.64 MPH @ 6500ft), ReqCAS(135.58 KTS), Planned/Actual MACH 샘플 4가지도 1회차 통과
- **Pass Condition**: 5모드별 계산값 + 약어(CAS TAS OAT PAlt MACH TAT) + 단위 전부 Appendix D와 동일
- **Evidence**: 매뉴얼 p9-10 Airspeed worked examples × 5회

### AC-7: Fuel 4가지 모드 (Burn/Rate/Endurance/GS)
- **Type**: `rule`
- **Given**: Fuel 서브메뉴 진입
- **When**: Fuel Burn: Dur=1:14:38 HMS / Rate=9.5 US GPH → Vol=11.82 US GAL ; Fuel Rate: Dur=2:30:00 HMS / Wt=9500 LBS → Rate=3800 LBS/HR ; Endurance: Vol=38 US GAL / Rate=9.5 US GPH → Dur=3:59:59 HMS ; GS: Dist=5 NM / Dur=00:02:32 HMS → 118.42 KTS
- **Then**: 4가지 샘플 결과 전부 매뉴얼 p10-11과 ±0.1 단위 일치, 시간 HMS 포맷은 콜론 구분자 : 키로 입력 가능
- **Pass Condition**: 4가지 모드 계산값 + 약어(Vol Dur Rate Wt Dist GS) 모두 일치
- **Evidence**: 매뉴얼 p10-11 Fuel worked examples × 4회

### AC-8: SET UNIT vs CONV UNIT 의미론
- **Type**: `rule`
- **Given**: Unit Conversions 함수에서 Spd 라인 = 200 KTS
- **When**: ① SET UNIT 1회 누를 때 → ② CONV UNIT 1회 누를 때
- **Then**: ① SET UNIT: 값 200 유지, 단위만 KTS → KPH (또는 카테고리 다음 단위)로 순회 ② CONV UNIT: 단위 KTS → KPH로 바뀌면서 값이 370.4 KPH로 환산됨, Altitude의 Baro 라인은 SET UNIT으로 inHg↔hPa 토글시 값 자동 환산 (29.92 IN HG ↔ 1013.25 HPA)
- **Pass Condition**: SET=단위순회(값 유지) / CONV=값환산 분리가 명확, 12카테고리 38단위 정상 순회
- **Evidence**: 매뉴얼 p7 Unit Conversions 12가지 worked example 100% 통과

### AC-9: PLAN Leg 1..N + 파란 ● 글로벌 + Total Trip
- **Type**: `rule`
- **Given**: PLAN 메인 메뉴 → Leg 1 추가 선택 (KRNT→S18→W04→KRNT 3 Leg 샘플 매뉴얼 p13-14)
- **When**: Leg 1 입력: Dist=92.3 NM / TCrs=288° / TAS=110 KTS / WDir=350° / WSpd=3 KTS / Var=-17° / Dev=0° / FuelRate=9.5 US GPH / Dep=12:00:00 UTC → BACK → Leg 2: Dist=57.3 / TCrs=170 / WDir=200 / WSpd=6 (TAS/Var/Dev/FuelRate 파란● 자동승계) → Leg 3: Dist=84.2 / TCrs=069 / WDir=140 / WSpd=5
- **Then**: Total Trip = Dist 233.8 NM / ETE 2:10:29 HMS / ETA 14:10:29 UTC / Fuel 20.66 US GAL (매뉴얼 p14와 ±0.5% 오차 이내), Leg 2/3의 TAS/Var/Dev/FuelRate 라인 좌측에 파란 ● 아이콘 표시
- **Pass Condition**: 3 Leg 각각의 TH/GS/WCA + Total 집계 4가지 지표 + 파란● 아이콘 전부 일치
- **Evidence**: 매뉴얼 p13-14 PLAN worked example cross country 3-legs full sample

### AC-10: W/B 4가지 서브 메뉴
- **Type**: `rule`
- **Given**: W/B 키 입력 → 4가지 서브메뉴 순차 검사
- **When**: ① W&B RF=1, Item1(1495 LBS / 151593 LB-IN → Arm 101.40), Item2(380 / 64 → Mom 24320), Item3(150 / 75 → Mom 11250), Item4(180 / 96 → Mom 17280) → Totals Wt=2205 LBS / Mom=204443.00 LB-IN / CG=92.72 IN ② Weight Shift: Total Wt=7500 / ΔCG=1 / ΔArm=120 → Item Wt=62.5 LBS ③ %MAC: MAC=180.7 / CG=910.2 / LMAC=860.2 → 27.7 % ④ Holding: Turn=Right / Hdg=155° / Radial=270° → Entry=Direct / Inbound=90°
- **Then**: 4가지 서브메뉴 전부 매뉴얼 p16-17 worked example과 100% 일치, Item은 최대 8개까지 Add/Remove 가능
- **Pass Condition**: 4가지 샘플 계산값 + 약어(RF Wt Arm Mom CG %MAC Entry Inbound) 전부 일치
- **Evidence**: 매뉴얼 p16-17 W/B worked examples × 4회

### AC-11: TIMER Stopwatch + CountDown
- **Type**: `rule`
- **Given**: TIMER 키 진입 → Stopwatch와 Count Down 토글
- **When**: Stopwatch Start → 3초 경과 후 Stop → Reset → Count Down 00:02:30 설정 → Start → 00:00:00 도달
- **Then**: ① Stopwatch 00:00:00 → Start → 초단위 증가 ② Count Down 02:30 → Start → 00:00:00에서 마이너스 표시(-00:00:01부터) + 폰트색 빨강으로 전환 ③ Start/Stop/Reset 3가지 서브라인 ▲▼로 선택 후 Enter 동작
- **Pass Condition**: 시간 정밀도 ±1s, 0 이하 카운트 다운시 빨강+마이너스 규칙
- **Evidence**: 매뉴얼 p15 TIMER Stopwatch/CountDown specification

### AC-12: CALC 4칙연산 + √ + 시간연산 HH:MM:SS
- **Type**: `rule`
- **Given**: CALC 키 진입
- **When**: ① 123 + 456 = → 579 → +- → -579 → × 6.5 = → -3763.5 ② √ 144 = → 12 ③ SET UNIT으로 시간모드 진입 → 02:14:17 + 03:15:00 = → 05:29:17 → CONV UNIT → 5.488(decimal hour)
- **Then**: 산술 정확 + 최대 8자리 + 소수점 정밀 + 시간 덧셈 + ↔ 10진환산 정상
- **Pass Condition**: 3가지 샘플 결과 100% 정확
- **Evidence**: 매뉴얼 p15 CALC worked examples × 3

### AC-13: SET Preferences 8메뉴
- **Type**: `rubric`
- **Dimension**: SET 메뉴 완성도
- **Scale**: 1-5
- **Anchors**: 1 = Theme만 존재 ; 3 = Theme/Backlighting/Time Set 3가지 이상 구현 ; 5 = Theme(3종) · Backlighting(4레벨 + 키패드점등 토글) · Time Set(3 TZ + 24h + Z suffix) · Default Units(US/Metric 전역 전환) · Favorite(FAV 키로 특정 함수 핀고정) · Aircraft Profile(K / Empty W&B RF / Fuel AvGas 6lb / Jet 6.84lb / Oil 7.5lb / 3Pax / 2Cargo / 3Custom Arms + Profile Valid On/Off) · User Data(Save/Recall/Cancel localStorage) · Version(firmware 1.3 표시) 8가지 전부 구현 + 저장값 재시작후 유지
- **Pass Threshold**: >= 4
- **Evidence**: 매뉴얼 p4-5 SETTING PREFERENCES 8개 항목 전부 존재 확인

### AC-14: BACK & 5메뉴 핫키 2스트로크 룰
- **Type**: `rule`
- **Given**: PLAN → Leg 3 → Wind Dir 라인에서 값 입력 중인 깊은 Depth
- **When**: ① BACK 1회: 해당 함수 메인 (Leg 3 메인) → BACK 1회: PLAN 메인 메뉴 → BACK 1회: 마지막 FLT 함수 ② FLT 키 1번 누를시: 어디서든 FLT 메인 메뉴로 즉시 점프
- **Then**: BACK 스택 depth가 정확히 3단계, FLT/PLAN/TIMER/CALC/W/B 5키는 언제나 1키로 루트 메뉴 진입하며 최대 2키 스트로크로 임의 함수 접근 가능
- **Pass Condition**: 5키 핫키 점프 + BACK depth 스택 정확
- **Evidence**: 매뉴얼 p6 Menu System "Any CX-3 function can be reached with a maximum of 2 keystrokes"

### AC-15: Chain Calculation 자동 프리필
- **Type**: `rule`
- **Given**: FLT → Altitude에서 IAlt=5000, Baro=30.00 입력 → PAlt=4912 자동 계산
- **When**: BACK → Airspeed → Planned TAS 모드 진입 → PAlt 라인 확인
- **Then**: Airspeed의 PAlt 라인 좌측 아이콘 녹색= + 프리필 값 4912 FT가 자동으로 들어가 있음, CAS/OAT만 추가 입력하면 바로 TAS 계산 가능
- **Pass Condition**: Altitude→Airspeed(PAlt), Airspeed→Wind Correction(TAS), Wind→Plan(TAS/Var/Dev) 체인 3종 전부 동작
- **Evidence**: 매뉴얼 p6 Menu System "chain calculations where the answer to a preceding problem is automatically entered in subsequent problems"

### AC-16: Blank 입력 UX & 선행 0 방지
- **Type**: `rule`
- **Given**: Altitude의 IAlt 라인에 진입 (초기 상태 주황? + --)
- **When**: 가상 키패드 1 → 0 → 1 → 3 순서로 입력
- **Then**: IAlt 값은 `1013` (빈칸 → 1 → 10 → 101 → 1013)으로 표시, 절대 `01013`처럼 선행 0이 붙지 않음, C 키 누르면 다시 blank + -- 복귀, BKSP 1자씩 삭제
- **Pass Condition**: string 상태 유지 + placeholder='--' 미입력 표시 + numOnly/decOnly 정규식 필터
- **Evidence**: 프로젝트 Lessons Learned "useState<number>(0) → useState<string>('') 리팩토링" 규칙 준수

### AC-17: 단위계 Default Units US ↔ Metric 전역 스위치
- **Type**: `rule`
- **Given**: SET → Default Units = Metric 으로 변경 + 저장
- **When**: Altitude / Airspeed / Fuel 함수 진입
- **Then**: Altitude의 단위가 FT → M, Baro IN HG → HPA, Airspeed KTS → KPH, Fuel US GAL → L 로 자동 전환, 기존 입력값은 CONV UNIT과 동일하게 Metric 값으로 환산되어 표시
- **Pass Condition**: 12카테고리 Distance/Speed/Pressure/Volume 4종에 대해 전역 디폴트 전환 동작
- **Evidence**: 매뉴얼 p4 "Default Units: Set the device to default to U.S. or Metric units"

### AC-18: 입력 라인 커서 주황 하이라이트 + 반가림
- **Type**: `rubric`
- **Dimension**: 가상 LCD 가독성 및 정보 계층 구조
- **Scale**: 1-5
- **Anchors**: 1 = 하이라이트 없음 / 3 = 현재 라인 백그라운드만 색상 ; 5 = 현재 커서 라인 전체폭 주황색 15% 투명 하이라이트 + 라인 좌측 4px 주황 vertical bar + 7라인 LCD에서 6라인째 하단이 반으로 잘려 보임(더보기 인디케이터) + 전체 폰트 Monospace 고정폭 + 숫자/단위 우측정렬 / 약어 좌측정렬
- **Pass Threshold**: >= 4
- **Evidence**: 유튜브 스크린샷 LCD 하단 반가림 실제 목격 + 매뉴얼 p3 "The bottom line will be cut in half to show that there are more fields below"

### AC-19: 기존 22/22 유닛 테스트 + 신규 AC별 테스트 통과
- **Type**: `rule`
- **Given**: `npm run test` (vitest) 실행
- **When**: 구현 완료 후 테스트 슈트 실행
- **Then**: ① 기존 22개 유닛 테스트 전부 PASS ② Airspeed 5모드 / Fuel 4모드 / PLAN 3Leg 집계 / Chain Calculation 프리필 / SET UNIT vs CONV UNIT 분리 / W/B RF 포함 신규 테스트 18종 추가하여 전체 40/40 PASS
- **Pass Condition**: vitest exit 0, coverage 계산 로직 95% 이상 유지
- **Evidence**: 기존 `src/lib/flightCalc.test.ts` 22/22 통과 기준 + 신규 spec 기반 TC 추가

### AC-20: 웹 빌드 + 안드로이드 APK 재생산
- **Type**: `rule`
- **Given**: 구현 완료 + 테스트 통과 후
- **When**: `npm run build` → `npm run android:build` 순차 실행
- **Then**: ① Vite 프로덕션 빌드 exit 0, dist/index.html+css+js gzip ≤ 70KB ② Gradle assembleDebug BUILD SUCCESSFUL in ≤ 60s ③ `E6B-CX3-debug.apk` 프로젝트 루트에 복사, 용량 ≤ 5MB, minSdk=24 / targetSdk=36 유효
- **Pass Condition**: 웹+APK 2종 빌드 100% 성공
- **Evidence**: package.json 스크립트 android:build 실행 로그 + apk 파일 ls 용량 체크

### AC-21: Theme 3종 + 백라이팅 4레벨 시각적 충실도
- **Type**: `rubric`
- **Dimension**: 테마 및 백라이팅 구현 정확도
- **Scale**: 1-5
- **Anchors**: 1 = 1종 테마만 존재 ; 3 = Standard(검은바탕 흰글) + Night(검은바탕 녹색+흰) + Daylight(흰바탕 검정글) 3종 존재 ; 5 = 3종 테마 + 백라이팅 4레벨(Normal/Daylight/Dusk/Night → LCD 밝기 100%/120%/60%/30% 그라디언트 + Dusk/Night에서만 키패드 백라이트 점등 on, Normal/Daylight는 키패드 소등)까지 매뉴얼 p4 명세 100% 일치, 자동 3분 키패드 소등 기능
- **Pass Threshold**: >= 4
- **Evidence**: 매뉴얼 p4 Theme + Backlighting 4레벨 스펙과 일치

### AC-22: Aircraft Profile & W/B 연동
- **Type**: `rule`
- **Given**: SET → Aircraft Profile에서 Profile Valid=ON으로 설정 + Empty Aircraft: Wt=1495 LBS / Mom=151593 LB-IN / Fuel Type=AvGas 6 lb/gal / Pax Arm 64 / Cargo Arm 120 저장
- **When**: W/B → Weight & Balance 진입
- **Then**: Item 1은 자동으로 Empty Aircraft 1495 / 101.40이 녹색= 아이콘으로 프리필, Fuel Item 추가시 Vol→Wt 자동 계산(6lb/gal × Gal = Lbs), RF Reduction Factor와 Aircraft Profile이 연동되어 Totals CG 자동 반영
- **Pass Condition**: Profile Valid=ON일때만 프리필 동작 / OFF시 기본값 0, FuelType 3종 AvGas/Jet/Oil lb/gal 상수 정확
- **Evidence**: 매뉴얼 p5 Aircraft Profile specification

## Open Questions
- [ ] HOLDING PATTERN 출력에서 Entry 3종(Direct/Parallel/Teardrop) 한글 약어 vs 영어 원어 표기 — (사용자 확인 필요: 기본 영어 Direct/Parallel/Teardrop 유지)
- [ ] FAVORITE 키 저장 대상: FLT 하위 특정 함수 1개 핀 vs PLAN Leg 특정 레그 — (기본: 가장 최근 실행한 함수로 설정 메뉴에서 변경 가능)
- [ ] AudioContext beep (Count Down 0 도달시): 소리 on/off — (SET → Backlighting Night 레벨에서만 활성화, Default off)
