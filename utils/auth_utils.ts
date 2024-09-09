import { Context } from "https://deno.land/x/hono@v4.1.4/mod.ts";
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
    throw new Error(error);
  }
}

export const getTokenExchange = (env: Client) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const CLIENT_ID = Deno.env.get("CLIENT_ID");
      const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");

      if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
      if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

      const reqUrl = new URL(c.req.url);
      const reqSearchParams = reqUrl.searchParams;

      const accessCode = reqSearchParams.get("code");
      if (!accessCode) throw new Error("Missing access code");

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
      if (!tokenExchange.ok) throw new Error("Token Exchange failed.");

      const tokenData = await tokenExchange.json();

      const userId = tokenData.athlete.id;
      c.set("userId", userId);

      const tokenExpiresAt = tokenData.expires_at;
      // const tokenExpiresIn = tokenData.expires_in;
      const REFRESH_TOKEN = tokenData.refresh_token;
      const ACCESS_TOKEN = tokenData.access_token;

      env.execute(`
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
      console.error(e);
    }
    await next();
  };
};

export const refreshTokensIfExpired = (env: Client) => {
  return async (c: Context, next: () => Promise<void>) => {
    if (!c.get("userId")) return await next();
    const expiryTime = Number(
      await getEnvVar(c, env, "ACCESS_TOKEN_EXPIRES_AT")
    );
    const currentTime = new Date().getTime() / 1000;

    const CLIENT_ID = Deno.env.get("CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");
    let REFRESH_TOKEN = (await getEnvVar(c, env, "REFRESH_TOKEN")) || "";

    if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
    if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

    if (expiryTime > currentTime + 3600) return await next();

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

    const userId = c.get("userId");
    env.execute(`
        UPDATE "users_strava_auth"
        SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
        REFRESH_TOKEN = '${REFRESH_TOKEN}',
        ACCESS_TOKEN_EXPIRES_AT = '${tokenExpiresAt as string}'
        WHERE id = '${userId}';
        `);

    return await next();
  };
};

export async function getEnvVar(c: Context, env: Client, column: string) {
  const userId = c.get("userId");
  const res = (
    await env.execute(
      `SELECT * FROM "users_strava_auth" WHERE id = '${userId}';`
    )
  ).rows[0][column] as string;
  // console.log(`Var ${column} is ${res}`);
  return res;
}

export const getSession = async (c: Context, next: () => Promise<void>) => {
  const cookieHeader = c.req.header("Cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => c.split("="))
    );
    const sessionId = cookies["session_id"];
    c.set("userId", sessionId);
  }
  await next();
};

export const setSession = async (c: Context, next: () => Promise<void>) => {
  console.log("setsession start");
  const sessionId = c.get("userId");
  c.header(
    "Set-Cookie",
    `session_id=${sessionId}; HttpOnly; Secure; Max-Age=86400; SameSite=Lax;Path=/`
  );
  await next();
};
