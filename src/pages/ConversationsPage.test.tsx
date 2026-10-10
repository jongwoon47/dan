import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationsPage } from "./ConversationsPage";

vi.mock("@/data/mode", () => ({ getDataMode: () => "demo" }));
vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    isLoggedIn: true,
    login: vi.fn(),
    currentUser: { id: "u1", displayName: "Me" },
    myMatches: [
      {
        id: "m1",
        demandId: "d1",
        buyerId: "u1",
        sellerId: "u2",
        status: "CONNECTED",
        dealStage: "CHAT",
        paymentStatus: "NONE",
        createdAt: "2026-10-10T00:00:00.000Z",
      },
    ],
    getDemand: () => ({ id: "d1", title: "캠핑 의자" }),
    getPublicProfile: async () => ({ id: "u2", displayName: "Mina" }),
    listMessages: async () => [
      {
        id: "msg1",
        matchId: "m1",
        senderId: "u2",
        body: "내일 오후 괜찮으세요?",
        createdAt: "2026-10-10T01:00:00.000Z",
      },
    ],
  }),
}));

afterEach(cleanup);

describe("ConversationsPage", () => {
  it("renders chat rows as an accessible list after load", async () => {
    render(
      <MemoryRouter>
        <ConversationsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("list", { name: "대화" })).toBeInTheDocument();
    expect(await screen.findByRole("listitem")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", {
        name: /Mina\. 캠핑 의자/,
      }),
    ).toBeInTheDocument();
  });
});
