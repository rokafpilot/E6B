# ASA CX-3 1:1 UI & Function Replica - Implementation Plan

## Task 1: Device Frame + Status Bar + LCD Display Container + Footer Legend
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 전체 앱을 감싸는 CX-3 기기 프레임 렌더 (어두운 회색 플라스틱 질감 border-radius + 그림자)
  - 상단 Status Bar 3구역 (좌:현재메뉴명 / 중:시계 HH:MM[:SS][Z] / 우:BATT 4칸 아이콘)
  - 가상 Color LCD 컨테이너 (검은 배경 #000 + 7라인 고정폭 monospace + 1px 회색 가로구분선)
  - 하단 Footer 레전설: 좌측 ASA 날개 로고(SVG) + 우측 "CX-3 FLIGHT COMPUTER" 소문자 텍스트
  - LCD 7번째 라인 하단 반가림 효과 (overflow-y clip + gradient mask)
- **Acceptance Criteria Addressed**: AC-1, AC-18
- **Test Requirements**:
  - `rule` TR-1.1: Status Bar 좌측 메뉴명이 FLT 진입시 "E6-B", PLAN 진입시 "TRIP", TIMER/CALC/W/B는 그대로 표시. 시계가 setInterval 1분마다 tick. BATT 기본 100% 4칸. (Evidence: 스크린샷 3구역 요소 쿼리셀렉터 존재 여부)
  - `rubric` TR-1.2: Dimension=시각적 픽셀 동일성; scale 1-5; anchors 1=하단바만 / 3=상태바+프레임 / 5=유튜브 스크린샷과 겹쳐비교시 여백+폰트크기 오차 3px이내; threshold >=4; evidence=브라우저 스크린샷 비교이미지
- **Notes**: `src/components/layout/Cx3Device.tsx` 신규 컴포넌트 생성. 기존 MainLayout.tsx는 ARCHIVE.

## Task 2: 35-key Physical Keypad Component + Key Event Bus
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 하단 35버튼 물리 키패드 5열 격자 렌더 (상단행: FLT PLAN TIMER CALC W/B)
  - 제2행: ▲ ▼ + (빈칸 3열) + POWER (주황색 원형 그라디언트)
  - 제3~7행: ★FAV · BACK · SET · M · SET UNIT · CONV UNIT / 0 1 2 3 4 / 5 6 7 8 9 / : +- . ÷ × / - + C BKSP / √ =
  - 키캡 스타일: 다크 그레이 + 눌림시 inset shadow + Orange POWER키 색상
  - 전역 이벤트 버스 `useCx3Keypad()` hook: 모든 키 클릭 → publish, LCD가 subscribe
  - 물리적 키보드 매핑 (옵션): 0-9 숫자키 / Enter=POWER / Esc=BACK / ArrowUp/Down=▲▼
- **Acceptance Criteria Addressed**: AC-3, AC-14
- **Test Requirements**:
  - `rule` TR-2.1: 35개 버튼 DOM 모두 존재여부 querySelectorAll 길이 35 확인. 각 버튼 data-key 속성이 ["FLT","PLAN","TIMER","CALC","WB","UP","DN","POWER","FAV","BACK","SET","M","SETU","CONVU","0"..,"9","COL","SIGN","DOT","DIV","MUL","SUB","ADD","CLR","BKSP","SQRT","EQU"] 와 1:1 매칭. (Evidence: data-key 배열 JSON.stringify 비교)
  - `rubric` TR-2.2: Dimension=키패드 배치·시각 정확도; scale 1-5; anchors 1=20키 미만 / 3=숫자+5메뉴키만 / 5=매뉴얼 p2와 겹쳐 비교시 위치오차 2px이내·주황 POWER키 색상정확·눌림피드백 존제; threshold >=4; evidence=키패드 스크린샷 매뉴얼 중첩 비교
- **Notes**: 기존 CalcMenu의 그리드 키패드는 완전히 폐기. `src/components/keypad/Cx3Keypad.tsx` 신규.

## Task 3: Line Icons 4종 + Cursor Highlight + Blank String State Hook
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - `<Cx3Line>` 공통 컴포넌트: 좌측 아이콘 영역 (24px) + 중앙 약어 라벨 (좌측정렬) + 우측 값 + 단위 (우측정렬)
  - 아이콘 4종 SVG 컴포넌트: IconCheckGreen / IconEqGreen / IconQAm-ber / IconDotBlue (색상 #00ff66 / #00ff66 / #ffaa00 / #3399ff)
  - 현재 커서 라인 전체폭 15% 주황 rgba(255,170,0,0.15) 배경 + 좌측 4px 주황 수직바
  - 공통 hook `useBlankField(initial='')`: string 상태 관리 + numOnly/decOnly/timeOnly 정규식 + 선행0 자동제거 + '--' placeholder 렌더
  - C/BKSP 키 처리: C=전체 clear → '--' + 주황?상태로 / BKSP=뒤에서 1자 삭제
- **Acceptance Criteria Addressed**: AC-2, AC-16
- **Test Requirements**:
  - `rule` TR-3.1: useBlankField('') → 1,0,1,3 순 입력시 값 '1013' 검증. '01013' 선행입력 시도시 '1013'으로 강제. C 호출시 값 '' + 상태 enum='unsolved'. BKSP 4회 → '' 복귀. (Evidence: vitest unit-test useBlankField 5개 case)
  - `rule` TR-3.2: Cx3Line status enum 'input'→녹✓ / 'calc'→녹= / 'unsolved'→주황?+-- / 'global'→파란●. 4케이스 렌더시 data-icon 속성 값 정확. (Evidence: vitest jsdom 렌더 data-icon 확인)
- **Notes**: 기존 모든 계산기의 useState<string> 로직을 이 hook으로 통합 마이그레이션. `src/components/common/Cx3Line.tsx` + `src/hooks/useBlankField.ts` 신규.

## Task 4: FLT Menu 15-item Vertical Navigation Router + BACK Depth Stack
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
  - `Cx3Router` 전역 상태: { root: 'FLT'|'PLAN'|'TIMER'|'CALC'|'WB', submenuId, lineCursor, menuStack: [{root,submenuId}] }
  - FLT 루트 메뉴 리스트 15종: UnitConversions / Altitude / CloudBase / StdAtmos / Airspeed / Fuel / GroundSpeed / Glide / ClimbDescent / WindComponent / ETA / ToFrom / CompassHdg / WindCorrection / RhumbLine / HoldingPattern (인덱스 0~14)
  - ▲▼ 커서 lineCursor 이동 ±1, 범위초과시 clamp(0, list.length-1), 순환없음
  - POWER(Enter): 커서 submenu 진입 → menuStack push
  - BACK 1회: stack pop → 직전 메뉴. stack empty시 FLT 루트 유지.
  - FLT/PLAN/TIMER/CALC/W/B 5핫키: 언제나 해당 루트 메뉴로 즉시 점프 (스택 새로 시작)
- **Acceptance Criteria Addressed**: AC-4, AC-14
- **Test Requirements**:
  - `rule` TR-4.1: FLT 진입 후 DOWN 15회 → cursor 값이 [0..14] 순서대로 변화. DOWN 16회차 → cursor 14 유지. UP 16회차 → cursor 0 유지. (Evidence: vitest Cx3Router reducer state machine test)
  - `rule` TR-4.2: Altitude 함수 진입 (stack 길이 2) → BACK 1회 (stack 길이 1 → FLT 메인) → FLT 키 (stack 길이 1 → FLT 메인) → PLAN 키 (stack [{root:'PLAN'}]) → BACK 1회 → FLT 루트로 복귀 안되고 PLAN 유지 (각 루트별로 따로 스택 관리). (Evidence: reducer state 7단계 시나리오 테스트)
- **Notes**: `src/context/Cx3RouterContext.tsx` 신규로 기존 AppContext 내 라우팅 로직을 대체.

## Task 5: FLT Core Functions (Altitude/CloudBase/StdAtmos/Airspeed 5모드/Fuel 4모드/GroundSpeed)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 3
- **Description**:
  - Altitude: 5라인 (IAlt ✓/? | Baro ✓/? | OAT ✓/? | PAlt = | DAlt =)
  - Cloud Base: 3라인 (OAT ✓ | Dewp ✓ | CB AGL =) → 매뉴얼 공식 (OAT - Dewp) × 400 / 4.4 = ft AGL
  - Standard Atmosphere: Alt ✓ → OAT= / IN HG= / MB= 3출력
  - Airspeed 5모드 토글: PlannedTAS(CAS/OAT/PAlt → TAS=/TAT=/MACH=) / ActualTAS(CAS/TAT/PAlt → TAS=/OAT=/MACH=) / ReqCAS(TAS/OAT/PAlt → CAS=/TAT=/MACH=) / PlannedMACH(MACH/OAT → TAS=/TAT=) / ActualMACH(MACH/TAT → TAS=/OAT=)
  - Fuel 4모드: Burn(Dur/Rate → Vol=) / Rate(Dur/Wt → Rate=) / Endurance(Vol/Rate → Dur=) / GS(Dist/Dur → GS=)
  - GroundSpeed: Dist / Dur → GS=
  - 각 함수별 약어 Appendix D 완벽 매칭: IAlt Baro OAT PAlt DAlt Dewp StdAtmos CAS TAS TAT MACH Wt Vol Dur Rate GS
- **Acceptance Criteria Addressed**: AC-5, AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-5.1: Altitude worked example IAlt=5900 / Baro=29.75 / OAT=75 → PAlt=6059 DAlt=8427. ±1 허용오차. (Evidence: vitest 통과)
  - `rule` TR-5.2: Airspeed PlannedTAS 125KTS CAS / OAT 23°F / PAlt 8500 → TAS 141.03 / TAT 28 / MACH 0.221. ±0.1 단위. ActualTAS/ReqCAS/PlannedMACH/ActualMACH 매뉴얼 샘플 × 5회 통과. (Evidence: vitest 5case)
  - `rule` TR-5.3: Fuel Burn 1:14:38 9.5GPH → 11.82GAL. Rate 2:30 9500LB → 3800LB/HR. Endurance 38GAL 9.5GPH → 3:59:59 HMS. GS 5NM 00:02:32 → 118.42KTS. 4가지 ±0.1 (Evidence: vitest 4case)
- **Notes**: 기존 `flightCalc.ts` calculateAltitude/standardAtmosphere/calculateAirspeed/calculateFuel/groundSpeed 함수 재사용 + Airspeed 3신규모드 / Fuel 2신규모드는 flightCalc.ts에 확장 구현.

## Task 6: SET UNIT / CONV UNIT 12 Categories 38 Units Semantics + Default Units Global
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 5
- **Description**:
  - 12 UnitCategory: Distance(NM/SM/KM/FT/M) / Speed(KTS/MPH/KPH/FPM/MPS) / Duration(HMS/HR/MIN) / Temperature(F/C/K) / Pressure(INHG/HPA/MB/PSI) / Volume(USGAL/LGAL/IMPGL/L/ML) / Rate(GPH/LPH/PPH/KGH) / Weight(LB/KG/OZ/G) / RoC(FPM/MPS/KT) / AoC(FT/NM FT/SM M/M) / Torque(LBIN/KGM NMLB NM) / Angle(DEG DMS RAD)
  - SET UNIT 로직: cursor 라인의 category 내 단위를 순환 (index+1 mod count), 값은 유지, 단위만 변경
  - CONV UNIT 로직: cursor 라인 category의 다음 단위로 convertUnits() 호출 → 값+단위 둘다 변경
  - Altitude Baro: INHG↔HPA 양방향 자동 환산 (29.92=1013.25)
  - SET → Default Units = US / Metric 토글: 모든 함수의 라인 단위를 초기값 US 또는 Metric으로 매핑
- **Acceptance Criteria Addressed**: AC-8, AC-17
- **Test Requirements**:
  - `rule` TR-6.1: Unit Conversions Spd 200 KTS → SET UNIT 1회 → 값 200 유지 + 단위 KPH. CONV UNIT 1회 → 370.4 KPH. Distance 100 KM → NM 54. Temp -20°C → -4°F. Pres 29.78 IN HG → 1008.47 MB. 매뉴얼 p7 12가지 예제 전부 통과. (Evidence: vitest × 12 case)
  - `rule` TR-6.2: Default Units = Metric → Altitude 단위 FT→M, Baro INHG→HPA, Airspeed KTS→KPH, Fuel USGAL→L 로 자동 치환. 기존 값 5000 FT 입력된 상태에서 Default Units 변경시 1524 M 로 환산 표시. (Evidence: vitest reducer 통과)
- **Notes**: 기존 `src/utils/units.ts` 12Category 38Units 체계를 확장하여 SET UNIT 순환 로직 추가.

## Task 7: PLAN Leg 1..N + Blue ● Global + Total Trip + Chain Calculation Auto-Prefill
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 5, Task 6
- **Description**:
  - PLAN 메인: Total Trip (review) / Leg 1..N (Add) 구조
  - Leg 상세 13라인: Dist ✓ / TCrs ✓ / TAS ●(글로벌 이면) / WDir ✓ / WSpd ✓ / Var ● / Dev ● / FuelRate ● / DepTime ✓ / THdg = / GS = / WCA = / ETE = / Fuel = / ArrETA =
  - 파란 ● 판정: 이전 Leg의 TAS/Var/Dev/FuelRate 값과 현재 Leg의 초기값이 일치하면 global 아이콘 렌더 + 사용자 입력 차단(readonly). 다르면 녹?상태 입력가능.
  - Total Trip 집계: ΣDist / ΣETE(분 합산 후 HMS) / DepTime(첫 Leg departure) + ΣETE = Overall ETA / ΣFuel
  - Chain Calculation: Airspeed의 TAS → Plan Leg TAS 기본값 자동주입. Wind Correction Var/Dev → Plan으로. Altitude PAlt → Airspeed PAlt.
- **Acceptance Criteria Addressed**: AC-9, AC-15
- **Test Requirements**:
  - `rule` TR-7.1: PLAN full example Leg1(92.3/288/110/350/3/-17/0/9.5/12:00Z) + Leg2(57.3/170/sameTASVarDevFuelRate/200/6/dep=Leg1 arriv) + Leg3(84.2/069/same/140/5) → TotalTrip Dist=233.8NM, ETE=2:10:29 HMS, ETA=14:10:29Z, Fuel=20.66GAL. 각 값 ±0.5% 허용. (Evidence: vitest 통과)
  - `rule` TR-7.2: Altitude PAlt=4912 계산 후 → Airspeed PlannedTAS → PAlt라인이 녹색= 4912로 프리필. Airspeed TAS=141 계산 후 → Wind Correction → TAS라인 녹= 141 프리필. 3가지 체인 연결 확인. (Evidence: jsdom state 전이 테스트)
  - `rule` TR-7.3: Leg1 TAS 110 → Leg2 자동 110 파란●. Leg2 TAS 사용자가 120으로 수정 → Leg2 녹✓ 120 + Leg3도 120 파란● 승계. (Evidence: vitest state 7단계 테스트)
- **Notes**: 기존 `flightCalc.ts` calculateSegment + aggregateFlightPlan 재사용.

## Task 8: W/B 4 Submenus + Aircraft Profile Interlock
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 3
- **Description**:
  - W/B 루트 서브 4가지: Weight & Balance / Weight Shift Formula / %MAC / Holding Pattern
  - ① W&B: RF ✓ / Item 1..8 Add/Remove (각 Item: Wt/Arm/Mom 2of3 자동계산 3번째) → Totals Wt= / Mom= / CG=
  - ② WeightShift: Total Wt ✓ / ΔCG ✓ / ΔArm ✓ → Item Wt =
  - ③ %MAC: MAC length ✓ / CG ✓ / LMAC ✓ → %MAC =
  - ④ Holding: Turn Dir (Right/Left 토글) ✓ / Hdg ✓ / Radial ✓ → Entry (Direct/Parallel/Teardrop) + Inbound Hdg =
  - Aircraft Profile SET Valid=ON: W&B Item1에 자동 Empty Wt/Arm/Mom 프리필. Fuel Item 추가시 FuelType lb/gal × Vol = Wt 환산.
- **Acceptance Criteria Addressed**: AC-10, AC-22
- **Test Requirements**:
  - `rule` TR-8.1: W&B 샘플 RF=1, Items 4개 (1495,151593 / 380,64 / 150,75 / 180,96) → Totals Wt=2205 / Mom=204443 / CG=92.72. Item 3 Remove 후 Item4 Wt 50추가 → Totals Wt=2105 CG=94.06. (Evidence: vitest × 2case)
  - `rule` TR-8.2: WeightShift 7500/1/120 → 62.5 LBS. %MAC MAC=180.7 CG=910.2 LMAC=860.2 → 27.7%. Holding Right Hdg=155 Radial=270 → Entry=Direct, Inbound=90. 3가지 정확. (Evidence: vitest × 3)
  - `rule` TR-8.3: Aircraft Profile Valid=ON + Empty Wt=1495/Mom=151593 저장 → W&B 진입시 Item1 자동으로 1495/101.40 녹색= 프리필. Valid=OFF → Item 1 빈칸 주황?. FuelType=AvGas 6lb/gal Item Vol=30GAL → Wt=180 자동. (Evidence: vitest reducer state test)
- **Notes**: 기존 holdingEntry / weightShift / percentMac 함수 재사용. W&B Totals 집계 로직은 신규 구현 (flightCalc.ts calculateWbTotals 추가)

## Task 9: TIMER Stopwatch + CountDown (Audio Beep Optional)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 4
- **Description**:
  - TIMER 루트: Stopwatch / Count Down 토글
  - Stopwatch 서브: Start/Stop/Reset 3라인 + 메인 00:00:00 (99:59:59 max)
  - CountDown 서브: 설정값 라인 00:02:30 사용자 HMS 입력 + Start/Stop/Reset → 음수 진입시 폰트 빨강 #ff3330 + '-' 접두
  - 0 도달시 AudioContext beep 440Hz 200ms (SET 백라이팅 Night에서만 활성화, 옵션)
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rule` TR-9.1: Stopwatch Start → fakeTimers 3초 경과 → 00:00:03 표시 → Stop → Reset → 00:00:00 복귀. (Evidence: vitest fakeTimers 3스텝 시나리오)
  - `rule` TR-9.2: CountDown 00:00:03 설정 → Start → fakeTimers 3.5초 → -00:00:00.5 → 값 음수 + className='cd-negative' 빨강폰트. (Evidence: vitest jsdom classList.contains 확인)
- **Notes**: 기존 TimerMenu.tsx의 Stopwatch/CountDown 로직을 CX-3 LCD 레이아웃으로 이식.

## Task 10: CALC Arithmetic + √ + HH:MM:SS Time Arithmetic + Decimal↔HMS Conversion
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2, Task 6
- **Description**:
  - CALC 루트: 입력라인(최대8자리) + 연산기호 + 출력라인
  - 4칙연산 + √ + +- 부호반전 + C 전체 clear + BKSP 1자
  - HH:MM:SS 모드: SET UNIT으로 일반 숫자 ↔ HMS 토글. HMS 덧셈 뺄셈 지원 (02:14:17 + 03:15:00 = 05:29:17)
  - HMS 모드에서 CONV UNIT: 05:29:17 → 5.488 decimal hour (역방향도 지원)
- **Acceptance Criteria Addressed**: AC-12
- **Test Requirements**:
  - `rule` TR-10.1: 123+456=579 → +- → -579 → ×6.5= → -3763.5. √144=12. C → 0 + BKSP → ''. (Evidence: vitest state machine × 7스탭)
  - `rule` TR-10.2: HMS 모드 02:14:17 + 03:15:00 = 05:29:17. CONV UNIT 1회 → 5.488(소수점 3자리). CONV UNIT 1회 더 → 05:29:17 복귀. (Evidence: vitest × 3case)
- **Notes**: 기존 CalcMenu.tsx 완전 폐기. `src/components/calc/Cx3Calc.tsx` 신규.

## Task 11: SET Preferences 8 Menus + 3 Themes + 4 Backlighting Levels + Auto 3min Keypad Off
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 4, Task 1
- **Description**:
  - SET 키 → Preferences 수직 메뉴 8항목: Theme / Backlighting / Time Set / Default Units / Favorite / Aircraft Profile / User Data / Version
  - Theme: Standard(검흰) / Night(검+녹/흰) / Daylight(흰바탕 검정). CSS variables로 --fg --bg --fg-calc --fg-input 등 override
  - Backlighting: Normal(100%/키패드소등) / Daylight(120%/소등) / Dusk(60%/키패드점등) / Night(30%/키패드점등). SET BACKLIGHT auto-off 타이머 3분 idle 후 키패드 소등.
  - Time Set: TZ(Local/UTC/Dest) 오프셋 분 단위 + 24h HH:MM:SS 설정. Status Bar 표시: Local Default / UTC이면 Z suffix.
  - Favorite: ① 저장 SET에서 함수 지정 ② FAV 키 한번에 해당 함수 진입
  - Aircraft Profile: K factor 1.0 / Empty RF / Empty Wt Arm Mom / FuelType AvGas6/Jet6.84/Oil7.5 / Pax Arms ×3 / Cargo Arms ×2 / Custom Arms ×3 / Profile Valid On/Off
  - User Data: Save / Recall / Cancel (localStorage key='cx3_userdata' JSON)
  - Version: "CX-3 Firmware v1.3 (2017 ASA) - Web Replica"
- **Acceptance Criteria Addressed**: AC-13, AC-21
- **Test Requirements**:
  - `rubric` TR-11.1: Dimension=SET 메뉴 완성도; scale 1-5; anchors 1=Theme만 / 3=Theme+Time+DefaultUnits / 5=8항목 100% 존재 + 저장값 재시작후 유지 + localStorage 키 존재; threshold >=4; evidence=jsdom localStorage.getItem 확인
  - `rubric` TR-11.2: Dimension=테마·백라이팅 시각충실도; scale 1-5; anchors 1=1종 / 3=3종 테마 + 2백라이팅 / 5=3테마 + 4레벨 + Dusk/Night에서만 키패드 백라이트 on + 3분 idle후 키패드 소등; threshold >=4; evidence=CSS 클래스 .theme-standard/.night/.daylight + .bl-4 존재 확인
- **Notes**: 기존 AppContext의 Theme/UnitSystem/Favorites 로직을 SET 8메뉴 구조로 확장 마이그레이션.

## Task 12: Extend Vitest Suite 40/40 + TSC No-Error + Android APK Rebuild
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1~Task 11
- **Description**:
  - `src/lib/flightCalc.test.ts` 기존 22개 유지 + Airspeed 5모드 / Fuel4모드 / CloudBase / W&B RF Totals 8개 / PLAN 3LegTotal / ChainCalculation / SETUNITvsCONVUNIT 12case / Router Stack / useBlankField / CALC HMS / Holding / WeightShift / %MAC / Aircraft Profile 연동 18개 추가 → 총 40개 이상
  - tsc --noEmit exit 0, strict 모드 유지
  - `npm run build` (Vite prod 빌드) + gzip 크기 확인
  - `npm run android:build` (JDK21 + Gradle 8.13 no-daemon) assembleDebug BUILD SUCCESSFUL
  - APK 파일 루트 복사 E6B-CX3-debug.apk 크기 ≤ 5MB 확인
- **Acceptance Criteria Addressed**: AC-19, AC-20
- **Test Requirements**:
  - `rule` TR-12.1: vitest --run exit 0, 40/40 이상 PASS. tsc --noEmit exit 0. Vite 빌드 exit 0. (Evidence: 터미널 3개 명령 출력 로그 캡처)
  - `rule` TR-12.2: ls -la E6B-CX3-debug.apk ≤ 5,242,880 bytes. aapt dump badging → package: name='com.asacx3.e6b.flightcomputer' platformBuildVersionName=36. (Evidence: 명령 로그)
- **Notes**: Task 1~11 구현 완료 후 한번에 실행. 실패시 해당 Task로 회귀.

## Task 13: Polish + Favorites/User Data/Version + Final Visual QA
- **Status**: `pending`
- **Priority**: low
- **Depends On**: Task 12
- **Description**:
  - FAVORITE ★ 키 FSM: FAV 누를시 SET Favorite에 지정된 함수로 즉시 점프. 미지정시 SET → Favorite으로 안내.
  - User Data Save → localStorage에 현재 전체 상태 snapshot. Recall → 덮어쓰기. Cancel → no-op.
  - Version 페이지: 하드웨어 스펙 목록 렌더 (ASA CX-3 replica · 35keys · 12unit categories · 100+ functions)
  - 최종 시각 QA: 유튜브 스크린샷과 FLT 메인 메뉴 포지셔널 비교. Status Bar 폰트 패밀리. 아이콘 색상 정확도. 키캡 간격. Footer 레전설.
- **Acceptance Criteria Addressed**: AC-13 (일부), AC-21 (최종 Polish)
- **Test Requirements**:
  - `rule` TR-13.1: FAV 키 → 미지정시 상태 'favorite: null' → SET→Favorite Altitude 저장 → FAV키 → 현재라우터 root+submenu = 'FLT' + 'Altitude'. (Evidence: vitest reducer test)
  - `rubric` TR-13.2: Dimension=최종 시각적 완성도; scale 1-5; anchors 1=깨짐 / 3=작동하지만 어색함 / 5=실제 기기 옆에 놓고 비교시 일반인이 3초만에 구분 못하는 수준; threshold >=4; evidence=side-by-side 스크린샷
- **Notes**: Task 1~12 all 통과 후 마무리.
