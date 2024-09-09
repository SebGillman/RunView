// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */
import { createClient } from "npm:@libsql/client@0.6.0/node";
import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  addCharts,
  createAuthTable,
  createUserDataTables,
  getAccessUrl,
  getEnvVar,
  getHTMLDoc,
  getLoggedInAthleteActivities,
  getSessionFromCookie,
  getSessionFromHeader,
  getTokenExchange,
  refreshTokensIfExpired,
  setSessionCookie,
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
  setSessionCookie,
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
  getSessionFromCookie,
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
    console.log(CLIENT_ID, CLIENT_SECRET);
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

    const ACCESS_TOKEN = await getEnvVar(c, env, "ACCESS_TOKEN");

    const response = await fetch(
      "https://www.strava.com/api/v3/push_subscriptions",
      {
        method: "POST",
        headers: new Headers({
          // Authorization: `Bearer ${ACCESS_TOKEN}`,
          // "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: urlEncodedData,
      }
    );
    console.log("VERIFICATION DONE");
    console.log(await response.json());
    // console.log(response);
    if (!response.ok) return c.text("Subscription Failed!");
    console.log(response.body);
    return c.text("Subscription made, get incoming to /subscription/listen");
  }
);

app.get("/subscription/listen", (c: Context) => {
  console.log("HITS");
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

app.post("/db/setup", async (c: Context) => {
  await createAuthTable(env);
  await createUserDataTables(c, db, env);
});

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, app.fetch);
