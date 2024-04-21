import { default as stravaImport, Strava } from "npm:strava-v3@2.2.0";
import { Context, Hono } from "https://deno.land/x/hono@v3.3.4/mod.ts";
import { createConfig, getAccessUrl } from "./utils.ts";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";

const env = new DB("./env.db");

let ACCESS_TOKEN = env.query(`SELECT ACCESS_TOKEN FROM env;`)[0][0] as string;
const CLIENT_ID = env.query(`SELECT CLIENT_ID FROM env;`)[0][0] as string;
const REDIRECT_URI = env.query(`SELECT REDIRECT_URI FROM env;`)[0][0] as string;
const CLIENT_SECRET = env.query(
  `SELECT CLIENT_SECRET FROM env;`,
)[0][0] as string;
let REFRESH_TOKEN = env.query(`SELECT REFRESH_TOKEN FROM env;`)[0][0] as string;

const strava = stravaImport as unknown as Strava;

let config = createConfig(
  ACCESS_TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
);

strava.config(config);

const app = new Hono();

app.get(
  "/auth/login",
  async (c: Context) => {
    try {
      // const d = new Date();
      // const seconds = Math.round(d.getTime() / 1000);
      // const accessTokenExpirySeconds = Number(
      //   env.query("SELECT ACCESS_TOKEN_EXPIRES_AT FROM env;")[0][0],
      // );
      // if (
      //   isNaN(accessTokenExpirySeconds) ||
      //   accessTokenExpirySeconds - seconds < 60 * 60
      // ) throw new Error();
      const accessUrl = await getAccessUrl(strava, config);
      return c.redirect(accessUrl);
    } catch {
      console.log("CORRECT");
      const refreshResponse = await fetch(
        "https://www.strava.com/api/v3/oauth/token",
        {
          method: "POST",
          headers: new Headers({
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": REFRESH_TOKEN,
          }),
        },
      );
      const refreshResponseJSON = await refreshResponse.json();
      console.log(refreshResponseJSON);
      return c.text("");
      const {
        expires_at: expiresAt,
      } = refreshResponseJSON;

      ACCESS_TOKEN = refreshResponseJSON.access_token;
      REFRESH_TOKEN = refreshResponseJSON.refresh_token;
      env.execute(`
      UPDATE env
      SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
      REFRESH_TOKEN = '${REFRESH_TOKEN}',
      ACCESS_TOKEN_EXPIRES_AT = '${expiresAt as string}'
      WHERE CLIENT_ID = '${CLIENT_ID}';
      `);

      const config = createConfig(
        ACCESS_TOKEN,
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI,
      );
      const accessUrl = await getAccessUrl(strava, config);
      return c.redirect(accessUrl);
    }
  },
);

app.get(
  "/auth/access-code",
  async (c: Context) => {
    try {
      const reqUrl = new URL(c.req.url);
      const reqSearchParams = reqUrl.searchParams;
      console.log(reqSearchParams);
      if (!reqSearchParams.has("code")) {
        return c.redirect("/auth/login");
      }
      const accessCode = reqSearchParams.get("code");
      if (!accessCode) throw new Error("Invalid access code");
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
        config = createConfig(
          ACCESS_TOKEN,
          CLIENT_ID,
          CLIENT_SECRET,
          REDIRECT_URI,
        );
        // strava.config(config);

        const me = await fetch(
          "https://www.strava.com/api/v3/athlete",
          {
            method: "GET",
            headers: new Headers({
              "Authorization": `Bearer ${ACCESS_TOKEN}`,
              "Accept": "application/json",
            }),
          },
        );

        const myActivities = await fetch(
          "https://www.strava.com/api/v3/athlete/activities",
          {
            method: "GET",
            headers: new Headers({
              "Authorization": `Bearer ${ACCESS_TOKEN}`,
              "Accept": "application/json",
            }),
          },
        );

        return c.text(
          "HELLO" + "\n\n" +
            JSON.stringify(await me.json()) + "\n\n" +
            JSON.stringify(await myActivities.json()),
        );
      } else {
        return c.text("ERROR OCCURED");
      }
    } catch (error) {
      return c.text(error);
    }
  },
);

app.get(
  "/",
  (c: Context) => {
    return c.redirect("/auth/login");
  },
);

Deno.serve(app.fetch);
