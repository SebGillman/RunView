import { stub } from "jsr:@std/testing/mock";
import { assert, assertEquals } from "jsr:@std/assert@^1.0.6/";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

import app from "../main.ts";
import { TileTrackerCoordPayload } from "../types.ts";

// Add app to context
app;
// load from local env if available
await load({ export: true });

const BASE_URL = Deno.env.get("BASE_URL") ?? "";
const TILE_TRACKER_URL = Deno.env.get("TILE_TRACKER_URL");

Deno.test("[/tiles] GET /leaderboard", async (t) => {
  const url = BASE_URL + "/tiles/leaderboard";

  await t.step("Microservice healthy", async () => {
    const pingRes = await fetch(TILE_TRACKER_URL + "/ping", { method: "GET" });
    assert(pingRes.ok);
    assertEquals(pingRes.status, 200);
    await pingRes.body?.cancel();
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

Deno.test("[/tiles] GET /in-range", async (t) => {
  const url = BASE_URL + "/tiles/in-range";

  await t.step("Microservice healthy", async () => {
    const pingRes = await fetch(TILE_TRACKER_URL + "/ping", { method: "GET" });
    assert(pingRes.ok);
    assertEquals(pingRes.status, 200);
    const _pingBody = await pingRes.text();
  });

  await t.step("normal case with no tiles", async () => {
    const searchParams = new URLSearchParams({
      bottomLeftX: `${Number.MAX_SAFE_INTEGER}`,
      bottomLeftY: `${Number.MAX_SAFE_INTEGER}`,
      topRightX: `${Number.MAX_SAFE_INTEGER}`,
      topRightY: `${Number.MAX_SAFE_INTEGER}`,
    });

    const res = await fetch(url + "?" + searchParams.toString(), {
      method: "GET",
    });
    assert(res.ok);
    const resBody = await res.json();
    assertEquals(Object.keys(resBody), ["tiles", "tile_count"]);
    assertEquals(typeof resBody.tiles, "object");
    assertEquals(typeof resBody.tile_count, "number");
    assertEquals(resBody.tiles, []);
    assertEquals(resBody.tile_count, 0);
  });

  await t.step("normal case with one tile", async () => {
    const payload: TileTrackerCoordPayload = {
      userId: 101,
      activityId: 123,
      coords: [
        [0, 0],
        [0, 0],
      ],
      createdAt: 1,
    };
    const postRes = await fetch(TILE_TRACKER_URL + "/process-activity", {
      method: "POST",
      headers: new Headers({
        Accept: "*/*",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });
    assert(postRes.ok);
    await postRes.body?.cancel();

    const searchParams = new URLSearchParams({
      bottomLeftX: `0`,
      bottomLeftY: `0`,
      topRightX: `0`,
      topRightY: `0`,
    });

    const res = await fetch(url + "?" + searchParams.toString(), {
      method: "GET",
    });
    assert(res.ok);
    const resBody: { tiles: { [key: string]: number }[]; tile_count: number } =
      await res.json();
    assertEquals(Object.keys(resBody), ["tiles", "tile_count"]);
    assertEquals(typeof resBody.tiles, "object");
    assertEquals(typeof resBody.tile_count, "number");
    assertEquals(resBody.tiles, [
      {
        activity_id: 123,
        x_index: 0,
        y_index: 0,
        user_id: 101,
        created_at: 101,
      },
    ]);
    assertEquals(resBody.tile_count, 1);
  });

  await t.step("missing query param(s)", async () => {
    const searchParams = new URLSearchParams({
      bottomLeftY: `0`,
      topRightX: `0`,
      topRightY: `0`,
    });

    const res = await fetch(url + "?" + searchParams.toString(), {
      method: "GET",
    });
    assertEquals(res.status, 403);
    assert(!res.ok);
    const resBody: {
      tiles?: { [key: string]: number }[];
      tile_count?: number;
    } = await res.json();
    assertEquals(resBody, {});
  });
});

Deno.test("[/auth] Auth Service", async (t) => {
  const url = BASE_URL + "/auth";

  await t.step("GET /login redirects to Strava OAuth login page", async () => {
    const res = await fetch(url + "/login", { method: "GET" });
    assert(res.ok);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    assert(res.redirected);
    assertEquals(res.url, "https://www.strava.com/login");
    await res.body?.cancel();
  });

  await t.step(
    "GET /access-code without access-code redirects to Strava OAuth login page",
    async () => {
      const res = await fetch(url + "/access-code", { method: "GET" });
      assert(res.ok);
      assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
      assert(res.redirected);
      assertEquals(res.url, "https://www.strava.com/login");
      await res.body?.cancel();
    }
  );

  await t.step(
    "GET /access-code with access-code redirects to /home",
    async () => {
      const fetchCopy = globalThis.fetch;
      // mock fetch for tokenExchange()
      const mockTokenExchangeFetch = stub(
        globalThis,
        "fetch",
        (url, ...rest) => {
          if (url == "https://www.strava.com/api/v3/oauth/token") {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  athlete: { id: 101 },
                  expires_at: 123456789,
                  refresh_token: "test_refresh_token",
                  access_token: "test_access_token",
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json", test: "true" },
                }
              )
            );
          } else {
            return fetchCopy(url, ...rest);
          }
        }
      );
      try {
        const searchParams = new URLSearchParams({
          code: "thisIsTheAccessCode",
        });
        const res = await fetch(
          url + "/access-code?" + searchParams.toString(),
          {
            method: "GET",
            redirect: "manual",
          }
        );
        await res.body?.cancel();
        assert(!res.ok);
        assertEquals(res.headers.get("location"), "/home");
        assertEquals(res.status, 302);
        assert(!res.redirected);
        assertEquals(res.url, url + "/access-code?code=thisIsTheAccessCode");
      } finally {
        mockTokenExchangeFetch.restore();
      }
    }
  );
});

Deno.test("[/home] Check home page", async (t) => {
  const url = BASE_URL + "/home";

  await t.step(
    "GET /home without session cookie redirects to /auth/login",
    async () => {
      const res = await fetch(url, { method: "GET" });
      assert(res.ok);
      assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
      assert(res.redirected);
      assertEquals(res.url, "https://www.strava.com/login");
      await res.body?.cancel();
    }
  );

  await t.step("GET /home with session cookie ", async () => {
    const fetchCopy = globalThis.fetch;
    // mock fetch for tokenExchange()
    const mockFetchResponses: {
      [key: string]: object;
    } = {
      "https://www.strava.com/api/v3/oauth/token": {
        expires_at: 123456789,
        refresh_token: "test_refresh_token",
        access_token: "test_access_token",
      },
      "https://www.strava.com/api/v3/athlete": {
        id: 101,
        username: '"test_user"',
        resource_state: "3",
        firstname: '"first"',
        lastname: '"last"',
        bio: '"bio"',
        city: "null",
        state: "null",
        country: "null",
        sex: '"M"',
        premium: "false",
        summit: "false",
        created_at: '"2021-07-02T22:00:14Z"',
        updated_at: '"2024-05-18T14:59:47Z"',
        badge_type_id: 0,
        weight: 104,
        profile_medium: '"test"',
        profile: '"test"',
        friend: "null",
        follower: "null",
        blocked: "false",
        can_follow: "true",
        follower_count: 17,
        friend_count: 21,
        mutual_friend_count: 0,
        athlete_type: 1,
        date_preference: '"%m/%d/%Y"',
        measurement_preference: '"meters"',
        clubs: "[]",
        postable_clubs_count: 0,
        ftp: "null",
        bikes: "[]",
        shoes: "[]",
        is_winback_via_upload: "false",
        is_winback_via_view: "false",
      },
      "https://www.strava.com/api/v3/athlete/activities?per_page=200": [],
    };
    const mockFetch = stub(globalThis, "fetch", (url, ...rest) => {
      if (Object.keys(mockFetchResponses).some((mockUrl) => mockUrl === url)) {
        return Promise.resolve(
          new Response(JSON.stringify(mockFetchResponses[url as string]), {
            status: 200,
            headers: { "Content-Type": "application/json", test: "true" },
          })
        );
      } else {
        return fetchCopy(url, ...rest);
      }
    });

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: new Headers({ Cookie: "session_id=101" }),
      });
      assert(res.ok);
      assertEquals(
        res.headers.get("content-type")?.toLowerCase(),
        "text/html; charset=utf-8"
      );
      assert(res.ok);
      assertEquals(res.url, url);

      await res.body?.cancel();
    } finally {
      mockFetch.restore();
    }
  });
});

Deno.test("[/] Welcome page", async () => {
  const res = await fetch(BASE_URL, { method: "GET" });
  assert(res.ok);
  assertEquals(res.status, 200);
  assertEquals(res.url, BASE_URL + "/");
  await res.body?.cancel();
});
