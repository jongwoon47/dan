import { describe, expect, it, vi } from "vitest";
import { navigateBack } from "@/lib/navBack";

describe("navigateBack", () => {
  it("uses history -1 when React Router idx > 0", () => {
    const navigate = vi.fn();
    vi.stubGlobal("history", { state: { idx: 2 } });
    navigateBack(navigate, "/feed");
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it("falls back on cold/external entry (idx 0)", () => {
    const navigate = vi.fn();
    vi.stubGlobal("history", { state: { idx: 0 } });
    navigateBack(navigate, "/my");
    expect(navigate).toHaveBeenCalledWith("/my", { replace: true });
  });

  it("falls back when idx is missing", () => {
    const navigate = vi.fn();
    vi.stubGlobal("history", { state: {} });
    navigateBack(navigate, "/");
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
