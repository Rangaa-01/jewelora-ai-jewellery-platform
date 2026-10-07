import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, ButtonLink } from "./button";

describe("Button", () => {
  it("renders and handles click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Try It On</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Try It On" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and busy while loading", () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("defaults to type=button so it never submits forms accidentally", () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("renders ButtonLink as an anchor with the href", () => {
    render(<ButtonLink href="/collections">Explore</ButtonLink>);
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/collections");
  });
});
