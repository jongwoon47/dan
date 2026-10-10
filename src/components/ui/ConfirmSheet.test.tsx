import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmSheet } from "./ConfirmSheet";
import { ReportReasonChoices } from "./ReportReasonChoices";

afterEach(cleanup);

describe("ConfirmSheet", () => {
  it("traps focus, honors Escape, and restores body scroll", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    document.body.style.overflow = "auto";

    const { rerender } = render(
      <ConfirmSheet
        open
        title="차단"
        body="이 사용자를 차단할까요?"
        confirmLabel="차단"
        danger
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("dialog", { name: "차단" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <ConfirmSheet
        open={false}
        title="차단"
        confirmLabel="차단"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    expect(document.body.style.overflow).toBe("auto");
  });

  it("disables confirm when confirmDisabled is set", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmSheet
        open
        title="신고"
        confirmLabel="신고하기"
        confirmDisabled
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByRole("button", { name: "신고하기" });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("ReportReasonChoices", () => {
  it("exposes a radiogroup and updates selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const copy = {
      reportReason: "신고 사유",
      reportSpam: "스팸",
      reportFraud: "사기",
      reportAbuse: "욕설·괴롭힘",
      reportOther: "기타",
    } as const;

    render(
      <ReportReasonChoices value="spam" onChange={onChange} copy={copy} />,
    );

    const group = screen.getByRole("radiogroup", { name: "신고 사유" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "스팸" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("radio", { name: "사기" }));
    expect(onChange).toHaveBeenCalledWith("fraud");
  });
});
