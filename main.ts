// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */
import { createClient } from "npm:@libsql/client@0.6.0/node";
import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  addCharts,
  createAuthTable,
  createUserDataTables,
  getAccessUrl,
  getHTMLDoc,
  getLoggedInAthleteActivities,
  getSession,
  getTokenExchange,
  refreshTokensIfExpired,
  setSession,
} from "./utils/index.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { getTotalWeightTrainingVolume } from "./utils/data_processing_utils.ts";

const envFile = await load();
for (const [k, v] of Object.entries(envFile)) {
  Deno.env.set(k, v);
}

console.log("START");

const TURSO_AUTH_TOKEN = Deno.env.get("TURSO_AUTH_TOKEN");
const TURSO_URL = Deno.env.get("TURSO_URL");

const AUTH_TURSO_AUTH_TOKEN = Deno.env.get("AUTH_TURSO_AUTH_TOKEN");
const AUTH_TURSO_URL = Deno.env.get("AUTH_TURSO_URL");

const BASE_URL = Deno.env.get("BASE_URL");

const env = createClient({
  url: AUTH_TURSO_URL || "",
  authToken: AUTH_TURSO_AUTH_TOKEN,
});

const db = createClient({
  url: TURSO_URL || "",
  authToken: TURSO_AUTH_TOKEN,
});

await createAuthTable(env);

const app = new Hono();

app.get("/auth/login", async (c: Context) => {
  console.log("LOGIN START");
  const accessUrl = await getAccessUrl();
  return c.redirect(accessUrl);
});

app.get(
  "/auth/access-code",
  getTokenExchange(env),
  setSession,
  (c: Context) => {
    const userId = c.get("userId");
    if (!userId) return c.redirect("/auth/login");
    try {
      console.log("access code start");
      return c.redirect("/home");
    } catch (error) {
      return c.text(error);
    }
  }
);

app.get(
  "/home",
  getSession,
  refreshTokensIfExpired(env),
  async (c: Context) => {
    const userId = c.get("userId");
    if (!userId) return c.redirect("/auth/login");
    try {
      await createUserDataTables(c, db, env);
      const doc = await getHTMLDoc();
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

app.get("/", (c: Context) => {
  console.log("THERE IS LIFE");
  // return c.html("<p>hello</p>");
  return c.redirect("/home");
});

app.get("/test", async (c: Context) => {
  const activities = await getLoggedInAthleteActivities(
    c,
    env,
    "WeightTraining",
    10
  );
  const weights = await Promise.all(
    activities.map(async (e) => {
      return await getTotalWeightTrainingVolume(c, env, e.id);
    })
  );
  return c.text(weights.toString());
});

app.post("/db/setup", async (c: Context) => {
  const tables = await db.execute(`
  SELECT name 
  FROM sqlite_master 
  WHERE type = 'table';`);

  const { id } = await getLoggedInAthlete(env);
  if (!id) throw new Error("Failed to retrieve id.");

  console.log("tables", tables.rows.values());
  if (tables.rows.some((x: TableName) => x.name === `user-${id}`))
    return c.text("Already exists");

  await db.execute(
    `CREATE TABLE "user-${id}" (
      id INTEGER PRIMARY KEY NOT NULL,
      activity_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      distance REAL,
      weight REAL,
      description TEXT,
      gear_id TEXT,
      elapsed_time INTEGER,
      max_speed REAL,
      average_speed REAL
    );`
  );
  return c.text("Created table.");
});

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, app.fetch);
