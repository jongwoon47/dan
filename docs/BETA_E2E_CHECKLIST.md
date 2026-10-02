# DAN V1 베타 두 사용자 E2E 체크리스트

기준 코드: `feature/dan-v1-demand-first-trust-flow`의 `fbf2bcde`에서 분기한 release branch.

사용자 A는 구매자, 사용자 B는 판매자다. demo는 한 브라우저의 localStorage이고 로그인을 건너뛴다. 두 계정의 회원가입, Realtime, 읽음은 Supabase가 있을 때만 실제 값이다. 자격증명이 없으면 해당 칸은 차단으로 남긴다.

## 실행

| 범위 | 명령 | 자격증명 |
|------|------|----------|
| demo UI / 레이아웃 | `npm run test:qa:mobile` | 없음 |
| 결제 게이트 (supabase 모드 UI) | `npm test`의 `SafePaymentPage.productionGate` | 없음 |
| supabase 어댑터는 demo 결제를 거부 | `npm test`의 `paymentBoundary` | 없음 |
| 두 계정 API E2E | `npm run test:e2e:remote` | Supabase 공개 값 + 아래의 미리 검증된 staging A/B 계정 |
| RLS | `npm run test:e2e:security` | 위와 같음 |
| 두 브라우저 | `npm run test:e2e:browser` | 위와 같음 |

## staging 사전 조건

BUY 보안 게이트 때문에 full remote E2E는 매번 새 랜덤 구매자/판매자를 만들지 않는다.

- 구매자 A: phone verification 완료
- 판매자 B: phone + identity + payout verification 완료, seller type 설정
- A/B는 서로 다른 **staging 전용 테스트 계정**이어야 한다.
- `.env.local`에 `DAN_E2E_BUYER_EMAIL`, `DAN_E2E_BUYER_PASSWORD`, `DAN_E2E_SELLER_EMAIL`, `DAN_E2E_SELLER_PASSWORD`를 넣는다. 저장소에 커밋하지 않는다.
- production 계정/credential은 사용하지 않는다.
- 인증 provider가 아직 없으면 staging SQL Editor/운영 경로에서 해당 테스트 계정에만 verification을 부여한다. 실제 사용자 verification을 흉내 내어 production에 넣지 않는다.
- 보안 block probe는 테스트가 끝나면 삭제해 A/B 계정을 다음 run에서도 재사용할 수 있게 한다.

## A. 구매자

- [ ] 회원가입 / 로그인. demo는 로그인 화면을 건너뛰므로 수동 칸은 staging 전용.
- [ ] 제품 검색.
- [ ] 없으면 open catalog에서 제품을 만든다. demo: `e2e/visual/dan-v1.spec.ts`의 미등록 제품 등록.
- [ ] 구매수요 등록.
- [ ] My DAN에서 그 수요를 확인한다.

## B. 판매자

- [ ] 회원가입 / 로그인.
- [ ] Live Demand에서 A의 수요를 찾는다.
- [ ] 제품 상세에서 A의 개별 구매수요를 선택해 Quick Offer 제출. 제품 전체 수요에 보내는 일반 제안 경로도 확인한다.
- [ ] Quick Offer는 사진 없이 제출 가능하고, 사진을 선택적으로 붙일 수도 있다.

## A. 제안

- [ ] 받은 제안 목록.
- [ ] 제안 상세.
- [ ] Interest.

## B. 연결

- [ ] 구매자의 Interest를 확인한다.
- [ ] 판매자가 Connect를 수락한다. 이 시점에는 상세 Evidence가 아직 없어도 된다.
- [ ] 연결 직후 A/B 모두 채팅에 들어갈 수 있다.

## A/B. 채팅

- [ ] 메시지 전달.
- [ ] 읽음.
- [ ] 상대의 새 메시지.
- [ ] 끊긴 뒤 재연결. 채널이 `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`이면 화면에 끊김을 알리고 메시지를 다시 불러온다. demo는 채널 상태가 없으므로 이 문구를 띄우지 않는다.
- [ ] 빈 채팅 문구와 보내기 버튼이 320px 안에 남는다.

## 거래

- [ ] 채팅 후 seller Evidence 제출. Snapshot은 Evidence 없이는 진행되지 않는다.
- [ ] Deal Snapshot에서 최종 거래 방식 확인.
- [ ] 직거래면 만남 장소와 시간을 입력한다.
- [ ] Deal Snapshot 양측 확인 후 잠금. 한쪽이 장소/시간을 바꾸면 상대의 이전 확인은 다시 필요하다.
- [ ] payment gate. 잠긴 snapshot 이후에만 들어간다.
- [ ] demo에서만 "결제하기"가 보인다. production/supabase 모드에서는 그 버튼이 없고 `simulateSafePaymentDemo`는 `false`다. PG를 흉내 내어 PAID로 만들지 않는다.
- [ ] handoff.
- [ ] completion. BUY 완료는 결제 확인 전 양쪽 완료로 넘어가지 않는다. 기존 `store.hardening` 테스트.

## 취소

- [ ] 거래 취소와 종료 확인. demo: `dan-v1.spec.ts` 채팅 취소.
- [ ] 상태가 종료로 남는다.
- [ ] 판매자 귀책 등 조건이 맞으면 demand reopen. 서버 함수 `reopen_demand_after_trade_close`.

## 막혔을 때

각 화면은 상태와 다음 행동을 갖고 있다. 거래를 못 찾으면 내 구매수요로, snapshot이 없으면 조건 확인으로, 결제가 서버에서 확인되기 전에는 인계를 진행하지 않는다. 전체 로드 실패는 다시 시도, 오프라인은 상단 배너, 렌더 예외는 다시 불러오기 / 홈.
