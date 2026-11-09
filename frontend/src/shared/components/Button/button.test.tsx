import type { FormEvent } from "react";
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "@src/shared/components/Button/index";

it("defaults to a non-submitting button and supports explicit form submission", async () => {
  const submit = vi.fn(),
    user = userEvent.setup();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };
  render(
    <form onSubmit={handleSubmit}>
      <Button>Cancel</Button>
      <Button htmlType="submit">Save</Button>
    </form>,
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).toHaveBeenCalledTimes(1);
});
it("marks loading as busy and prevents repeated actions", async () => {
  const click = vi.fn();
  render(
    <Button loading onClick={click}>
      Save
    </Button>,
  );
  const button = screen.getByRole("button", { name: /Save/ });
  expect(button.getAttribute("aria-busy")).toBe("true");
  await userEvent.click(button);
  expect(click).not.toHaveBeenCalled();
});
