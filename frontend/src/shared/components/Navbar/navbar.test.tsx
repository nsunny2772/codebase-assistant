import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Navbar } from "@src/shared/components/Navbar/index";

it("provides an accessible application header", () => {
  render(<Navbar />);
  expect(
    screen.getByRole("heading", { name: "AI Codebase Assistant", level: 2 }),
  ).toBeTruthy();
});
