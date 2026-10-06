# 정식 버전 APK (일반 릴리즈) — E6B-CX3-debug.apk
cd /Users/sunghyunkim/Documents/E6B && export JAVA_HOME="$(/usr/libexec/java_home)" && export VITE_BUILD_FLAVOR=prod && npx tsc --noEmit && npx vitest run && VITE_BUILD_FLAVOR=prod npx vite build --mode production && npx cap sync android && cd android && ./gradlew clean assembleDebug --no-daemon && cd .. && cp -f android/app/build/outputs/apk/debug/app-debug.apk ./E6B-FLIGHTCAL-debug.apk && ls -lh E6B-FLIGHTCAL-debug.apk

# ============================================================

# Trial 버전 APK (만료 26SEP30 / 2026-09-30) — E6B-CX3-debug-TRIAL.apk
# - LCD 상단에 TRIAL EXPIRES 26SEP30 배너 표시
# - 2026-09-30 23:59:59 이후 모든 키 입력 잠금 + 만료 오버레이 표시
cd /Users/sunghyunkim/Documents/E6B && export JAVA_HOME="$(/usr/libexec/java_home)" && export VITE_BUILD_FLAVOR=trial && npx tsc --noEmit && npx vitest run && VITE_BUILD_FLAVOR=trial npx vite build --mode trial && npx cap sync android && cd android && ./gradlew clean assembleDebug --no-daemon && cd .. && cp -f android/app/build/outputs/apk/debug/app-debug.apk ./SmartCALv0.9-TRIAL.apk && ls -lh SmartCALv0.9-TRIAL.apk


# 에물레이터 (live-reload) — build 생략, 바로 실행
# vite dev server + Vite proxy로 CORS 우회, WebView에서 정상 동작
cd /Users/sunghyunkim/Documents/E6B
export JAVA_HOME="$(/usr/libexec/java_home)"
npx cap run android -- --livereload --external

# ────────────────────────────────────────────────────────────
# 실제 APK 빌드 (Native HTTP 직접 호출 — CORS 제약 없음)
# build → sync → assembleDebug → apk 추출
cd /Users/sunghyunkim/Documents/E6B
export JAVA_HOME="$(/usr/libexec/java_home)"
export VITE_BUILD_FLAVOR=prod
npx vite build --mode production
npx cap sync android
cd android && ./gradlew clean assembleDebug --no-daemon && cd ..
cp -f android/app/build/outputs/apk/debug/app-debug.apk ./E6B-CX3-debug.apk
ls -lh E6B-CX3-debug.apk



----------------

cap run이 안 되면 Vite dev server가 먼저 실행되어야 합니다. 두 단계로 나눠서 해보겠습니다.

터미널 1 — Vite dev server 실행:

Bash

cd /Users/sunghyunkim/Documents/E6B
npm run dev

이걸 실행하면 http://localhost:5173에서 dev server가 뜹니다.

APK 빌드
cd /Users/sunghyunkim/Documents/E6B
export JAVA_HOME="$(/usr/libexec/java_home)"
export VITE_BUILD_FLAVOR=prod
npx vite build --mode production
npx cap sync android
cd android && ./gradlew clean assembleDebug --no-daemon

터미널 2 — (Vite dev server가 실행 중인 상태에서) 에뮬레이터 실행:

Bash

cd /Users/sunghyunkim/Documents/E6B
export JAVA_HOME="$(/usr/libexec/java_home)"
npx cap run android -- --livereload --external


-----------------
APK 빌드 +설치
cd /Users/sunghyunkim/Documents/E6B && export JAVA_HOME="$(/usr/libexec/java_home)" && export VITE_BUILD_FLAVOR=prod && npx vite build --mode production && npx cap sync android && cd android && ./gradlew clean assembleDebug --no-daemon && cd .. && $PWD/.android-sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk