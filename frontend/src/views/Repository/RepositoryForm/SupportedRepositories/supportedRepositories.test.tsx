import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SupportedRepositories } from "@src/views/Repository/RepositoryForm/SupportedRepositories/index";

it("passes the selected example URL to its parent and respects disabled state", async () => {
  const choose = vi.fn();
  const { rerender } = render(
    <SupportedRepositories disabled={false} onChoose={choose} />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Use MERN CRUD application example" }),
  );
  expect(choose).toHaveBeenCalledWith(
    "https://github.com/mongodb-developer/mern-stack-example",
  );
  rerender(<SupportedRepositories disabled onChoose={choose} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Use Flask web application example" }),
  );
  expect(choose).toHaveBeenCalledTimes(1);
});
