// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */
import { createClient } from "npm:@libsql/client@0.6.0/node";
import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  addCharts,
  getAccessUrl,
  getHTMLDoc,
  getLoggedInAthlete,
  getLoggedInAthleteActivities,
  getTokenExchange,
  refreshTokensIfExpired,
} from "./utils/index.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { getTotalWeightTrainingVolume } from "./utils/data_processing_utils.ts";
import { TableName } from "./types.ts";

const envFile = await load();
for (const [k, v] of Object.entries(envFile)) {
  Deno.env.set(k, v);
}

const env = createClient({
  url: "file:auth.db",
});

const TURSO_AUTH_TOKEN = Deno.env.get("TURSO_AUTH_TOKEN");
const TURSO_URL = Deno.env.get("TURSO_URL");
const BASE_URL = Deno.env.get("BASE_URL");

const db = createClient({
  url: TURSO_URL || "",
  authToken: TURSO_AUTH_TOKEN,
});

const app = new Hono();

app.get("/auth/login", async (c: Context) => {
  const accessUrl = await getAccessUrl();
  return c.redirect(accessUrl);
});

app.get("/auth/access-code", async (c: Context) => {
  try {
    await getTokenExchange(c, env);
    return c.redirect("/home");
  } catch (error) {
    return c.text(error);
  }
});

app.get("/home", async (c: Context) => {
  try {
    await refreshTokensIfExpired(env);
    const doc = await getHTMLDoc();
    doc.body = await addCharts(doc.body, env);
    const docHtmlText = doc.documentElement?.outerHTML;

    if (!docHtmlText) throw new Error("Failed to obtain document html");

    return c.html(docHtmlText);
  } catch (error) {
    console.error(error);
    return c.redirect("/auth/login");
  }
});

app.get("/", (c: Context) => {
  return c.redirect("/home");
});

app.get("/test", async (c: Context) => {
  const activities = await getLoggedInAthleteActivities(
    env,
    "WeightTraining",
    10
  );
  const weights = await Promise.all(
    activities.map(async (e) => {
      return await getTotalWeightTrainingVolume(env, e.id);
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

Deno.serve(app.fetch);
