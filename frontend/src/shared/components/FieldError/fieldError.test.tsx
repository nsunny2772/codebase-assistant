import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FieldError } from "@src/shared/components/FieldError/index";

it("renders accessible field errors and hides an absent message", () => {
  const { rerender } = render(<FieldError name="stack" />);
  expect(screen.queryByRole("alert")).toBeNull();
  rerender(<FieldError name="stack" message="Choose a stack." />);
  expect(screen.getByRole("alert").id).toBe("stack-error");
  expect(screen.getByText("Choose a stack.")).toBeTruthy();
});
