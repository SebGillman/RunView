import {} from "jsr:@std/testing/mock";
import { assert, assertEquals } from "jsr:@std/assert@^1.0.6/";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

import app from "../main.ts";
app;
// load from local env if available
await load({ export: true });

const BASE_URL = Deno.env.get("BASE_URL");
const TILE_TRACKER_URL = Deno.env.get("TILE_TRACKER_URL");

Deno.test("[/tiles] GET /leaderboard", async (t) => {
  const url = BASE_URL + "/tiles/leaderboard";

  await t.step("Microservice healthy", async () => {
    const pingRes = await fetch(TILE_TRACKER_URL + "/ping", { method: "GET" });
    assert(pingRes.ok);
    assertEquals(pingRes.status, 200);
    const _pingBody = await pingRes.text();
  });

  await t.step("With user_id number", async () => {
    const urlWithSearchParams = new URL(url);
    urlWithSearchParams.searchParams.append("user_id", "88192220");
    const res = await fetch(urlWithSearchParams.toString(), { method: "GET" });
    assert(res.ok);
    const body = await res.json();
    assertEquals(Object.keys(body), ["leaderboard", "user"]);
  });

  await t.step("With user_id string", async () => {
    const urlWithSearchParams = new URL(url);
    urlWithSearchParams.searchParams.append("user_id", "abc");
    const res = await fetch(urlWithSearchParams.toString(), { method: "GET" });
    assert(res.ok);
    const body = await res.json();
    assertEquals(Object.keys(body), ["leaderboard"]);
  });

  await t.step("With user_id empty string", async () => {
    const urlWithSearchParams = new URL(url);
    urlWithSearchParams.searchParams.append("user_id", "");
    const res = await fetch(urlWithSearchParams.toString(), { method: "GET" });
    assert(res.ok);
    const body = await res.json();
    assertEquals(Object.keys(body), ["leaderboard"]);
  });

  await t.step("Without user", async () => {
    const res = await fetch(url, { method: "GET" });
    assert(res.ok);
    const body = await res.json();
    assertEquals(Object.keys(body), ["leaderboard"]);
  });
});

