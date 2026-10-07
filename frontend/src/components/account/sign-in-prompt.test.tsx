import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignInPromptHost } from "./sign-in-prompt";
import { ToastProvider } from "@/components/ui/toast";
import { useUiStore } from "@/lib/stores/ui-store";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

describe("SignInPromptHost", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    useUiStore.setState({ authPrompt: null });
  });

  it("opens with the requested message and offers sign in / create account", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <SignInPromptHost />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Sign in to continue")).not.toBeVisible();
    act(() => useUiStore.getState().requestSignIn({ message: "Sign in to save this piece." }));
    expect(screen.getByText("Sign in to save this piece.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Create account" })).toBeInTheDocument();
    act(() => useUiStore.getState().closeAuthPrompt());
    expect(useUiStore.getState().authPrompt).toBeNull();
  });
});
