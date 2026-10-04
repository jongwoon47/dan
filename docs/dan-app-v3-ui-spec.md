# DAN App V3 — Real App UI Specification

## Product sentence
DAN is a request-first marketplace: a user posts what they need, another user proposes a price or way to help, and both move through chat into a transaction.

## Scope
Keep all four request types: 구매 / 빌리기 / 심부름 / 서비스.
They share one visual language and one request flow, but each type asks only the fields it actually needs.

## App information architecture
Mobile bottom navigation: 홈 / 탐색 / 요청 / 채팅 / 내 거래.
Profile moves out of bottom navigation and is entered from the account/avatar action.
Desktop: DAN brand / 홈 / 탐색 / 요청 / 채팅 / 내 거래 / profile-account action.

## Core journeys
Requester: 홈·탐색 → 요청 만들기 → 요청 상세 → 제안 비교 → 제안 선택 → 채팅 → 거래 조건 확인 → 결제 → 인계 → 완료.
Supplier/helper: 홈·탐색 → 요청 상세 → 제안 보내기 → 채팅 → 상품·수행 정보 제출 → 거래 조건 확인 → 결제·인계 → 완료.

## Design language
- White-first surfaces.
- Neutral ink typography.
- Purple only for primary action, selected state, and key interactive emphasis.
- Green only for success/verified. Red only for destructive/warning.
- Avoid gradients except subtle brand moments.
- Avoid nested cards. Default structure is typography + row + divider.
- One primary CTA per screen. Secondary actions use text/ghost/overflow.
- Internal technical terms never appear in customer UI.

### Typography
- Page title: 24–28 mobile / 28–34 desktop
- Key price: 28–32 mobile / 32–40 desktop
- Section title: 18–20
- Body: 15–16
- Label/meta: 12–14

### Spacing
- Mobile page horizontal 16px, section gap 24px, row min-height 56px, sticky CTA with safe area.
- Desktop shell max 1180px, form column 640–720px.
- Transactional detail may use 2-column: content 1fr + sticky summary/action rail 320–360px.

## Screen specifications

### 1. 홈
- compact DAN header + notification/avatar
- search: 무엇이 필요하세요?
- home search opens unified 탐색 across 구매 / 빌리기 / 심부름 / 서비스
- current demand list immediately
- no giant marketing hero
- rows show title, amount, location/time, response/search count, chevron

### 2. 탐색
- search at top, compact filters, all four request types
- BUY: product / max price / condition
- BORROW: item / total budget / dates
- TASK: task / reward / time
- SERVICE: need / budget / schedule

### 3. 요청 만들기 — entry
Question: 무엇이 필요하세요?
Four restrained options: 구매 / 빌리기 / 심부름 / 서비스.
The 2×2 type cards appear only on the entry screen. After a type is selected, show one compact current-type control so the form remains focused.

### 4. 요청 만들기 — type-specific step 1
No redundant title field.
- BUY: 제품 / 최대 가격 / 상태 preference
- BORROW: 빌릴 물건 / 총 예산 / optional condition/details
- TASK: 부탁할 일 / 사례금 / optional details
- SERVICE: 필요한 서비스 / 예산 / optional details

### 5. 요청 만들기 — step 2
- location
- date/time
- trade/fulfillment method where relevant
- optional notes
- review summary
- primary CTA: 요청 올리기

### 6. 내 요청 상세
- hero: request type / title / key amount / location-time
- received offers/responses first
- edit/close in overflow or secondary text action
- empty state explains what happens next

### 7. 수요 상세
- requester context + action for supplier/helper
- BUY: product / buyer max price / location-trade method / buyer list if aggregated
- other types: requested task/service/borrow conditions
- primary CTA: 제안 보내기

### 8. 제안 보내기
- amount/terms first
- only essential fields visible by default
- BUY: 판매가 / 상태 / 거래 방법 / optional photo-note
- BORROW-TASK-SERVICE: proposed amount / availability / concise note
- primary CTA: 제안 보내기

### 9. 받은 제안 목록
- comparison-first
- row: counterpart trust / price / key condition / budget delta / trade method
- whole row tappable, no giant per-row CTA

### 10. 제안 상세
- counterpart / key price / condition / method / short note / concise trust facts
- primary CTA: 이 제안으로 거래하기

### 11. 채팅
Chat is the transaction hub.
- header: counterpart / item-request / price / overflow
- transaction banner shows only current next action
- messages dominate the page

### 12. 상품·수행 정보 확인
- photo/evidence first
- compact fact rows
- one disclaimer
- primary CTA: 확인했어요

### 13. 거래 조건 확인
- concise summary: item-request / agreed price / location / date-time / method / counterpart
- status: 내가 확인함 / 상대 확인 대기
- primary CTA: 거래 조건 확인

### 14. 결제
- amount / payment method / compact safety explanation
- no Demo / staging / test-environment customer copy
- primary CTA: 결제하기

### 15. 인계
- current task first
- checklist only if useful
- primary CTA: 인계 완료

### 16. 거래 완료
- compact success state
- receipt-like summary
- primary: 거래 내역 보기
- secondary: 상대 프로필

### 17. 내 거래
Tabs: 진행 중 / 내가 올린 요청 / 완료.
Rows: title / counterpart / amount / current next action.
Do not expose DB concepts such as sell-intents as top-level IA.

### 18. 프로필
- identity / verification / completed trades / completion rate / disputes
- hide zero-value noise when not useful

### 19. 알림
- offer / connection / chat / transaction categories
- clear unread state
- concise relative time

### 20. 로그인
- simple form
- clear sign-up / password reset routes
- no oversized marketing copy

## Internal terminology mapping
- Demand → 요청 / 찾는 사람
- Quick Offer → 제안
- Match → 거래 연결
- Evidence → 상품 정보 / 확인 정보
- Deal Snapshot → 거래 조건
- Handoff → 인계
- Safe Payment → 결제

## Responsive behavior
### Mobile
- bottom nav for root screens
- deep screens use top back header
- primary CTA sticky when action is required
- avoid table-like layouts
- no horizontal overflow
- touch targets >=44px

### Desktop
- Home/Explore/My use full 1180px shell
- Create uses centered 680–720px form
- Transaction detail/chat may use 2-column with sticky summary/current action

## Implementation rules
- Preserve existing domain logic, RPC boundaries, and Supabase contracts.
- Prefer shared primitives rather than page-specific duplicated CSS.
- Merge /buy/new UX into /create?type=BUY; old route may redirect.
- Merge SellIntent visual flow with QuickOffer where possible.
- Keep all four request types supported.
- Do not change production or remote DB as part of this UI branch.