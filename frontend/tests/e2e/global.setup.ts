import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { login, userInfo } from "./helpers";

setup("sign in with the CLI-created account", async ({ page, request }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";
    const account = userInfo();
    const existing = await request.post(`${apiURL}/pro/login`, {
      data: {
        email: account.email,
        password: account.password,
        source: "pro",
        remember: false,
      },
    });
    if (!existing.ok()) {
      mkdirSync("playwright/.cache", { recursive: true });
      const cli = (...args: string[]) =>
        JSON.parse(
          execFileSync(
            "poetry",
            ["run", "python", "../admin_cli/openbb-admin", ...args, "--json"],
            {
              cwd: resolve("../backend"),
              env: {
                ...process.env,
                OPENBB_CONFIG_FILE: resolve("playwright/.cache/admin.json"),
              },
              encoding: "utf8",
            },
          ),
        );
      cli(
        "auth",
        "login",
        "--api-url",
        apiURL,
        "--email",
        "admin@openbb.co",
        "--password",
        "asdQWE123!",
      );
      const entities = cli("entity", "list");
      const entity = entities.items.find(
        (entity: { name: string }) => entity.name === "Browser Tests",
      );
      expect(
        entity,
        "The source backend creates the Browser Tests organization.",
      ).toBeTruthy();
      const created = cli(
        "user",
        "create",
        entity.uuid,
        "--email",
        account.email,
        "--first-name",
        "Browser",
        "--last-name",
        "Tester",
        "--role",
        "user",
      );
      const session = await request.post(`${apiURL}/pro/login`, {
        data: {
          email: account.email,
          password: created.temporary_password,
          source: "pro",
          remember: false,
        },
      });
      expect(session.ok()).toBeTruthy();
      const token = (await session.json()).access_token;
      const changed = await request.put(`${apiURL}/user`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          old_password: created.temporary_password,
          new_password: account.password,
        },
      });
      expect(changed.ok()).toBeTruthy();
    }
  }
  await login(page);
  await page.context().storageState({ path: "playwright/.auth/user.json" });
});
