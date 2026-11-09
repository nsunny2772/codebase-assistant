import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Form } from "@src/shared/components/Form";
import { Button } from "@src/shared/components/Button";
import {
  Input,
  PasswordInput,
  TextAreaInput,
} from "@src/shared/components/Input/index";

it("binds text, password and multiline values to their surrounding form", async () => {
  const submit = vi.fn(),
    user = userEvent.setup();
  render(
    <Form defaultValues={{ name: "", token: "", notes: "" }} onSubmit={submit}>
      <Input name="name" />
      <PasswordInput name="token" />
      <TextAreaInput name="notes" />
      <Button htmlType="submit">Save</Button>
    </Form>,
  );
  const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
  const tokenInput = document.querySelector<HTMLInputElement>('input[name="token"]');
  const notesInput = document.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
  expect(nameInput).not.toBeNull();
  expect(tokenInput).not.toBeNull();
  expect(notesInput).not.toBeNull();
  await user.type(nameInput!, "Sunny");
  await user.type(tokenInput!, "secret");
  await user.type(notesInput!, "Repository notes");
  expect(tokenInput?.getAttribute("type")).toBe("password");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0]?.[0]).toEqual({
    name: "Sunny",
    token: "secret",
    notes: "Repository notes",
  });
});
