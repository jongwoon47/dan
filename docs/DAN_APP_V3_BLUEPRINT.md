# DAN App V3 — Real App Redesign Blueprint

## Product principle

DAN is the app where **the person who needs something asks first, and someone who can fulfill it makes an offer**.

All four request types stay first-class:
- BUY — 물건 구매
- BORROW — 빌리기
- TASK — 심부름
- SERVICE — 서비스

The user-facing model is always:

**요청 → 제안 → 채팅 → 거래 조건 확인 → 결제/인계 → 완료**

Internal terms such as Demand, Match, Sell Intent, Ownership, Evidence, Snapshot, Handoff, Quick Offer must not lead the UI language.

## Navigation

Mobile bottom tabs:
1. 홈
2. 탐색
3. 요청
4. 채팅
5. 내 거래

Profile is accessed from the top-right account affordance or My Trades.

Desktop uses the same information architecture with a top navigation.

## Visual language

- White/neutral canvas
- Near-black primary text
- Neutral gray secondary text/dividers
- Purple only for primary actions and selected states
- Green only for success/completed
- Red only for destructive/error
- Default to rows + dividers; cards only when grouping is necessary
- One strong CTA per screen
- No decorative gradients as information surfaces
- No nested cards
- No customer-facing English stage names

## Typography

- Screen title: 24–28 mobile / 28–34 desktop
- Key price: 26–34
- Section title: 18–20
- Body: 15–16
- Meta/helper: 13–14

## Request creation

Single route: `/create`.
`/buy/new` becomes a redirect/compatibility entry into `/create?type=BUY`.

### Type selection
Four equal request types:
- 구매 — 물건을 사고 싶어요
- 빌리기 — 잠깐 빌리고 싶어요
- 심부름 — 대신 해줄 일을 찾아요
- 서비스 — 전문적인 도움이 필요해요

### Step 1: What
BUY:
- 제품
- 최대 가격
- 상태

BORROW:
- 빌릴 물건
- 전체 예산

TASK:
- 부탁할 일
- 사례금
- 방식: 현장 / 픽업 / 이동 / 원격

SERVICE:
- 원하는 서비스
- 예산
- 방식: 현장 / 원격

No redundant generic title field when the request can derive a title from the core item/task.

### Step 2: Where / When
Only fields relevant to the type and selected fulfillment mode.
Optional details collapse under “추가 조건”.

## Home

Not a marketing hero. It is a transaction-start screen:
- compact greeting/header
- universal “무엇이 필요하세요?” entry
- request type shortcuts
- live requests / trending needs
- seller prompt only when contextually useful

## Explore

Filter all request types, not only products.
The first version can retain product aggregation for BUY while exposing request-type filters and a clear path to non-BUY requests.

## Request detail

Type-specific hero:
- primary subject
- budget/price/reward
- location/time/method
- current status

Owner sees offers/responses first.
Edit/close move to low-emphasis actions/overflow.

## Offer flow

The fulfiller sees:
- buyer/request context
- price first
- condition / fulfillment method
- optional note/photo/details

CTA: “제안 보내기”.
No visible “Quick Offer”.

## Offer detail

Show only:
- offer price
- seller/fulfiller trust
- condition/method
- short note
- relevant media

Primary CTA: “이 제안 선택하기” / “이 사람과 거래하기”.

## Chat as transaction hub

After connection, chat is the home of the transaction.
A compact action banner above messages changes by stage:
- 상품 정보 확인
- 거래 조건 확인
- 결제
- 인계 확인
- 거래 완료

## Trade flow shell

Evidence / Condition confirmation / Payment / Handoff / Complete share one shell:
- compact product/request summary
- same 4-step progress
- one current task
- one primary CTA
- secondary help/dispute hidden under disclosure

User-facing labels:
- 상품 정보
- 거래 조건
- 결제
- 인계
- 완료

## My Trades

Tabs:
- 진행 중
- 내 요청
- 완료

Rows show:
- subject
- counterpart or response count
- amount
- next action/status
- unread indicator

Do not expose database concepts as navigation categories.

## Profile

Identity + trust summary only:
- name / area / verification
- completed trades
- completion rate or factual completion count
- disputes/cancellations only if non-zero
- recent completed trades

Remove repeated “activity” blocks and zero-value clutter.

## Responsive rules

Mobile <= 767:
- native-app composition
- safe-area bottom navigation
- sticky primary actions
- edge-to-edge sections

Desktop >= 1024:
- 1180px application shell
- discovery/list screens use width
- create/edit forms stay 640–720px
- transaction/chat pages may use 2-column layout: content + sticky summary/action rail

## Implementation priority

P0:
1. Shell/navigation
2. Single request creation flow
3. Home
4. My Trades
5. Request detail
6. Offer create/detail
7. Chat transaction hub
8. Shared trade flow shell
9. Profile

P1:
10. Explore polish
11. Edit flow parity
12. Activity/login/404 polish
