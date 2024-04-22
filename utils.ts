import { Context } from "https://deno.land/x/hono@v3.3.4/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";

export function createConfig(
  ACCESS_TOKEN: string | undefined,
  CLIENT_ID: string | undefined,
  CLIENT_SECRET: string | undefined,
  REDIRECT_URI: string | undefined,
) {
  if (!ACCESS_TOKEN) {
    throw new Error("No AUTH_TOKEN provided");
  }
  if (!CLIENT_ID) {
    throw new Error("No CLIENT_ID provided");
  }
  if (!CLIENT_SECRET) {
    throw new Error("No CLIENT_SECRET provided");
  }
  if (!REDIRECT_URI) {
    throw new Error("No REDIRECT_URI provided");
  }
  return {
    "access_token": ACCESS_TOKEN,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": REDIRECT_URI,
    "approval_prompt": "auto",
    "grant_type": "authorization_code",
  };
}

export async function getAccessUrl(
  env: DB,
): Promise<string> {
  try {
    const CLIENT_ID = await getEnvVar(env, "CLIENT_ID");
    const REDIRECT_URI = await getEnvVar(env, "REDIRECT_URI");

    const queryParams = {
      "client_id": CLIENT_ID,
      "redirect_uri": REDIRECT_URI,
      "response_type": "code",
      "scope": "activity:read_all,profile:read_all",
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

export async function getTokenExchange(
  c: Context,
  env: DB,
) {
  const CLIENT_ID = getEnvVar(env, "CLIENT_ID");
  const CLIENT_SECRET = getEnvVar(env, "CLIENT_SECRET");
  let REFRESH_TOKEN = getEnvVar(env, "REFRESH_TOKEN");
  let ACCESS_TOKEN = getEnvVar(env, "ACCESS_TOKEN");

  const reqUrl = new URL(c.req.url);
  const reqSearchParams = reqUrl.searchParams;
  console.log(reqSearchParams);
  if (!reqSearchParams.has("code")) {
    return c.redirect("/auth/login");
  }
  const accessCode = reqSearchParams.get("code");
  if (!accessCode) throw new Error("Missing access code");
  env.execute(`UPDATE env
      SET ACCESS_CODE = '${accessCode}'
      WHERE CLIENT_ID = '${CLIENT_ID}';
      `);

  const tokenExchange = await fetch(
    "https://www.strava.com/api/v3/oauth/token",
    {
      method: "POST",
      body: new URLSearchParams({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": accessCode,
        "grant_type": "authorization_code", //todo
      }),
    },
  );
  // console.log(tokenExchange);
  if (tokenExchange.ok) {
    const tokenData = await tokenExchange.json();

    const tokenExpiresAt = tokenData.expires_at;
    // const tokenExpiresIn = tokenData.expires_in;
    REFRESH_TOKEN = tokenData.refresh_token;
    ACCESS_TOKEN = tokenData.access_token;

    env.execute(`
      UPDATE env
      SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
      REFRESH_TOKEN = '${REFRESH_TOKEN}',
      ACCESS_TOKEN_EXPIRES_AT = '${tokenExpiresAt as string}'
      WHERE CLIENT_ID = '${CLIENT_ID}';
      `);
  } else {
    throw new Error("Token Exchange failed.");
  }
}

export function getEnvVar(env: DB, column: string) {
  return env.query(`SELECT ${column} FROM env;`)[0][0] as string;
}

export async function getLoggedInAthlete(env: DB) {
  const ACCESS_TOKEN = getEnvVar(env, "ACCESS_TOKEN");
  return await fetch(
    "https://www.strava.com/api/v3/athlete",
    {
      method: "GET",
      headers: new Headers({
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Accept": "application/json",
      }),
    },
  );
}

export async function getLoggedInAthleteActivities(env: DB) {
  const ACCESS_TOKEN = getEnvVar(env, "ACCESS_TOKEN");
  return await fetch(
    "https://www.strava.com/api/v3/athlete/activities",
    {
      method: "GET",
      headers: new Headers({
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Accept": "application/json",
      }),
    },
  );
}
