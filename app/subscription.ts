import { type Context, Hono } from "jsr:@hono/hono";
import {
  getEnvVar,
  getSessionFromCookie,
  getSessionFromHeader,
  refreshTokensIfExpired,
} from "../utils/auth_utils.ts";
import { Client } from "npm:@libsql/core/api";

import { WebHookRequest } from "../types.ts";
import { eventHandler } from "../utils/db_utils.ts";
import { passActivityToTileTracker } from "../utils/tile_tracker_utils.ts";

const BASE_URL = Deno.env.get("BASE_URL");

const app = new Hono();

app.get(
  "/view",
  getSessionFromCookie,
  refreshTokensIfExpired,
  async (c: Context) => {
    const env: Client = c.get("env");

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
    if (!res.ok) throw new Error("Bad response");
    const resJson = await res.json();
    return c.json(resJson);
  }
);

// sessionFromHeader for testing (postman)
app.post(
  "/create",
  getSessionFromHeader,
  refreshTokensIfExpired,
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

app.get("/listen", (c: Context) => {
  const verifyToken = "fontaines";

  const { searchParams } = new URL(c.req.url);
  const hubMode = searchParams.get("hub.mode");
  const hubChallenge = searchParams.get("hub.challenge");
  const hubVerifyToken = searchParams.get("hub.verify_token");

  if (hubVerifyToken !== verifyToken) {
    throw new Error("Incorrect verification token!");
  }

  if (hubMode !== "subscribe" || !hubChallenge) {
    throw new Error("Request invalid!");
  }

  c.status(200);
  return c.json({ "hub.challenge": hubChallenge });
});

app.post("/listen", async (c: Context) => {
  const env: Client = c.get("env");
  const db: Client = c.get("db");

  const event: WebHookRequest = await c.req.json();
  const ownerId = event.owner_id;
  const objectId = event.object_id;

  c.set("userId", event.object_type === "athlete" ? objectId : ownerId);

  await refreshTokensIfExpired(c, async () => {});

  const res = await eventHandler(c, db, env, event);

  if (event.aspect_type === "create" && event.object_type === "activity") {
    passActivityToTileTracker(c, env, event.object_id, event.event_time);
  }
  return c.json({ Result: res ?? "Error" });
});

export default app;
