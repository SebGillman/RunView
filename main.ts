// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */
import { createClient } from "npm:@libsql/client@0.6.0/node";
import { Client } from "npm:@libsql/core/api";
import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v4.1.4/middleware/serve-static/index.ts";
import {
  addCharts,
  createAuthTable,
  createUserDataTables,
  eventHandler,
  getAccessUrl,
  getEnvVar,
  getHTMLDoc,
  getLoggedInAthleteActivities,
  getSessionFromCookie,
  getSessionFromHeader,
  getTokenExchange,
  passActivityToTileTracker,
  refreshTokensIfExpired,
  setSessionCookie,
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

const BASE_URL = Deno.env.get("BASE_URL");

const env: Client = createClient({
  url: AUTH_TURSO_URL || "",
  authToken: AUTH_TURSO_AUTH_TOKEN,
});

const db: Client = createClient({
  url: TURSO_URL || "",
  authToken: TURSO_AUTH_TOKEN,
});

await createAuthTable(env);

const app = new Hono();

//serve static files
app.use(
  "/assets/*",
  serveStatic({
    getContent: async (path) => await Deno.readFile(path),
    root: "./",
  })
);

app.get("/auth/login", async (c: Context) => {
  console.log("LOGIN START");
  const accessUrl = await getAccessUrl();
  return c.redirect(accessUrl);
});

app.get(
  "/auth/access-code",
  getTokenExchange(env),
  setSessionCookie,
  (c: Context) => {
    const userId = c.get("userId");
    if (!userId) return c.redirect("/auth/login");
    try {
      return c.redirect("/home");
    } catch (error) {
      return c.text(error);
    }
  }
);

app.get(
  "/home",
  getSessionFromCookie,
  refreshTokensIfExpired(env),
  async (c: Context) => {
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

app.get(
  "/subscription/view",
  getSessionFromCookie,
  refreshTokensIfExpired(env),
  async (c: Context) => {
    const CLIENT_ID = Deno.env.get("CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");

    if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
    if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

    const ACCESS_TOKEN = await getEnvVar(c, env, "ACCESS_TOKEN");
    const res = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      {
        method: "GET",
        headers: new Headers({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          Accept: "application/json",
        }),
      }
    );
    const resJson = await res.json();
    return c.json(resJson);
  }
);

app.post(
  "/subscription/create",
  getSessionFromHeader,
  refreshTokensIfExpired(env),
  async (c: Context) => {
    const verifyToken = "fontaines";

    const CLIENT_ID = Deno.env.get("CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");

    if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
    if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

    const urlEncodedData = new FormData();
    const formEntries = [
      ["client_id", CLIENT_ID],
      ["client_secret", CLIENT_SECRET],
      ["callback_url", BASE_URL + "/subscription/listen"],
      ["verify_token", verifyToken],
    ];

    formEntries.forEach((element) => {
      urlEncodedData.append(element[0], element[1]);
    });

    const response = await fetch(
      "https://www.strava.com/api/v3/push_subscriptions",
      {
        method: "POST",
        body: urlEncodedData,
      }
    );
    if (!response.ok) return c.text("Subscription Failed!");
    return c.text("Subscription made, get incoming to /subscription/listen");
  }
);

app.get("/subscription/listen", (c: Context) => {
  const verifyToken = "fontaines";

  const { searchParams } = new URL(c.req.url);
  const hubMode = searchParams.get("hub.mode");
  const hubChallenge = searchParams.get("hub.challenge");
  const hubVerifyToken = searchParams.get("hub.verify_token");

  if (hubVerifyToken !== verifyToken)
    throw new Error("Incorrect verification token!");

  if (hubMode !== "subscribe" || !hubChallenge)
    throw new Error("Request invalid!");

  c.status(200);
  return c.json({ "hub.challenge": hubChallenge });
});

app.post("/subscription/listen", async (c: Context) => {
  const event: WebHookRequest = await c.req.json();
  const ownerId = event.owner_id;
  const objectId = event.object_id;

  c.set("userId", event.object_type === "athlete" ? objectId : ownerId);

  await refreshTokensIfExpired(env)(c, async () => {});

  const res = await eventHandler(c, db, env, event);

  if (event.aspect_type === "create" && event.object_type === "activity") {
    passActivityToTileTracker(c, env, event.object_id, event.event_time);
  }
  return c.json({ Result: res ?? "Error" });
});

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, app.fetch);
