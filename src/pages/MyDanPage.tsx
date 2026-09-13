import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MatchList } from "@/components/MatchCard";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipGroup } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { CONDITION_LABEL } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

type Tab = "overview" | "demands" | "owned" | "selling" | "matches";

export function MyDanPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "overview";
  const {
    isLoggedIn,
    login,
    currentUser,
    myDemands,
    myOwnerships,
    mySellIntents,
    myMatches,
    getProduct,
    getAggregate,
    resetDemo,
  } = useDan();

  const newMatches = myMatches.filter(
    (m) => m.status === "POTENTIAL" || m.status === "BUYER_INTERESTED",
  ).length;

  const stats = useMemo(
    () => [
      { key: "demands" as const, label: ko.statDemands, value: myDemands.length },
      { key: "owned" as const, label: ko.statOwned, value: myOwnerships.length },
      {
        key: "selling" as const,
        label: ko.statSelling,
        value: mySellIntents.filter((s) => s.status === "OPEN").length,
      },
      { key: "matches" as const, label: ko.statMatches, value: newMatches },
    ],
    [myDemands.length, myOwnerships.length, mySellIntents, newMatches],
  );

  if (!isLoggedIn) {
    return (
      <EmptyState
        title={ko.needLogin}
        body={ko.needLoginBody}
        action={<Button onClick={() => login()}>{ko.demoLogin}</Button>}
      />
    );
  }

  function setTab(next: Tab) {
    setParams(next === "overview" ? {} : { tab: next });
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">{ko.myDan}</h1>
        <p className="section-desc">
          {currentUser?.name}
          {ko.myDescSuffix}
        </p>
      </header>

      <div className="stats-grid">
        {stats.map((s) => (
          <button key={s.key} type="button" className="stat-card" onClick={() => setTab(s.key)}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </button>
        ))}
      </div>

      <ChipGroup>
        {(
          [
            ["overview", ko.tabOverview],
            ["demands", ko.tabDemands],
            ["owned", ko.tabOwned],
            ["selling", ko.tabSelling],
            ["matches", ko.tabMatches],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <Chip key={key} selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </Chip>
        ))}
      </ChipGroup>

      {tab === "overview" ? (
        <Card className="section-stack">
          <h2 className="section-title">{ko.quickStart}</h2>
          <div className="btn-row wrap">
            <Button to="/create">{ko.ctaCreate}</Button>
            <Button to="/feed" variant="secondary">
              {ko.navFeed}
            </Button>
            <Button variant="ghost" onClick={resetDemo}>
              {ko.resetDemo}
            </Button>
          </div>
          {newMatches > 0 ? (
            <p className="section-desc">
              {ko.newMatchesPrefix}
              {newMatches}
              {ko.newMatchesSuffix}{" "}
              <button type="button" className="text-link" onClick={() => setTab("matches")}>
                {ko.check}
              </button>
            </p>
          ) : (
            <p className="section-desc">{ko.matchHint}</p>
          )}
        </Card>
      ) : null}

      {tab === "demands" ? (
        myDemands.length === 0 ? (
          <EmptyState
            title={ko.noDemands}
            body={ko.noDemandsBody}
            action={<Button to="/create">{ko.ctaCreate}</Button>}
          />
        ) : (
          <div className="section-stack">
            {myDemands.map((d) => {
              const product = getProduct(d.productId);
              const agg = getAggregate(d.productId);
              const matched = myMatches.some((m) => m.demandId === d.id);
              if (!product) return null;
              return (
                <Card key={d.id} className="my-row">
                  <ProductVisual product={product} size="sm" />
                  <div className="my-row__body">
                    <h3>{product.name}</h3>
                    <p>
                      {ko.myHope} {formatWon(d.maxPrice)}
                    </p>
                    <p>
                      {ko.marketHigh} {formatWon(agg?.highestIntentPrice ?? d.maxPrice)}
                    </p>
                    {matched ? (
                      <p className="status-ready">{ko.matchReady}</p>
                    ) : null}
                    <Button to={`/demand/${product.id}`} size="sm" variant="secondary">
                      {ko.viewDemand}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "owned" ? (
        myOwnerships.length === 0 ? (
          <EmptyState
            title={ko.noOwned}
            body={ko.noOwnedBody}
            action={<Button to="/feed">{ko.navFeed}</Button>}
          />
        ) : (
          <div className="section-stack">
            {myOwnerships.map((o) => {
              const product = getProduct(o.productId);
              const agg = getAggregate(o.productId);
              if (!product) return null;
              return (
                <Card key={o.id} className="my-row">
                  <ProductVisual product={product} size="sm" />
                  <div className="my-row__body">
                    <h3>{product.name}</h3>
                    <p>
                      {CONDITION_LABEL[o.condition]}  |  {ko.seekersLabel} {agg?.seekerCount ?? 0}
                      {ko.myung}
                    </p>
                    <Button to={`/ownership/${o.id}/sell-intent`} size="sm">
                      {ko.sellIntent}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "selling" ? (
        mySellIntents.length === 0 ? (
          <EmptyState title={ko.noSell} body={ko.noSellBody} />
        ) : (
          <div className="section-stack">
            {mySellIntents.map((s) => {
              const product = getProduct(s.productId);
              if (!product) return null;
              return (
                <Card key={s.id} className="my-row">
                  <ProductVisual product={product} size="sm" />
                  <div className="my-row__body">
                    <h3>{product.name}</h3>
                    <p>
                      {formatWon(s.minimumPrice)}
                      {ko.above}
                      {s.status}
                    </p>
                    <Button to="/my?tab=matches" size="sm" variant="secondary">
                      {ko.viewMatches}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "matches" ? <MatchList matches={myMatches} /> : null}
    </div>
  );
}
