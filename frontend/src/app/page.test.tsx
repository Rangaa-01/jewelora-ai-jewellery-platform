import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the brand name", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Jewelora" })).toBeInTheDocument();
  });
});
