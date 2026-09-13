# DAN Two-User E2E Test Plan

## Prerequisites

1. Supabase project with migrations `0001`–`0005` applied
2. Auth: Email provider enabled; confirm email disabled for local test (optional)
3. Local `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. `npm run dev`
5. Two browsers / profiles (User A, User B)

Until credentials exist: treat automated live E2E as **BLOCKED**. Domain unit tests still cover demo lifecycle.

---

## Scenario A — TASK → Response → CONNECTED

1. **A** signs up / logs in
2. **A** Create → TASK: “오늘 평택에서 케이크 받아주실 분”, reward 15000
3. **B** logs in, opens Feed → demand detail
4. **B** “제가 할게요” → Response OPEN
5. **A** My DAN / demand detail → see response → Accept
6. **Expected:** Match `CONNECTED` for both

## Scenario B — BUY → Ownership → SellIntent → Interest → Connect

1. **A** Create → BUY for a seeded product (e.g. iPhone), max budget set
2. **B** Demand detail → Ownership → Sell Intent (compatible price)
3. **A** My DAN matches → POTENTIAL (derived) → Send interest → `BUYER_INTERESTED` row
4. **B** Connect → `CONNECTED`
5. **Expected:** No POTENTIAL row in `matches` table

## Scenario C — Security

1. **B** tries to update **A**’s demand via client → RLS reject
2. Third account cannot SELECT the A–B match → empty / deny
3. **B** cannot call `seller_connect_match` on a pair that is only POTENTIAL (no row) / wrong status → reject

## Automation note

`src/data/supabase/*.integration.test.ts` skips unless live env vars are present. Do not point integration tests at production data.
