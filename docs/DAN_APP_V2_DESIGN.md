# DAN App V2 — Product & UI Design Blueprint

## Product sentence
필요한 것을 먼저 요청하면, 가능한 사람이 가격과 조건을 제안하는 거래 앱.

DAN은 구매만을 위한 앱이 아니다. 아래 4개 요청 유형을 모두 1급 기능으로 유지한다.

- 구매
- 빌리기
- 심부름
- 서비스

사용자에게 내부 객체명(Demand, Quick Offer, Match, Snapshot, Handoff, Sell Intent, Ownership)을 노출하지 않는다.

## Core loop

### 요청자
요청 만들기 → 제안 받기 → 비교 → 한 명 선택 → 채팅 → 조건 확인 → 결제/인계 → 완료

### 제안자
탐색 → 요청 확인 → 제안 → 연결 → 채팅 → 필요한 정보 제출 → 조건 확인 → 인계 → 완료

## Navigation

### Mobile
1. 홈
2. 탐색
3. 요청(+)
4. 채팅
5. 내 거래

프로필/설정/알림은 상단 또는 내 거래에서 진입한다.

### Desktop
상단 navigation:
홈 / 탐색 / 요청하기 / 채팅 / 내 거래

거래 상세 화면은 필요할 때:
- left: primary content
- right: sticky transaction summary/action rail

## Design rules

### Visual
- Background: white / near-white
- Text: ink black
- Secondary: neutral gray
- Divider-first composition
- Purple only for primary CTA, selected state, active progress
- Green only for completed/safe
- Red only for destructive/risk
- Shadows almost none
- Nested cards prohibited unless grouping is semantically necessary
- No decorative gradients in core transactional UI

### Typography
- Page title: 24–28 mobile, 28–34 desktop
- Section title: 18–20
- Body: 15–16
- Label: 13–14
- Price: 24–32
- Transaction status: short sentence, not dashboard-like metrics

### Interaction
- One primary action per screen
- Destructive actions behind overflow menu
- Whole row/card tappable where possible
- Mobile primary action may be sticky
- Avoid duplicate inputs and duplicate summaries
- Do not ask for a separate title when content itself can become the title
- Optional details collapsed by default

## Request creation

One user-facing flow only: /create

/buy/new must redirect into /create?type=BUY or reuse the same component.

### Step 0: type
What do you need?
- 구매
- 빌리기
- 심부름
- 서비스

### BUY
Step 1:
- 제품
- 최대 가격
- 상태 preference

Step 2:
- 택배 / 직거래
- 직거래 지역
- 추가 조건 optional

Auto title = product name.

### BORROW
Step 1:
- 빌릴 물건
- 전체 예산
- 필요한 기간

Step 2:
- 장소/전달 방식
- 추가 조건 optional

Auto title = item name.

### TASK
Step 1:
- 부탁할 일
- 사례금
- 수행 방식: 현장 / 픽업 / 이동 / 비대면

Step 2:
- 장소 / 경로
- 원하는 시간
- 추가 설명 optional

Auto title from task summary.

### SERVICE
Step 1:
- 원하는 서비스
- 예산
- 현장 / 비대면

Step 2:
- 장소
- 원하는 시간
- 추가 조건 optional

Auto title from service summary.

## Home
Home is a utility screen, not a marketing landing page.

Mobile:
- DAN + notifications
- search / intent field
- quick type chips
- "지금 올라온 요청"
- compact list
- one small CTA to create request

Desktop:
- search + filters
- request types
- live demand/request grid
- wider layout

## Discovery
Must include all request types, not only product demand.

Filters:
- 전체 / 구매 / 빌리기 / 심부름 / 서비스
- category/context filters only when relevant
- sort compactly

Rows emphasize:
- request title
- price/reward/budget
- location/time
- request type
- response count / urgency only if meaningful

## My Requests / Request Detail
Request detail hero:
- title
- budget/reward/price
- location/time/trade method
- status

Then:
- received offers/responses first
- edit/close are secondary actions
- close in overflow where possible

Type-specific detail rendering.

## Proposal / Offer
Proposal list compares:
1. price
2. condition/capability
3. trade method/location
4. trust
5. fit versus requester's budget

Offer detail CTA:
- 구매/빌리기: "이 사람과 거래하기"
- 심부름/서비스: "이 사람에게 맡기기"

No ambiguous "관심 있어요".

## Chat = transaction hub
After a proposal is accepted, chat becomes the central transaction screen.

Top compact transaction strip:
- counterpart
- request title
- agreed price/reward

Dynamic action banner:
- 상품 정보 확인
- 거래 조건 확인
- 결제
- 인계
- 완료

Do not force users to navigate a dashboard of transaction stages.

## Evidence / Information
User-facing name depends on type:
- 구매/빌리기: 상품 정보 확인
- 심부름/서비스: 수행 정보 확인

Information first, disclaimer second.
No internal word Evidence.

## Transaction confirmation
User-facing name: 거래 조건 확인

Show only:
- item/task/service
- price/reward
- method
- location
- date/time
- counterpart

Both-party confirmation state inline.
No internal Snapshot wording.

## Payment
Production-shaped UI even in staging.
Demo indicator must be developer-only, not primary content.

- total
- payment method
- safety copy
- one CTA

## Handoff
User-facing:
- 물건 거래: 물건 확인 / 인계 확인
- task/service: 수행 확인

Compact progress at top.
One primary action.

## Complete
Small success state.
Receipt-like summary.
Actions:
- 거래 내역
- 상대 프로필
- 홈 (text)

## My DAN
Rename user-facing title to "내 거래".

Tabs:
- 진행 중
- 내가 올린 요청
- 완료

Do not expose system buckets such as "받은 제안 / 판매 제안" as top-level IA; surface them inside requests or active transactions.

## Profile
Self profile:
- identity
- verification
- completed transactions
- completion rate
- disputes
- transaction history
- edit/settings

Other profile:
- identity
- verification
- completed transactions
- completion rate
- disputes
- recent transaction history
- report/block in overflow

Hide meaningless zero metrics if they add no signal.

## Copy rules
No customer-facing English system terms:
- Live Demand -> 지금 올라온 요청 / 찾는 사람들
- Quick Offer -> 제안하기
- Deal Snapshot -> 거래 조건 확인
- Evidence -> 상품 정보 / 수행 정보
- Safe Handoff -> 인계 확인
- Match -> 연결 / 거래
- Demand -> 요청

## Responsive
### Mobile <= 767
- edge-to-edge
- 16px horizontal padding
- bottom nav
- sticky primary actions when useful
- cards minimized
- safe-area support

### Tablet 768–1023
- mobile information architecture
- wider content
- non-sticky actions when appropriate

### Desktop >= 1024
- top navigation
- no bottom nav
- home/discovery 1080–1180 content
- create 720–900 depending preview
- transaction pages 2-column where useful
- never stretch a mobile single column to desktop width

## Implementation order
P0:
1. navigation
2. unified create
3. home/discovery terminology + structure
4. my transactions
5. request detail
6. offer detail
7. chat transaction hub
8. evidence / confirmation / payment / handoff
9. profile

P1:
10. edit flow
11. activity
12. empty/error/not-found states
13. final desktop polish

## Acceptance
- All 4 request types remain fully supported.
- /create is the canonical creation surface.
- No duplicate BUY creation UX.
- No internal English terms in customer-facing core flow.
- Mobile and desktop feel intentionally designed, not resized.
- One strong CTA per transactional screen.
- No horizontal overflow at 320 / 390 / 430.
- 1440 desktop does not look like centered mobile UI.
