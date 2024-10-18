// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */
import { createClient } from "npm:@libsql/client@0.6.0/node";
import { Client, Value } from "npm:@libsql/core/api";
import { type Context, Hono } from "jsr:@hono/hono";
import { serveStatic } from "jsr:@hono/hono/serve-static";
import {
  addCharts,
  createUserDataTables,
  getHTMLDoc,
  getSessionFromCookie,
  refreshTokensIfExpired,
} from "./utils/index.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// load from local env if available
await load({ export: true });

console.log("START");

const TURSO_AUTH_TOKEN = Deno.env.get("TURSO_AUTH_TOKEN");
const TURSO_URL = Deno.env.get("TURSO_URL");

const AUTH_TURSO_AUTH_TOKEN = Deno.env.get("AUTH_TURSO_AUTH_TOKEN");
const AUTH_TURSO_URL = Deno.env.get("AUTH_TURSO_URL");

const app = new Hono();

app.use("*", async (c: Context, next: () => Promise<void>) => {
  if (!!c.get("env") && !!c.get("db")) return await next();

  const env = createClient({
    url: AUTH_TURSO_URL || "",
    authToken: AUTH_TURSO_AUTH_TOKEN,
  });

  const db = createClient({
    url: TURSO_URL || "",
    authToken: TURSO_AUTH_TOKEN,
  });

  // await createAuthTable(env);

  c.set("env", env);
  c.set("db", db);

  return await next();
});

//serve static files
app.use(
  "/assets/*",
  serveStatic({
    getContent: async (path) => await Deno.readFile(path),
    root: "./",
  })
);

app.get(
  "/get-user",
  getSessionFromCookie,
  refreshTokensIfExpired,
  async (c: Context) => {
    const db: Client = c.get("db");
    const userId = c.get("userId");
    if (!userId) throw new Error("userId failed to be retrieved from cookie");
    if (!db) throw new Error("db failed to be retrieved");
    const userRows = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?;",
      args: [userId],
    });

    const user: { [key: string]: Value } = {};

    for (let i = 0; i < userRows.columns.length; i++) {
      user[userRows.columns[i]] = userRows.rows[0][i];
    }
    return c.json(user);
  }
);

app.get(
  "/home",
  getSessionFromCookie,
  refreshTokensIfExpired,
  async (c: Context) => {
    const env: Client = c.get("env");
    const db: Client = c.get("db");

    const userId = c.get("userId");
    if (!userId) return c.redirect("/auth/login");
    try {
      await createUserDataTables(c, db, env);
      const doc = await getHTMLDoc("index.html");
      doc.body = await addCharts(c, doc.body, env);
      const docHtmlText = doc.documentElement?.outerHTML;

      if (!docHtmlText) throw new Error("Failed to obtain document html");

      return c.html(docHtmlText);
    } catch (error) {
      console.error(error);
      return c.redirect("/auth/login");
    }
  }
);

app.get("/", async (c: Context) => {
  const { logout } = c.req.query();
  if (logout) {
    c.header(
      "Set-Cookie",
      `session_id=null; HttpOnly; Secure; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;Path=/`
    );
  }
  const doc = await getHTMLDoc("welcome.html");
  const docHtmlText = doc.documentElement?.outerHTML;
  if (!docHtmlText) throw new Error("Failed to obtain document html");
  return c.html(docHtmlText);
});

import AuthApp from "./app/auth.ts";
import SubscriptionsApp from "./app/subscription.ts";
import TilesApp from "./app/tiles.ts";
app.route("/tiles", TilesApp);
app.route("/auth", AuthApp);
app.route("/subscription", SubscriptionsApp);

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, app.fetch);
export default app;
