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

export async function getTokenExchange(c: Context, env: Client) {
  const CLIENT_ID = Deno.env.get("CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");
  let REFRESH_TOKEN = (await getEnvVar(env, "REFRESH_TOKEN")) || "";
  let ACCESS_TOKEN = (await getEnvVar(env, "ACCESS_TOKEN")) || "";

  if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
  if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

  const reqUrl = new URL(c.req.url);
  const reqSearchParams = reqUrl.searchParams;
  if (!reqSearchParams.has("code")) {
    return c.redirect("/auth/login");
  }
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

  const tokenExpiresAt = tokenData.expires_at;
  // const tokenExpiresIn = tokenData.expires_in;
  REFRESH_TOKEN = tokenData.refresh_token;
  ACCESS_TOKEN = tokenData.access_token;

  env.execute(`
      UPDATE "users_strava_auth"
      SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
      REFRESH_TOKEN = '${REFRESH_TOKEN}',
      ACCESS_TOKEN_EXPIRES_AT = '${tokenExpiresAt as string}'
      WHERE id = '1';
      `);
}

export async function refreshTokensIfExpired(env: Client) {
  const expiryTime = Number(await getEnvVar(env, "ACCESS_TOKEN_EXPIRES_AT"));
  const currentTime = new Date().getTime() / 1000;

  const CLIENT_ID = Deno.env.get("CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");
  let REFRESH_TOKEN = (await getEnvVar(env, "REFRESH_TOKEN")) || "";

  if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
  if (!CLIENT_SECRET) throw new Error("Missing CLIENT_SECRET");

  if (expiryTime > currentTime + 3600) return;

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

  env.execute(`
        UPDATE env
        SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
        REFRESH_TOKEN = '${REFRESH_TOKEN}',
        ACCESS_TOKEN_EXPIRES_AT = '${tokenExpiresAt as string}'
        WHERE id = '1';
        `);
}

export async function getEnvVar(env: Client, column: string) {
  const res = (
    await env.execute(`SELECT * FROM "users_strava_auth" WHERE id = '1';`)
  ).rows[0][column] as string;
  // console.log(`Var ${column} is ${res}`);
  return res;
}
