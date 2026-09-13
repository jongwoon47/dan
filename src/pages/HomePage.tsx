import { ko } from "@/copy/ko";
import { DemandCard } from "@/components/DemandCard";
import { Button } from "@/components/ui/Button";
import { useDan } from "@/domain/danContext";
import "./pages.css";

export function HomePage() {
  const { demandFeed } = useDan();
  const featured = demandFeed.slice(0, 4);

  return (
    <div className="page-stack home-page">
      <section className="hero hero--compact">
        <div className="hero__brand">
          <img
            className="hero__logo"
            src="/dan-logo.png"
            alt="DAN"
            width={72}
            height={72}
          />
          <p className="hero__eyebrow">Demand-first</p>
        </div>
        <h1 className="hero__title">{ko.heroTitle}</h1>
        <p className="hero__body">
          {ko.heroBody1}
          <br />
          {ko.heroBody2}
        </p>
        <div className="hero__actions">
          <Button to="/create" size="lg">
            {ko.ctaCreate}
          </Button>
          <Button to="/feed" size="lg" variant="secondary">
            {ko.ctaBrowse}
          </Button>
        </div>
      </section>

      <section className="section-stack">
        <div className="section-head">
          <h2 className="section-title">{ko.featuredTitle}</h2>
          <p className="section-desc">{ko.featuredDesc}</p>
        </div>
        <div className="grid-cards">
          {featured.map((row) => (
            <DemandCard key={row.productId} product={row.product} aggregate={row} />
          ))}
        </div>
        <div className="section-footer">
          <Button to="/feed" variant="ghost">
            {ko.viewAllDemand}
          </Button>
        </div>
      </section>
    </div>
  );
}
