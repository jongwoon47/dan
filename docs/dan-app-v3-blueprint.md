# DAN App V3 — Product & UX Blueprint

## Product sentence
필요한 걸 요청하면, 맞는 사람이 제안한다.

## Primary loop
요청 → 제안 비교 → 연결/채팅 → 거래 조건 확인 → 결제 → 인계 → 완료

## Request types
DAN V3 keeps all four request types as first-class flows.

| Type | Step 1 | Step 2 |
| --- | --- | --- |
| 구매 | 제품, 최대 가격, 상태 | 택배/직거래, 직거래 지역 |
| 빌리기 | 물건, 총 예산 | 장소, 시작/종료, 추가 조건 |
| 심부름 | 부탁 내용, 사례금 | 방식, 장소/경로, 시간 |
| 서비스 | 필요한 도움, 예산, 예상 시간 | 대면/원격, 장소, 일정 |

No duplicate generic title field when the request body already supplies the title.

## Mobile navigation
홈 / 탐색 / 요청 / 채팅 / 내 거래

- 요청 is the center action.
- Profile is reached from 내 거래/header.
- Deep transaction screens use a back header and do not duplicate root navigation.

## Screen contracts

### Home
Goal: start a request or discover active demand within seconds.
Priority:
1. What do you need?
2. Four request-type shortcuts
3. Active product demand
4. Secondary seller discovery

### Explore
Goal: find a request the user can satisfy.
- Search first.
- Compact filters.
- Price + active seeker count are primary for product demand.
- No internal wording such as Live Demand.

### Create
Goal: finish a valid request with minimum typing.
- One route: /create.
- /buy/new only redirects to /create?type=BUY.
- Question-first copy.
- Two phases only.
- Sticky primary CTA on mobile.
- Desktop form stays focused rather than stretching full width.

### My request detail
Goal: see what matters now.
- Request summary is compact.
- Received offers/responses are the main content.
- Edit/close are secondary actions.

### Offer
Goal: compare and decide quickly.
Priority:
1. Offered price
2. Condition
3. Fulfillment
4. Seller trust
5. Optional notes/photo
Primary CTA: 이 판매자와 거래하기.

### Chat
Goal: be the home of a connected transaction.
- Conversation dominates the screen.
- A single compact banner indicates the next transaction action.
- Transaction state never overwhelms messages.

### Product information / evidence
Goal: inspect seller-submitted facts.
- Evidence itself comes before explanation.
- DAN disclaimer is concise.
- Internal terms such as Evidence or Quick Offer are hidden.

### Transaction conditions
Goal: confirm the exact deal.
- Product, price, condition, fulfillment, appointment.
- Seller details can expand.
- Each party's confirmation is compact.
- No internal term Deal Snapshot.

### Payment
Goal: understand total and pay safely.
- Agreed amount is primary.
- Payment method is secondary.
- Test/demo wording is not presented as product vocabulary.

### Handoff
Goal: check the item and confirm handoff.
- Keep prior transaction details collapsed/compact.
- Current action is dominant.
- Dispute/help is secondary.

### Completion
Goal: close the loop.
- Small success state.
- Receipt-like summary.
- Primary: transaction history.
- Secondary: other party profile.

### My trades
Goal: manage everything the user has requested or is trading.
- All BUY/BORROW/TASK/SERVICE requests appear.
- Request type, price/budget, fulfillment, status, offer count.
- Avoid BUY-only terminology.

### Profile
Goal: answer “can I trust this person?” quickly.
Priority:
1. Identity / area
2. Verified status
3. Completed transactions
4. Cancellation/dispute facts
5. Recent transactions
Zero-value noise should be minimized.

## Visual system
- White base.
- Dark neutral text.
- Light neutral dividers.
- Purple only for primary action and selected state.
- Green for completed/verified states.
- Red for destructive actions.
- Prefer rows/dividers to nested cards.
- One visually dominant CTA per screen.
- No gradients or decorative panels unless they clarify hierarchy.

## Responsive rules
### Mobile
- 16px horizontal padding.
- Bottom navigation on root screens.
- Sticky CTA where completing a flow is the primary action.
- Safe-area aware.
- No horizontal overflow at 320/390/430.

### Desktop
- 1180px application shell.
- Discovery/home can use wide content.
- Forms stay about 680–720px.
- Transaction/detail screens may use a focused main column and summary rail.
- Never render a phone-width page merely centered inside a desktop canvas.

## Copy rules
User-visible UI must not expose:
- Live Demand
- Quick Offer
- Deal Snapshot
- Evidence
- Safe Handoff
- internal status names

Use:
- 요청
- 판매 제안
- 상품 정보
- 거래 조건
- 결제
- 물품 인계
- 거래 완료
