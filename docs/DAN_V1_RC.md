# DAN V1 release candidate

기준 HEAD `fbf2bcde7dfc6dcc4c655e7234a2c30635b0915f`. 이 문서는 그 커밋의 기능과 디자인을 유지한 채 베타 준비 상태를 적는다.

## 상태

| 구분 | 상태 |
|------|------|
| CODE COMPLETE | 예. V1 구매수요 → 제안 → 연결 → 증거 → snapshot → 결제 게이트 → 인계 → 완료/취소가 코드에 있다. |
| STAGING READY | 아니오. 저장소에는 staging 분리 설계와 워크플로가 있다. 대시보드 프로젝트와 secret은 아직 없다. |
| REQUIRES EXTERNAL CREDENTIAL | Supabase URL, anon key, Auth redirect, Cloudflare token/account, staging DB URL. |
| REQUIRES REAL USER VALIDATION | 두 명의 실제 계정으로 한 거래. demo와 unit test는 그 자리를 대신하지 않는다. |

## 1. 현재 V1 기능

구매자가 제품을 찾고, 카탈로그에 없으면 이름과 카테고리로 구매수요를 만든다. 판매자는 Live Demand에 Quick Offer와 증거를 낸다. 구매자는 제안을 보고 관심을 표시하고, 판매자가 연결한다. 채팅, Deal Snapshot, 안전결제 게이트, 직거래 인계, 완료, 취소, Trust History가 있다.

## 2. 사용자 flow

[BETA_E2E_CHECKLIST.md](./BETA_E2E_CHECKLIST.md)와 같다. demo는 A/B 두 계정을 분리하지 않는다.

## 3. Architecture

정적 SPA다. `VITE_DATA_MODE=demo`이거나 Supabase 공개 값이 없으면 localStorage demo 어댑터다. URL과 anon key가 있고 demo가 아니면 Supabase Postgres + RLS + RPC다. 브라우저 데이터 접근은 anon/publishable key뿐이다. `service_role`은 SQL 권한에만 있고 앱 환경변수로 읽지 않는다.

## 4. DB migrations

`supabase/migrations/0001_initial.sql`부터 `0041_realtime_discovery.sql`까지 순서대로 적용한다. `0004`와 `0018`은 공개 제품 카탈로그 행이다. 사용자, 수요, 거래를 demo로 심지 않는다. `supabase/seed.sql`은 `select 1`만 한다. staging Live Demand는 `npm run db:seed:staging`일 때만 들어간다.

## 5. Realtime

`0041`이 `public.messages`를 `supabase_realtime` publication에 넣는다. 별도 Realtime 키는 없다. 채널이 구독되면 "실시간"이 보인다. `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`이면 끊김을 알리고 메시지를 다시 불러온다. 기존 60초 polling은 그대로다.

## 6. Security boundaries

RLS, 증거 버킷 `dan-v1-evidence` (비공개, 소유자 prefix), `settlement_mark_paid` / `settlement_mark_refunded` / `expire_unpaid_deals`는 `service_role`만 실행한다. 상세는 [RLS_SECURITY.md](./RLS_SECURITY.md).

## 7. Payment boundary

PG 환경변수는 없다. demo만 `simulateSafePaymentDemo`로 로컬 상태를 PAID로 바꾼다. supabase 어댑터의 그 함수는 항상 `false`다. supabase 모드 화면에는 결제 버튼이 없고, 클라이언트 PAID 변경이 불가하다는 안내만 있다. 잠긴 Deal Snapshot 전에 결제 화면은 조건 확인으로 보낸다.

## 8. Known external dependencies

Supabase Auth / Postgres / Storage / Realtime. Cloudflare Pages 또는 GitHub Pages. 결제사 없음. analytics 업체 없음.

## 9. Staging requirements

기존 배포는 둘이다.

- GitHub Pages: `main` push와 `workflow_dispatch`. base `/dan/`. 워크플로 이름 Deploy GitHub Pages.
- Cloudflare Pages: `workflow_dispatch`만. 프로젝트 이름은 `dan`이고 주석의 대상은 `https://dan.pages.dev`다. 이 워크플로는 staging 슬롯이 아니다.

staging은 별도 문서 [STAGING.md](./STAGING.md)다. 공개 워크플로 `Deploy Cloudflare Pages`는 실행하면 `dan`으로 나간다. staging은 `Deploy Cloudflare Staging`만 쓰며, 프로젝트 이름은 `dan-staging`이다. 이 준비에서는 어느 쪽도 실행하지 않았다.

필요한 값 (production 값을 복사하지 않음):

- 새 Supabase staging project URL / anon key (`STAGING_VITE_SUPABASE_*`)
- Auth Site URL과 redirect allow-list (`http://localhost:5173`과 `https://dan-staging.pages.dev`)
- Cloudflare 프로젝트 `dan-staging`, `STAGING_CLOUDFLARE_API_TOKEN`, `STAGING_CLOUDFLARE_ACCOUNT_ID`
- Live Demand seed를 원격에 넣을 때 `SUPABASE_DB_URL` (staging DB만), `DAN_SEED_TARGET=staging`, `DAN_STAGING_CONFIRM=seed-staging-only`
- seed 전에 staging 계정 1개 (프로필이 없으면 seed SQL이 수요를 만들지 않고 예외를 낸다)

## 10. Beta E2E checklist

[BETA_E2E_CHECKLIST.md](./BETA_E2E_CHECKLIST.md).

## 11. Beta metrics

[BETA_METRICS.md](./BETA_METRICS.md). 20~50명 baseline. 퍼센트 목표 없음. 수집은 provider 연결 후.

## 12. Remaining blockers

- staging/production 자격증명 없음. 가짜 값으로 채우지 않음.
- analytics 이벤트가 화면에서 아직 호출되지 않음. contract만 있다.
- 두 사용자 Realtime E2E는 자격증명 없이 실행하지 않음.
- staging/production 대시보드 프로젝트와 GitHub secret이 아직 없음. 워크플로는 작성만 하고 실행하지 않음.
- 알 수 없는 경로는 404 문구 없이 홈으로 보낸다. 기존 동작이라 이번 릴리스에서 바꾸지 않음.
- demo 사용자 이름은 fixture 고정이라 "긴 사용자명"은 채팅 제목(긴 제품명)으로만 자동화했다.

## 13. Launch checklist

- [ ] staging Supabase에 migrations `0001`–`0041` 적용
- [ ] Auth redirect에 staging origin과 localhost 추가
- [ ] 프론트 빌드에 staging 공개 키만 주입
- [ ] production 빌드에 demo seed 명령이 들어가지 않음
- [ ] 결제 버튼이 demo가 아닌 빌드에서 보이지 않음
- [ ] 두 계정의 체크리스트 1회
- [ ] `main` merge와 production 배포는 그 다음

## 화면 상태 점검

| 상태 | 현재 |
|------|------|
| loading | Supabase 로딩 스켈레톤, 채팅 "불러오는 중…" |
| empty | 수요, 제안, 알림, 채팅 빈 문구와 다음 안내 |
| offline | 상단 "오프라인이에요. 연결이 돌아오면 …" |
| network / discovery failure | 전체 로드 실패 시 "불러오지 못했어요."와 다시 시도 |
| auth expired | 세션 없으면 anonymous, 로그인이 필요한 화면은 로그인 안내 |
| unauthorized | RLS와 "찾을 수 없어요" empty |
| 404 | 알 수 없는 경로는 홈. 삭제된 거래는 empty |
| expired / canceled / completed | 라이프사이클과 채팅 읽기 전용, 취소 문구 |
| no seller evidence | 증거 전 단계 안내 |
| missing photo | 사진 없으면 제품 색면. 테스트로 overflow 확인 |
| Realtime disconnected | 오류/타임아웃/종료 시 안내와 재조회 |
| pagination failure | 서버 discovery는 기존 RPC. 실패 시 로드 실패 경로 |
| duplicated action / double click | 서버 idempotent RPC와 in-flight 잠금 유지 |

ErrorBoundary와 오프라인 배너는 유지했다.
