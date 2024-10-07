// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */
import { createClient } from "npm:@libsql/client@0.6.0/node";
import { Client } from "npm:@libsql/core/api";
import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v4.1.4/middleware/serve-static/index.ts";
import {
  addCharts,
  createUserDataTables,
  eventHandler,
  getEnvVar,
  getHTMLDoc,
  getLeaderboard,
  getLoggedInAthleteActivities,
  getSessionFromCookie,
  getSessionFromHeader,
  passActivityToTileTracker,
  refreshTokensIfExpired,
} from "./utils/index.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { getTotalWeightTrainingVolume } from "./utils/data_processing_utils.ts";
import { WebHookRequest } from "./types.ts";

// load from local env if available
const envFile = await load();
for (const [k, v] of Object.entries(envFile)) {
  Deno.env.set(k, v);
}

console.log("START");

const TURSO_AUTH_TOKEN = Deno.env.get("TURSO_AUTH_TOKEN");
const TURSO_URL = Deno.env.get("TURSO_URL");

const AUTH_TURSO_AUTH_TOKEN = Deno.env.get("AUTH_TURSO_AUTH_TOKEN");
const AUTH_TURSO_URL = Deno.env.get("AUTH_TURSO_URL");

const app = new Hono();

app.use("*", async (c: Context, next: () => Promise<void>) => {
  if (!!c.get("env") && !!c.get("db")) return await next();

  const env: Client = createClient({
    url: AUTH_TURSO_URL || "",
    authToken: AUTH_TURSO_AUTH_TOKEN,
  });

  const db: Client = createClient({
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
  const doc = await getHTMLDoc("welcome.html");
  const docHtmlText = doc.documentElement?.outerHTML;
  if (!docHtmlText) throw new Error("Failed to obtain document html");
  return c.html(docHtmlText);
});

app.get("/leaderboard", refreshTokensIfExpired, async (c: Context) => {
  return await getLeaderboard(c);
});

import AuthApp from "./app/auth.ts";
import SubscriptionsApp from "./app/subscription.ts";
app.route("/auth", AuthApp);
app.route("/subscription", SubscriptionsApp);

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, app.fetch);
