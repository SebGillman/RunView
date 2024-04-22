import { Context, Hono } from "https://deno.land/x/hono@v3.3.4/mod.ts";
import {
  getAccessUrl,
  getLoggedInAthlete,
  getLoggedInAthleteActivities,
  getTokenExchange,
} from "./utils.ts";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";

const env = new DB("./env.db");

const app = new Hono();

app.get(
  "/auth/login",
  async (c: Context) => {
    const accessUrl = await getAccessUrl(env);
    console.log("GO TO", accessUrl);
    return c.redirect(accessUrl);
  },
);

app.get(
  "/auth/access-code",
  async (c: Context) => {
    try {
      await getTokenExchange(c, env);

      const me = await getLoggedInAthlete(env);

      const myActivities = await getLoggedInAthleteActivities(env);

      return c.text(
        JSON.stringify(await me.json()) + "\n\n" +
          JSON.stringify(await myActivities.json()),
      );
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
