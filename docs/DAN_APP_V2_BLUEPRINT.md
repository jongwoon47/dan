# DAN App V2 — Product & UX Blueprint

## Product sentence
필요한 사람이 먼저 요청을 올리고, 가능한 사람이 제안해 거래까지 이어지는 앱.

DAN V2 supports four request types equally:
- 구매
- 빌리기
- 심부름
- 서비스

The product is not organized around internal entities such as demand, ownership, sell intent, match, snapshot, evidence, or handoff. Those remain implementation details only.

## Core user flows

### Requester
요청 만들기 → 제안 받기 → 비교 → 상대 선택 → 채팅 → 조건 확인 → 결제/인계 → 완료

### Responder
탐색 → 요청 선택 → 제안 → 연결 → 채팅 → 필요한 정보 제출 → 조건 확인 → 결제/인계 → 완료

## Mobile navigation
1. 홈
2. 탐색
3. 요청
4. 채팅
5. 내 거래

Profile lives from the top-right user affordance / My area rather than consuming a primary bottom tab.

## UX rules
- One primary action per screen.
- Price / reward / budget is visually dominant where relevant.
- Row + divider first. Cards only for a real grouped object.
- Purple only for primary action and selected state.
- User-facing Korean only; hide internal English/product-engineering terms.
- Chat becomes the transaction hub after connection.
- Reuse one transaction shell for 조건 확인 / 결제 / 인계 / 완료.
- Mobile-first native-app composition; desktop gets a separate web composition.
- Avoid duplicate data entry. Generated request titles should come from the meaningful object/task field.
- Optional details stay collapsed or secondary until needed.

## Request creation

There is one canonical creation entry: /create.

### Type selection
Question: "무엇이 필요하세요?"
Options:
- 구매 — 사고 싶은 물건이 있어요
- 빌리기 — 잠깐 빌리고 싶어요
- 심부름 — 대신 해줬으면 하는 일이 있어요
- 서비스 — 전문가의 도움이 필요해요

### 구매
Step 1:
- 제품
- 최대 가격
- 희망 상태
Step 2:
- 택배 / 직거래
- 직거래 지역 if needed
- 추가 조건 optional
Generated title = product name.

### 빌리기
Step 1:
- 빌릴 물건
- 전체 예산
- optional short condition
Step 2:
- 기간
- 위치 / 전달 방식
- 추가 조건 optional
Generated title = item name.

### 심부름
Step 1:
- 부탁할 일
- 사례금
Step 2:
- 위치
- 원하는 날짜/시간
- 추가 메모 optional
Generated title = concise task text.

### 서비스
Step 1:
- 원하는 서비스
- 예산
Step 2:
- 지역 / 온라인
- 원하는 일정
- 추가 조건 optional
Generated title = service task.

Legacy /buy/new remains only as a compatibility redirect into /create?type=BUY.

## Screen map

### Home
Purpose: get to active needs immediately.
- compact DAN header + notification/profile
- universal prompt: "무엇이 필요하세요?"
- shortcut for four request types
- "지금 올라온 요청" list
- price/reward + type + area/time shown in each row
- minimal marketing copy

### Explore
- search
- request type chips
- category/filter only when useful
- sort
- mixed request list
- request creation CTA only in empty state

### Request detail
- request type badge
- title/object/task
- price/reward/budget
- location/time/trade method
- requester trust line
- primary responder CTA
Owner view:
- number of received offers/responses
- offer list is the first section
- edit/close under overflow

### Proposal detail
- responder identity/trust
- price/reward proposal
- relevant condition/method
- optional media/details
- one CTA: "이 제안 선택하기" / "이 사람과 거래하기"

### Chat
- peer + concise transaction summary
- messages
- one transaction-state banner at top
- banner deep-links to the current next action
- no large transaction dashboard inside chat

### Transaction shell
Common header:
- item/task
- agreed price/reward
- peer
Progress:
연결 → 조건 → 결제/약속 → 인계 → 완료

Each page shows only the current action.

### Evidence / item information
User title: "상품 정보 확인"
- submitted photo(s)
- factual rows
- one short disclaimer
- confirmation CTA

### Condition confirmation
User title: "거래 조건 확인"
- price
- item/task
- method
- place
- time
- peer
- one confirmation CTA
- after both confirm, conditions lock

### Payment
No user-visible "Demo checkout".
- payment amount first
- payment method compact selection
- concise safety note
- pay CTA
Development/staging state appears only as a subtle developer badge, never as content hierarchy.

### Handoff
- what to check now
- item/task checklist
- completion CTA
- dispute/report secondary

### Completion
- compact success state
- receipt-like summary
- primary: 거래 내역 보기
- secondary: 상대 프로필

### My transactions
Tabs:
- 진행 중
- 내 요청
- 완료
Rows show:
- object/task
- peer or response count
- amount
- current next action

### Profile
- identity
- area
- verification
- completed trades
- completion rate/fault records if meaningful
- recent completed transaction history
- self edit / other-user overflow
Do not surface redundant internal activity metrics.

## Desktop composition
Home / Explore:
- max 1180px
- wider multi-column discovery

Create:
- left form 620–680px
- right live request preview when space allows

Request detail:
- main request/offer list
- right sticky summary/action rail

Chat:
- conversation main
- right transaction status rail

Transaction pages:
- main current step
- sticky summary rail

Profile / My:
- wider structured lists, not stretched mobile cards.

## Visual system
- Background: #FFFFFF / #F7F7F9 only where separation is needed
- Ink: #17171B
- Secondary: #5F606A
- Divider: #E8E8ED
- Purple action: #5C45E8
- Purple soft: #F1EEFF
- Success: #16805C
- Danger: #B42318
- Radius: 10–14px normal, 16–18px large grouped surfaces
- No decorative gradients in product UI
- Shadows almost never
- Buttons: 48–52px
- Mobile horizontal padding: 16px
- Mobile title: 22–26px
- Important amount: 24–30px

## Release acceptance
- purchase / borrow / errand / service all supported by canonical /create flow
- no user-facing Demand / Quick Offer / Snapshot / Evidence / Handoff / Demo checkout terminology
- no duplicate create experiences
- mobile bottom nav: 홈 / 탐색 / 요청 / 채팅 / 내 거래
- no horizontal overflow at 320 / 390 / 430
- desktop 1440 composition does not look like a centered phone layout
- current transaction action understandable within 3 seconds
- CI / local two-user E2E / visual QA pass before staging deploy
