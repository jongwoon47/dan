# DAN 상용화 구현 명세 v1.0

**대상:** jongwoon47/dan  
**기준 브랜치:** `feature/dan-location-jp-launch-plan-20261009`  
**원칙:** 기존 네 가지 요청 종류와 거래 구조를 유지한다. 기존 구현을 무조건 교체하지 않고 검증한 뒤 부족한 부분만 확장한다.

이 문서는 제품 명세의 저장본이다. 실행 우선순위·가드레일은 `docs/CURSOR_DAN_HANDOFF_20261009.md`와 `.cursor/rules/dan-safe-development.mdc`를 따른다.

## 설계 RPC 명칭 ↔ 기존 구현

| 명세 설계명 | 현재 구현 | 비고 |
|---|---|---|
| `searchNearbyDemands` | `search_nearby_demands_market` | 국가·반경 검증. 구 `search_nearby_demands` execute 회수됨 |
| `searchAreaDemands` | 클라이언트 `locationDiscovery` area 모드 | 서버 RPC 미도입. 공개 지역 라벨 텍스트 매칭 |
| `searchRouteCandidates` | 라벨 FROM→TO + 외부 지도 링크 | 경로 코리도어 RPC는 기본 안정화 후(D) |
| `rankEligibleRequests` | TS 헬퍼 + 기존 nearby/BUY 정렬 | 별도 SECURITY DEFINER 랭커 금지 |

## A–H 요약 게이트

- **A 위치:** 옵트인 GPS, 권한 거부 시 지역명, KR/JP 기억, 생활권 3개, 1/3/5/10km, 유형·온라인 분리, 대략 거리만 공개
- **B 거래:** BUY/BORROW/TASK/SERVICE 동일 완성도. 중복 연결·만료·본인·차단 서버 차단. 미구현 결제/에스크로 허위 표시 금지
- **C 일본:** 언어≠국가, JPY는 저장 통화만, JP 요청 생성은 검증 통과 후 해제, 파일럿 1도시
- **D 경로 추천:** 기본 기능 안정 후. 백그라운드 GPS 금지
- **E 기술:** React/Vite + Capacitor + Supabase 유지. 국가·통화·시간대·수행방식·지역코드 분리
- **F 검증:** 4유형 E2E, 위치 권한, KRW/JPY, RLS, iOS 실기기, ko/ja QA, 반응형, CI
- **G 보류:** 실시간 GPS 추적, 자동 에스크로, 복잡한 AI, 자동 KYC, 일본 전국 동시 출시
- **H 배포:** 분리 브랜치·PR. 운영 DB 마이그레이션 / main 병합 / 스토어 업로드 / JP 지역 활성화는 별도 승인

## 현재 브랜치 상태 (2026-10-09 감사)

| 영역 | 상태 |
|---|---|
| KR 4유형 거래 + 서버 가드 | 대체로 DONE (BUY 실결제 미구현 → 정직 표시) |
| 위치 nearby + 프라이버시 | DONE |
| 생활권 저장/삭제 | DONE · 제자리 수정 추가 중 |
| 목록/지도 전환 | PARTIAL — 거리 구간(밴드) 뷰 추가. 정확한 핀/격자 지도는 후속 |
| JP 생성/거래 | 의도적 BLOCK (UI + DB) |
| JA 전체 UI | PARTIAL (탐색/생성 파일럿; 채팅·동의·신고 등 보강 중) |
| 경로 코리도어 | DEFERRED (D) |

## 금지 (승인 전)

운영/스테이징 DB 마이그레이션 적용, `main` 병합, 스토어 빌드 업로드, 일본 출시 지역 활성화, JP 쓰기 게이트 우회, 가짜 JPY 재고 생성.
