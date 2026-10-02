# DAN Product Spec — Demand-First Marketplace

이 문서는 DAN V1의 제품·UX 기준(source of truth)이다.
구현 세부사항이 다른 문서와 충돌하면, 보안/결제 경계를 제외한 제품 흐름은 이 문서를 우선해 정렬한다.

## 1. Product thesis

DAN은 판매글을 먼저 만드는 marketplace가 아니다.

> 사고 싶은 사람이 조건을 먼저 공개하고, 가진 사람이 살아 있는 수요에 응답하며,
> 거래가 가까워질수록 사실 기반 신뢰와 거래 조건을 구조화하는 demand-first marketplace.

핵심 심리적 순간은 판매자가 Live Demand를 보고
“내가 가진 걸 지금 원하는 사람이 있네”라고 느낀 뒤 빠르게 제안하는 것이다.

## 2. Canonical BUY flow

```text
Live Demand
→ 제품별 수요 집계
→ 개별 구매수요 확인
→ 특정 구매자 또는 제품 전체 수요에 Quick Offer
→ 구매자 Interest
→ 판매자 Connect
→ Chat
→ Seller Evidence
→ Deal Snapshot
→ Safe Payment
→ Handoff
→ Complete / Dispute
→ Trust History
```

### 순서 불변 규칙

- Quick Offer 전에 상세 Evidence를 강제하지 않는다.
- 구매자 Interest 이후 판매자가 Connect하면 채팅이 열린다.
- 상세 Evidence는 Connect/Chat 이후, 실제 Deal 진행 전에 제출한다.
- Evidence 없이는 Deal Snapshot을 만들거나 잠글 수 없다.
- 양쪽이 같은 Deal Snapshot을 확인하기 전에는 결제로 넘어가지 않는다.
- 서버가 결제 완료를 확인하기 전에는 인계 단계가 열리지 않는다.
- 분쟁이 열려 있으면 완료 처리를 막는다.

## 3. Home / Live Demand

홈의 주인공은 판매 매물이 아니라 현재 구매수요다.

필수 정보:
- 제품
- 찾는 사람 수
- 최근 수요 변화
- 최고 구매 희망가
- 거래 방식 요약

제품별 수요를 먼저 집계하고, 제품 상세에서 공개 가능한 개별 구매수요를 보여준다.
판매자는 특정 구매수요를 선택해 제안할 수 있고, 필요하면 제품 전체 수요에 일반 Quick Offer도 보낼 수 있다.

## 4. BUY demand creation

입력은 두 단계, 마지막은 확인 화면이다.

### Step 1 — 제품
- 기존 카탈로그 검색
- 없으면 이름 + 카테고리로 open catalog 생성

### Step 2 — 조건
- 최대 구매 희망가 — 필수
- 상태 선호 — 선택
- 거래 방식 — 직거래 / 택배 / 둘 다
- 직거래 지역 — 직거래 포함 시 필수
- 추가 조건 — 선택

### Step 3 — 확인
새 정보를 요구하지 않는다.
제품·가격·상태·거래방식·지역·추가조건을 보여주고 수정 또는 게시만 제공한다.

공개 Live BUY는 phone verification을 통과한 실제 계정만 허용한다.

## 5. Quick Offer

Quick Offer의 목적은 판매자의 첫 진입 마찰을 최소화하는 것이다.

필수:
- 물품 상태
- 희망 판매가

선택:
- 거래 방식
- 한 줄 상태 메모
- 카테고리별 간단 사용량
- 현재 사진 1장

Quick Offer 사진은 선택이다.
사진을 올리는 경우 private evidence storage 규칙을 따른다.

특정 구매수요를 골랐다면 `targetDemandId`를 고정한다.
해당 수요와 제품/가격/상태/거래방식이 호환되지 않으면 Match 또는 Connect를 허용하지 않는다.

## 6. Interest / Connect / Chat

구매자는 제안 상세에서 가격·상태·판매자 Trust History를 보고 Interest를 표시한다.

판매자는 BUYER_INTERESTED 상태에서 Connect한다.
Connect 시 서버는 다시 확인한다:
- 수요가 ACTIVE이고 만료되지 않았는가
- 제품이 같은가
- target demand가 맞는가
- 가격이 구매자 상한 이내인가
- 상태 조건을 충족하는가
- 거래 방식이 호환되는가
- block 관계가 없는가
- 판매자가 필요한 verification을 완료했는가

Connect 직후 상태는 `EVIDENCE_PENDING`이며 채팅이 즉시 가능하다.

채팅의 BUY 진행 단계:
```text
증거 → 조건 → 결제 → 인계
```

## 7. Seller Evidence

Evidence는 Quick Offer와 분리한다.

핵심 목적:
1. 현재 물건을 실제로 보유했다는 증거
2. 거래에 중요한 상태 사실 기록

촬영 challenge code와 실제 물품이 함께 보이는 사진을 사용한다.
세부 항목:
- 현재 보유 사진
- 식별번호 일부(선택)
- 사용량/컷수(해당 시)
- 구매일/보증
- 구성품
- 외관
- 알려진 기능 이상
- 수리 이력
- 물손상 등 카테고리별 중요 정보

DAN은 제출된 사진만으로 정품이나 상태를 보증하지 않는다.
“누가 언제 어떤 사실과 증거를 제출했는지”를 기록한다.

## 8. Deal Snapshot

Deal Snapshot은 채팅의 기억이 아니라 최종 거래 조건의 canonical record다.

서버가 canonical하게 고정하는 정보:
- 제품
- Quick Offer 가격
- Seller Evidence
- 수요의 허용 거래방식

양측이 합의해 넣는 정보:
- 최종 거래 방식
- 직거래 장소
- 직거래 시간

직거래면 장소와 시간이 필수다.
한쪽이 잠기기 전 조건을 변경하면 기존 상대 확인은 무효가 되어 다시 확인해야 한다.
양쪽 확인 후 Snapshot은 immutable하게 잠긴다.

## 9. Payment boundary

Production에서는 실제 PG와 서버 webhook 검증이 연결되기 전까지 브라우저가 PAID를 만들 수 없다.

- demo에서만 결제 시뮬레이션 가능
- Supabase/production client는 임의 PAID 변경 불가
- locked Snapshot 이후에만 결제 진입
- 서버 확인 후에만 Handoff open

실제 PG가 없으면 안전 gate를 유지하며 결제를 된 것처럼 표현하지 않는다.

## 10. Handoff / Dispute / Completion

Handoff 화면은 잠긴 Snapshot을 그대로 대조한다.
직거래라면 장소·시간까지 보여준다.

구매자: 실제 물품 확인 후 수령 확인.
판매자: 실제 인도 완료 후 전달 확인.
양쪽 확인이 완료되어야 거래 완료.

문제가 있으면 완료보다 먼저 분쟁을 연다.
대표 사유:
- 다른 물건
- Snapshot 불일치
- 고지되지 않은 큰 하자
- 미수령
- 기타

완료 화면은 일회성 축하 화면이 아니라 최소한의 거래 영수증 역할을 한다:
- 제품
- 거래 금액
- 완료일
- 상대
- Trust History 반영 상태

## 11. Trust History

별점 하나로 사람을 평가하지 않는다.
확정된 사실 기록을 보여준다.

- 거래 완료
- 판매자 귀책 취소
- 구매자 귀책 취소
- 확정 상태 불일치
- 미해결 분쟁
- 검증 배지

사용자 신고만으로 귀책 사실을 공개 기록하지 않는다.
AI가 임의 신뢰 점수나 “좋은/나쁜 판매자” 판단을 만들지 않는다.

## 12. Navigation

모바일 5탭:
```text
홈 / 내 구매수요 / 등록 / 채팅 / 프로필
```

등록은 구매수요 생성의 가장 빠른 진입점이다.

## 13. Visual direction

- mobile-first
- 흰색/아주 옅은 중립 배경
- 보라·블루 accent
- 실제 제품 visual이 주인공
- 둥근 카드와 충분한 여백
- 한 화면에 너무 많은 설명을 몰아넣지 않음
- 핵심 가격·수요·상태를 텍스트 위계로 명확하게 표시

프리미엄 느낌은 장식보다 정보의 질서와 여백에서 만든다.

## 14. Non-negotiable safety boundaries

- staging/production에서 demo fallback 금지
- browser에 service_role 또는 secret key 금지
- production Supabase/staging Supabase 혼선 금지
- private Evidence 공개 bucket 금지
- Snapshot 전에 Evidence 우회 금지
- client-side PAID 조작 금지
- 인증 provider/PG가 없으면 가짜 성공 상태 금지

## 15. External dependencies that are not faked

코드만으로 완료했다고 주장하지 않는다:
- real verification provider / trusted operations process
- real payment provider + server webhook
- analytics provider
- real staging infrastructure and two-user validation

이 외부 의존성이 연결되기 전까지 해당 화면은 명시적 안전 gate 상태를 유지한다.
