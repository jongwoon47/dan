# DAN V1 analytics contract

수집 업체는 연결되어 있지 않다. 앱은 `NoopAnalyticsProvider`만 켠다. 나중에 `configureAnalytics(provider)`에 provider를 넘기면 된다.

채팅 본문, 이메일, 이름, 전화번호, 주소, 시리얼, 증거 메모는 속성으로 보내지 않는다. `sanitizeAnalyticsProps`는 허용된 키만 남기고, 공백이나 `@`가 있는 값과 80자를 넘는 값은 버린다.

## 이벤트

| 이벤트 | 속성 |
|--------|------|
| `landing_view` | `source` |
| `signup_completed` | `source` |
| `login_completed` | `source` |
| `discovery_view` | `source`, `product_category` |
| `discovery_search` | `source`, `product_category` |
| `demand_create_started` | `source`, `product_category`, `product_id` |
| `demand_created` | `product_category`, `product_id`, `demand_id`, `fulfillment_type`, `source` |
| `demand_shared` | `demand_id`, `product_id`, `source` |
| `quick_offer_started` | `demand_id`, `product_id`, `source` |
| `quick_offer_created` | `demand_id`, `product_id`, `fulfillment_type`, `source` |
| `offer_viewed` | `demand_id`, `product_id`, `match_id`, `source` |
| `interest_created` | `demand_id`, `match_id`, `product_id` |
| `match_connected` | `demand_id`, `match_id`, `product_id` |
| `chat_message_sent` | `match_id` |
| `seller_evidence_submitted` | `match_id`, `product_id` |
| `deal_snapshot_locked` | `match_id`, `demand_id`, `product_id` |
| `payment_gate_viewed` | `match_id`, `source` |
| `handoff_started` | `match_id`, `fulfillment_type` |
| `trade_completed` | `match_id`, `demand_id`, `product_category` |
| `trade_canceled` | `match_id`, `demand_id`, `source` |

허용 키는 `product_category`, `product_id`, `demand_id`, `match_id`, `source`, `fulfillment_type`뿐이다. 검색어 원문은 `discovery_search`에 넣지 않는다. 카테고리만 남긴다.

화면에서 이 이벤트를 호출하는 계측은 아직 없다. provider를 고른 뒤 위 이름만 호출하면 된다.
