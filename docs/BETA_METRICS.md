# DAN V1 베타 지표

초기 20~50명에서 baseline을 모은다. 아래 비율은 성공/실패 기준이 아니다. 표본이 쌓이기 전에는 목표 퍼센트를 만들지 않는다.

계측 provider가 연결되기 전에는 이 문서로 무엇을 셀지만 고정한다. 이벤트 정의는 [ANALYTICS_SPEC.md](./ANALYTICS_SPEC.md).

## Funnel

방문 `landing_view` → 구매수요 `demand_created` → 제안 `quick_offer_created` → 제안 확인 `offer_viewed` → 연결 `match_connected` → 거래 진행 `payment_gate_viewed` 또는 `handoff_started` → 완료 `trade_completed`.

취소 `trade_canceled`는 완료와 따로 센다.

## KPI

분모와 분자만 적는다. 기간은 베타 시작 후 첫 14일 baseline, 그 다음 14일과 비교한다.

| KPI | 계산 |
|-----|------|
| Demand Creation Rate | `demand_created` 사용자 수 / `landing_view` 사용자 수 |
| Demand → ≥1 Offer Rate | 제안이 1건 이상인 demand 수 / `demand_created` 수 |
| Offer View Rate | `offer_viewed`가 있는 demand 수 / 제안이 있는 demand 수 |
| Offer → Connection Rate | `match_connected` 수 / `offer_viewed`가 있는 제안 수 |
| Connection → Trade Progress Rate | `payment_gate_viewed` 또는 `handoff_started` match 수 / `match_connected` 수 |
| Trade Completion Rate | `trade_completed` / `match_connected` |
| Time to First Offer | demand 생성 시각부터 그 demand의 첫 `quick_offer_created`까지의 중앙값 |

카테고리 `product_category`로 끊되, 20명 구간에서는 카테고리별 비율을 성패로 읽지 않는다. 개인과 채팅 내용은 쪼개지 않는다.
