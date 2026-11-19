import {readFileSync} from "node:fs";
import {expect, type Page} from "@playwright/test";

type Credentials = Record<string, {password: string; role: string}>;

export async function signIn(page: Page, email: string) {
  const credentials: Credentials = JSON.parse(
    readFileSync(process.env.E2E_CREDENTIALS_FILE ?? ".demo-credentials.json", "utf8"),
  );
  const account = credentials[email];
  if (!account) throw new Error("The requested account is missing from the private credentials file.");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", {exact: true}).fill(account.password);
  try {
    await page.getByRole("button", {name: "Sign in →"}).click();
  } finally {
    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>('input[type="password"]');
      if (field) field.value = "";
    });
  }
  await expect(page).toHaveURL(
    account.role === "platform_admin" ? /\/platform\/overview$/ : /\/app\/dashboard$/,
  );
}
