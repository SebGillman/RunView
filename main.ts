import { default as stravaImport, Strava } from "npm:strava-v3@2.2.0";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { Context, Hono } from "https://deno.land/x/hono@v3.3.4/mod.ts";
import { createConfig, getAccessUrl } from "./utils.ts";

const AUTH_TOKEN = Deno.env.get("AUTH_TOKEN");
const CLIENT_ID = Deno.env.get("CLIENT_ID");
const REDIRECT_URI = Deno.env.get("REDIRECT_URI");
const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");

const strava = stravaImport as unknown as Strava;

const config = createConfig(AUTH_TOKEN, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

strava.config(config);

const app = new Hono();

app.get(
  "/auth/login",
  async (c: Context) => {
    const accessUrl = await getAccessUrl(strava, config);
    return c.redirect(accessUrl);
  },
);

app.get(
  "/auth/access-code",
  async (c: Context) => {
    const reqUrl = new URL(c.req.url);
    const reqSearchParams = reqUrl.searchParams;
    if (!reqSearchParams.has("code")) {
      return c.redirect("/auth/login");
    }
    const accessCode = reqSearchParams.get("code");
    if (!accessCode) throw new Error("Invalid access code");
    Deno.env.set("ACCESS_CODE", accessCode);

    const tokenExchange = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      body: new URLSearchParams({
        ...config,
        "code": accessCode,
      }),
    });

    if (tokenExchange.ok) {
      const tokenData = await tokenExchange.json();
      console.log("Token Data:", tokenData);

      const tokenExpiresAt = tokenData.get("expires_at");
      const tokenExpiresIn = tokenData.get("expires_in");
      const refreshToken = tokenData.get("refresh_token");
      const accessToken = tokenData.get("access_token");

      return c.text(JSON.stringify(tokenData));
    } else {
      console.error(
        "Failed to exchange authorization code for token:",
        await tokenExchange.text(),
      );
    }
  },
);

app.get(
  "/",
  (c: Context) => {
    return c.text("Hello Deno!");
  },
);

Deno.serve(app.fetch);
