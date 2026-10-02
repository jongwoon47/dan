# DAN V1 staging 분리

이 문서는 production과 완전히 분리된 staging 준비만 다룬다.
실제 staging 프로젝트 생성, secret 입력, 배포는 사람이 대시보드에서 한다.
이 저장소는 이름을 고정하고, production 값을 재사용하면 중단한다.

기준 브랜치: `release/dan-v1-beta-readiness`

## Architecture

```
브라우저 SPA (Vite)
        ↓  anon / publishable key only
Supabase staging project (별도 프로젝트)
Auth / Postgres+RLS+RPC / Storage / Realtime

Cloudflare Pages project: dan-v1-staging-jongwoon
URL: https://dan-v1-staging-jongwoon.pages.dev
```

Workers, Edge Functions, 결제사, analytics 업체는 없다.

| 구분 | production (건드리지 않음) | staging |
|------|---------------------------|---------|
| Cloudflare Pages 프로젝트 | `dan` | `dan-v1-staging-jongwoon` |
| Pages URL | `https://dan.pages.dev` | `https://dan-v1-staging-jongwoon.pages.dev` |
| GitHub Pages | `main` → `/dan/` | 사용하지 않음 |
| Supabase | 기존 공개 프로젝트. 레거시 스크립트 ref `wmznpuhqmmqunwtewntt` | 새로 만든 프로젝트만 |
| GitHub secrets | `VITE_SUPABASE_*`, `CLOUDFLARE_*` | `STAGING_*` 만 |
| GitHub Environment | 없음 (repo secrets) | `staging` |
| Workflow | Deploy Cloudflare Pages, Deploy GitHub Pages | Deploy Cloudflare Staging |

## Environment separation

프론트엔드는 빌드 시 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`와 공개 런타임 식별자 `VITE_DAN_ENV`를 읽는다.
staging 워크플로는 **GitHub secret 이름** `STAGING_VITE_SUPABASE_*`를 읽어 빌드 env로 넘기고, `DAN_STAGING_SUPABASE_PROJECT_REF`를 배포 전 guard에만 넘긴다.
staging/production 빌드는 Supabase 공개 값이 빠지면 demo로 fallback하지 않고 실패한다. production secret 이름은 staging 워크플로가 읽지 않는다.

가드:

- `src/release/environmentSeparation.ts` — production 식별자 deny-list
- `npm run assert:staging-deploy` — 배포 전 검사
- `npm run db:seed:staging` — 로컬은 유지. 원격은 `DAN_STAGING_SUPABASE_PROJECT_REF`가 DB URL의 project ref와 일치해야 함. production ref는 항상 거부
- `scripts/apply-migrations-remote.mjs` / `scripts/apply-0016.mjs` — default-deny. `DAN_ENV`와 confirm, 명시적 project ref 없이 원격 작업을 하지 않음. production ref를 기본값으로 쓰지 않음

production으로 보이는 값이 있으면 배포/seed를 진행하지 말고 이 문서의 STOP POINT에서 멈춘다.

## Required GitHub secret names

값은 적지 않는다. GitHub Environment `staging`에만 넣는다. production 값을 복사하지 않는다.

- `STAGING_VITE_SUPABASE_URL`
- `STAGING_VITE_SUPABASE_ANON_KEY`
- `STAGING_CLOUDFLARE_API_TOKEN`
- `STAGING_CLOUDFLARE_ACCOUNT_ID`
- `STAGING_SUPABASE_DB_URL` (seed 전용. 프론트 빌드/배포 워크플로는 읽지 않음)
- `DAN_STAGING_SUPABASE_PROJECT_REF` (원격 seed/migration expected ref. 프론트 빌드에는 넣지 않음)

프론트/Actions에 넣지 말 것:

- `service_role` / `sb_secret`
- production `VITE_SUPABASE_URL`
- production `VITE_SUPABASE_ANON_KEY`
- production `CLOUDFLARE_API_TOKEN`

## Workflow

파일: `.github/workflows/deploy-cloudflare-staging.yml`

- 생성됨. 기존 CI / production deploy 워크플로는 실행 트리거를 바꾸지 않음
- trigger: `workflow_dispatch` only. `main` push 없음
- 입력 `confirm`이 `deploy-staging-only`가 아니면 실패
- `main`에서 실행하면 실패
- `--project-name=dan-v1-staging-jongwoon` 하드코딩. `dan` 및 점유된 `dan-staging` 불가
- `environment: staging`
- 이 저장소 작업에서는 워크플로를 실행하지 않음

## Supabase staging checklist

로컬 검증은 기존 CI와 같다: `supabase start` → `supabase db reset` → `supabase test db`.
원격 staging 적용은 새 프로젝트에서만.

1. [ ] Supabase 대시보드에서 **새** 프로젝트 생성. 이름은 `dan-v1-staging` 권장. 기존 공개 프로젝트를 쓰지 않음
2. [ ] Project URL과 anon/publishable key를 확인. service_role은 대시보드에만 두고 저장소/프론트/GitHub frontend secret에 넣지 않음
3. [ ] Database password / DB URL은 `STAGING_SUPABASE_DB_URL`용. 알려진 production ref가 포함되면 중단
4. [ ] Auth → Email provider ON
5. [ ] Auth → Confirm email: staging 초기는 OFF (로컬 `supabase/config.toml`과 동일)
6. [ ] Auth → URL configuration
    - Site URL: `https://dan-v1-staging-jongwoon.pages.dev`
    - Redirect URLs: `https://dan-v1-staging-jongwoon.pages.dev/**`, `http://localhost:5173/**`
7. [ ] Migrations `0001_initial.sql` … `0041_realtime_discovery.sql`을 **순서대로** 적용
    - CLI: 새 프로젝트에만 `supabase link` 후 `supabase db push`
    - 또는 Dashboard SQL Editor에 파일 순서대로 붙여넣기
    - `scripts/apply-migrations-remote.mjs` / `scripts/apply-0016.mjs`는 default-deny다. staging이면 `DAN_ENV=staging`, `DAN_REMOTE_CONFIRM=apply-staging-only`, `DAN_STAGING_SUPABASE_PROJECT_REF`가 필요하다. 값이 없으면 실행하지 말고 SQL Editor를 쓴다.
8. [ ] `0004` / `0018` 카탈로그 행은 마이그레이션에 포함됨. `supabase/seed.sql`은 `select 1`만 하므로 사용자/거래를 심지 않음
9. [ ] Storage: `0022`가 private bucket `dan-v1-evidence`와 RLS를 만듦. 별도 public URL 변수 없음
10. [ ] RLS / RPC: 마이그레이션이 전부. Edge Function 디렉터리 없음. 배포할 function 없음
11. [ ] Realtime: `0041`이 `public.messages`를 publication에 넣음. 별도 키 없음
12. [ ] `service_role` only RPC (`settlement_mark_paid`, `settlement_mark_refunded`, `expire_unpaid_deals`, `ops_*`)는 앱 env가 아님
13. [ ] staging에서 회원가입 1개 (프로필 필요)
14. [ ] 로컬 또는 사람이 연결한 staging DB에서만:
    `DAN_SEED_TARGET=staging DAN_STAGING_CONFIRM=seed-staging-only DAN_ENV=staging DAN_STAGING_SUPABASE_PROJECT_REF=<staging-ref> SUPABASE_DB_URL=... npm run db:seed:staging`
    - staging seed는 공개 Live Demand 집계에 보이도록 선택된 첫 staging 프로필의 **phone verification만** synthetic test 상태로 표시한다.
    - identity/payout verification은 건드리지 않는다. production에서 이 seed를 쓰면 안 된다.
15. [ ] GitHub Environment `staging`에 `STAGING_*` secret 입력. production 값 복사 금지

## Cloudflare staging checklist

1. [ ] Cloudflare Pages에서 **새** 프로젝트 `dan-v1-staging-jongwoon` 생성. 기존 공개 프로젝트 `dan`을 수정하지 않음. 점유된 `dan-staging`은 쓰지 않음
2. [ ] Production 도메인, `dan.pages.dev`, `dan-staging.pages.dev` 를 staging에 연결하지 않음
3. [ ] 예상 URL: `https://dan-v1-staging-jongwoon.pages.dev`
4. [ ] API token은 `dan-v1-staging-jongwoon`에만 권한을 둔 새 토큰을 만들고 `STAGING_CLOUDFLARE_API_TOKEN`에 넣음. production 토큰을 복사하지 않음
5. [ ] `STAGING_CLOUDFLARE_ACCOUNT_ID` 입력
6. [ ] GitHub Environment `staging` 생성. production environment와 공유하지 않음
7. [ ] 워크플로 `Deploy Cloudflare Staging`은 secret이 준비된 뒤에만, `confirm=deploy-staging-only`로 사람이 실행
8. [ ] `Deploy Cloudflare Pages` / `Deploy GitHub Pages`는 staging에 쓰지 않음

## STOP POINT

staging 프로젝트 생성과 GitHub secret 입력이 필요한 시점에서 멈춘다.
이 변경만으로는 배포하지 않는다. `main` merge, production 배포, 공개 프로젝트 `dan` 변경은 하지 않는다.

다음 단계(별도 승인 후): 사람이 secret을 넣은 뒤 staging 워크플로를 수동 실행한다.
