import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { NearbyBandMap } from "./NearbyBandMap";
import type { Demand } from "@/domain/types";

afterEach(cleanup);

function task(id: string, title: string): Demand {
  return {
    id,
    userId: "u1",
    type: "TASK",
    title,
    description: "",
    category: "errand",
    budget: 5000,
    currencyCode: "KRW",
    countryCode: "KR",
    status: "ACTIVE",
    createdAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    fulfillmentOptions: [{ mode: "ONSITE", place: { publicLabel: "성동구", region2: "성동구" } }],
    details: { taskDescription: title },
  };
}

describe("NearbyBandMap", () => {
  it("groups by approximate distance bands without exposing coordinates", () => {
    const { container } = render(
      <MemoryRouter>
        <NearbyBandMap
          radiusKm={5}
          items={[
            { demand: task("a", "근처 심부름"), approxMeters: 1200 },
            { demand: task("b", "조금 먼 심부름"), approxMeters: 4200 },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("근처 심부름")).toBeInTheDocument();
    expect(screen.getByText("조금 먼 심부름")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/lat|lng|37\.|126\./i);
    expect(screen.getByText(/정확한 집·픽업 위치를 표시하지 않아요/)).toBeInTheDocument();
  });
});
