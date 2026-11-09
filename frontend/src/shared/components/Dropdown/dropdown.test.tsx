import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Form } from "@src/shared/components/Form";
import { Dropdown } from "@src/shared/components/Dropdown/index";
import { Button } from "@src/shared/components/Button";

it("submits named dropdown fields through the reusable Form context", async () => {
  const submit = vi.fn(),
    user = userEvent.setup();
  render(
    <Form defaultValues={{ framework: "" }} onSubmit={submit}>
      <Dropdown
        name="framework"
        options={[
          { label: "Python", value: "python" },
          { label: "MERN", value: "mern" },
        ]}
        rules={{ required: "Choose a framework." }}
      />
      <Button htmlType="submit">Save</Button>
    </Form>,
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Choose a framework.")).toBeTruthy();
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByText("Python"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0]?.[0]).toEqual({ framework: "python" });
});
