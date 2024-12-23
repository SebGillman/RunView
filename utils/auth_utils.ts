import { type Context } from "jsr:@hono/hono";
import { Client } from "npm:@libsql/core/api";

export function getAccessUrl(): string {
  try {
    const CLIENT_ID = Deno.env.get("CLIENT_ID");
    const BASE_URL = Deno.env.get("BASE_URL");
    const REDIRECT_URI = `${BASE_URL}/auth/access-code`;

    if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
    if (!REDIRECT_URI) throw new Error("Missing REDIRECT_URI");

    const queryParams = {
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "activity:read_all,profile:read_all",
    };

    const url = new URL("https://www.strava.com/oauth/authorize");

    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const urlString = url.toString();

    return urlString;
  } catch (error) {
    throw new Error(error as string);
  }
}

export async function getTokenExchange(
  c: Context,
  next: () => Promise<void>
): Promise<void> {
  try {
    const reqUrl = new URL(c.req.url);
    const reqSearchParams = reqUrl.searchParams;

    const accessCode = reqSearchParams.get("code");
    if (!accessCode) throw new Error("Missing access code");

    const CLIENT_ID = Deno.env.get("CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");

    if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
    if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

    const tokenExchange = await fetch(
      "https://www.strava.com/api/v3/oauth/token",
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: accessCode,
          grant_type: "authorization_code", //todo
        }),
      }
    );
    if (!tokenExchange.ok) {
      await tokenExchange.text();
      throw new Error("Token Exchange failed.");
    }

    const tokenData = await tokenExchange.json();

    const userId = tokenData.athlete.id;
    c.set("userId", userId);

    const tokenExpiresAt = tokenData.expires_at;
    // const tokenExpiresIn = tokenData.expires_in;
    const REFRESH_TOKEN = tokenData.refresh_token;
    const ACCESS_TOKEN = tokenData.access_token;

    const env: Client = c.get("env");

    const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

    // If new user (not in auth) add them to global tiles game
    const res = await fetch(tileTrackerUrl + "/add-player", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: Number(userId) }),
    });

    if (!res.ok) throw new Error("Failed to add user, Crashing out");
    await res.body?.cancel();

    // Put users auth credentials in the auth db
    await env.execute(`
            INSERT OR REPLACE INTO "users_strava_auth" (
              id,
              ACCESS_TOKEN,
              REFRESH_TOKEN,
              ACCESS_TOKEN_EXPIRES_AT
            ) VALUES (
              '${userId}',
              '${ACCESS_TOKEN}',
              '${REFRESH_TOKEN}',
              '${tokenExpiresAt as string}'
            );
      `);
  } catch (e) {
    console.log(e);
  }
  return await next();
}

export async function refreshTokensIfExpired(
  c: Context,
  next: () => Promise<void>
): Promise<void> {
  console.log("refreshTokensIfExpired start");
  const env: Client = c.get("env");

  const userId = c.get("userId");
  console.log("userId", userId);

  if (!userId) return next();
  const expiryTime = Number(await getEnvVar(c, env, "ACCESS_TOKEN_EXPIRES_AT"));
  const currentTime = new Date().getTime() / 1000;

  // Assuming the token should be refreshed if it's about to expire in the next hour
  if (expiryTime > currentTime + 3600) return next();

  console.log("refresh tokens");

  const CLIENT_ID = Deno.env.get("CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");
  let REFRESH_TOKEN = (await getEnvVar(c, env, "REFRESH_TOKEN")) || "";

  if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
  if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

  const refreshResponse = await fetch(
    "https://www.strava.com/api/v3/oauth/token",
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    }
  );

  if (!refreshResponse.ok) throw new Error("Refresh Failed!");

  const refreshData = await refreshResponse.json();

  const tokenExpiresAt = refreshData.expires_at;
  REFRESH_TOKEN = refreshData.refresh_token;
  const ACCESS_TOKEN = refreshData.access_token;

  await env.execute(`
        UPDATE "users_strava_auth"
        SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
        REFRESH_TOKEN = '${REFRESH_TOKEN}',
        ACCESS_TOKEN_EXPIRES_AT = '${tokenExpiresAt as string}'
        WHERE id = '${userId}';
        `);

  console.log("refreshTokensIfExpired end");
  return next();
}

export async function getEnvVar(c: Context, env: Client, column: string) {
  const userId = c.get("userId");
  if (!userId) throw new Error("Missing userId");
  const res = (
    await env.execute(
      `SELECT * FROM "users_strava_auth" WHERE id = '${userId}';`
    )
  ).rows[0][column] as string;
  // console.log(`Var ${column} is ${res}`);
  return res;
}

/* BUG: If user deleted from auth but still has cookie
this will cause failures with login, handle gracefully*/
export const getSessionFromCookie = async (
  c: Context,
  next: () => Promise<void>
) => {
  console.log("getSessionFromCookie Start");

  const cookieHeader = c.req.header("Cookie");
  if (cookieHeader) {
    console.log("getSessionFromCookie Cookie found");

    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => c.split("="))
    );
    const sessionId = cookies["session_id"];
    const accessTokenCookie = cookies["access_token"];

    c.set("userId", sessionId);
    const env = c.get("env");
    // verify access_token matches current auth_db access token
    const accessToken = await getEnvVar(c, env, "ACCESS_TOKEN");
    if (accessToken !== accessTokenCookie) {
      console.log("getSessionFromCookie invalid accessToken");

      c.set("userId", undefined);
    }
  }
  console.log("getSessionFromCookie End");
  return await next();
};

export const setSessionCookie = async (
  c: Context,
  next: () => Promise<void>
) => {
  console.log("setsession start");
  const sessionId = c.get("userId");
  if (!sessionId) return await next();

  const env = c.get("env");
  const accessToken = await getEnvVar(c, env, "ACCESS_TOKEN");

  c.res.headers.append(
    "Set-Cookie",
    `session_id=${sessionId}; HttpOnly; Secure; Max-Age=86400; SameSite=Lax; Path=/`
  );
  c.res.headers.append(
    "Set-Cookie",
    `access_token=${accessToken}; HttpOnly; Secure; Max-Age=86400; SameSite=Lax; Path=/`
  );

  return await next();
};

export const getSessionFromHeader = async (
  c: Context,
  next: () => Promise<void>
) => {
  const userId = c.req.header("userId");
  if (!userId) throw new Error("No user Id.");
  c.set("userId", userId);
  return await next();
};
