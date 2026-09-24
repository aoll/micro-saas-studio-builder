// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/common.json";
import { BalanceBadge, BalanceBadgeSkeleton, BalanceProvider, useBalanceDelta } from "./balance";

afterEach(cleanup);

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="fr" messages={{ common: fr }}>
      <BalanceProvider>{children}</BalanceProvider>
    </NextIntlClientProvider>
  );
}

function DeltaButton({ delta }: { delta: number }) {
  const addDelta = useBalanceDelta();
  return (
    <button type="button" onClick={() => addDelta(delta)}>
      apply
    </button>
  );
}

describe("BalanceBadgeSkeleton", () => {
  it("renders a hidden skeleton placeholder", () => {
    const { container } = render(<BalanceBadgeSkeleton />);
    const skeleton = container.firstElementChild!;
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("BalanceBadge / BalanceProvider", () => {
  it("renders the base balance inside the provider", () => {
    render(
      <Wrapper>
        <BalanceBadge balance={3} />
      </Wrapper>,
    );
    expect(screen.getByText("3 crédits")).toBeTruthy();
  });

  it("shows the optimistic delta immediately, then settles back to the real balance", async () => {
    render(
      <Wrapper>
        <BalanceBadge balance={3} />
        <DeltaButton delta={-1} />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "apply" }));
    expect(screen.getByText("2 crédits")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("3 crédits")).toBeTruthy());
  });
});

describe("useBalanceDelta", () => {
  it("throws a clear error outside a BalanceProvider", () => {
    function Standalone() {
      useBalanceDelta();
      return null;
    }
    expect(() => render(<Standalone />)).toThrow(/BalanceProvider/);
  });
});
