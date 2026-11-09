import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Form } from "@src/shared/components/Form/index";
import { Input } from "@src/shared/components/Input";
import { Button } from "@src/shared/components/Button";

it("validates reusable inputs and applies form default values", async () => {
  const submit = vi.fn(),
    user = userEvent.setup();
  render(
    <Form defaultValues={{ name: "Sunny" }} onSubmit={submit}>
      <Input
        name="name"
        rules={{ required: "Name is required." }}
      />
      <Button htmlType="submit">Submit</Button>
    </Form>,
  );
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
    "Sunny",
  );
  await user.clear(screen.getByRole("textbox"));
  await user.click(screen.getByRole("button", { name: "Submit" }));
  expect(await screen.findByText("Name is required.")).toBeTruthy();
  expect(submit).not.toHaveBeenCalled();
  await user.type(screen.getByRole("textbox"), "New name");
  await user.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0]?.[0]).toEqual({ name: "New name" });
});
