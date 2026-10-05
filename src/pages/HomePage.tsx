import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDan } from "@/domain/danContext";
import "./pages.css";
import "@/components/feedCards.css";

const REQUEST_TYPES = [
  { type: "BUY", label: "구매", desc: "사고 싶은 물건", mark: "₩" },
  { type: "BORROW", label: "빌리기", desc: "잠깐 필요한 물건", mark: "↔" },
  { type: "TASK", label: "심부름", desc: "대신 해줄 일", mark: "✓" },
  { type: "SERVICE", label: "서비스", desc: "전문적인 도움", mark: "◇" },
] as const;

export function HomePage() {
  const { demandFeed, currentUser } = useDan();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const liveProducts = useMemo(
    () =>
      demandFeed
        .filter((item) => item.kind === "aggregated" && item.aggregate.seekerCount > 0)
        .sort((a, b) => {
          if (a.kind !== "aggregated" || b.kind !== "aggregated") return 0;
          return (
            b.aggregate.seekerCount - a.aggregate.seekerCount ||
            b.aggregate.recent7dDelta - a.aggregate.recent7dDelta ||
            b.aggregate.highestIntentPrice - a.aggregate.highestIntentPrice
          );
        })
        .slice(0, 6),
    [demandFeed],
  );

  return (
    <div className="page-stack home-page home-page--app">
      <header className="app-home-header">
        <div>
          <span className="app-home-header__brand">DAN</span>
          <h1>
            {currentUser?.name ? `${currentUser.name}님, ` : ""}
            무엇이 필요하세요?
          </h1>
          <p>필요한 걸 먼저 올리면, 가능한 사람이 제안해요.</p>
        </div>
        {currentUser ? (
          <Link to={`/profile/${currentUser.id}`} className="app-home-header__profile" aria-label="프로필">
            {currentUser.name.trim().slice(0, 1) || "나"}
          </Link>
        ) : (
          <Link to="/login" className="app-home-header__profile app-home-header__profile--guest" aria-label="로그인">
            로그인
          </Link>
        )}
      </header>

      <form
        className="app-home-search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = query.trim();
          navigate(value ? `/create?type=BUY&q=${encodeURIComponent(value)}` : "/create");
        }}
      >
        <span aria-hidden>⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="물건, 심부름, 서비스를 요청해보세요"
          aria-label="무엇이 필요하세요?"
        />
        <button type="submit" aria-label="구매수요 만들기">요청</button>
      </form>

      <section className="app-request-types" aria-labelledby="home-request-type-title">
        <div className="app-section-head">
          <h2 id="home-request-type-title">요청하기</h2>
          <span>필요한 방식부터 골라보세요</span>
        </div>
        <div className="app-request-type-grid">
          {REQUEST_TYPES.map((item) => (
            <Link key={item.type} to={`/create?type=${item.type}`} className="app-request-type-card">
              <span className="app-request-type-card__mark" aria-hidden>{item.mark}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </span>
              <i aria-hidden>›</i>
            </Link>
          ))}
        </div>
      </section>

      <section className="app-live-demand">
        <div className="app-section-head app-section-head--row">
          <div>
            <h2>지금 찾는 물건</h2>
            <span>가격을 먼저 걸어둔 구매 요청이에요</span>
          </div>
          <Link to="/feed">전체보기</Link>
        </div>

        {liveProducts.length === 0 ? (
          <EmptyState
            title="아직 올라온 구매 요청이 없어요"
            body="찾는 물건을 먼저 요청해보세요."
            action={<Button to="/create?type=BUY">구매 요청하기</Button>}
          />
        ) : (
          <div className="live-demand-list app-live-demand__list">
            {liveProducts.map((item) =>
              item.kind === "aggregated" ? (
                <AggregatedDemandCard
                  key={item.id}
                  product={item.product}
                  aggregate={item.aggregate}
                />
              ) : null,
            )}
          </div>
        )}
      </section>

      <section className="app-home-seller-prompt">
        <div>
          <strong>가지고 있는 물건을 찾는 사람이 있나요?</strong>
          <span>판매글을 만들지 않고 원하는 사람에게 바로 가격을 제안할 수 있어요.</span>
        </div>
        <Button to="/feed" variant="secondary">수요 둘러보기</Button>
      </section>
    </div>
  );
}
