import { render, screen } from "@testing-library/react";
import { Checkbox, Input, Select } from "./field";

describe("form fields", () => {
  it("associates the label and announces errors", () => {
    render(<Input label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("renders hint text when there is no error", () => {
    render(<Input label="Phone" hint="Include the country code" />);
    expect(screen.getByText("Include the country code")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders select options and placeholder", () => {
    render(
      <Select label="Store" placeholder="Choose" options={[{ value: "a", label: "Anna Nagar" }]} />,
    );
    expect(screen.getByRole("option", { name: "Anna Nagar" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Choose" })).toBeDisabled();
  });

  it("renders an accessible checkbox", () => {
    render(<Checkbox label="Send me updates" />);
    expect(screen.getByRole("checkbox", { name: "Send me updates" })).toBeInTheDocument();
  });
});
