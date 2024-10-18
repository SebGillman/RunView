import { type Context, Hono } from "jsr:@hono/hono";
import {
  getAccessUrl,
  getTokenExchange,
  setSessionCookie,
} from "../utils/index.ts";

const app = new Hono();

app.get("/login", async (c: Context) => {
  console.log("LOGIN START");
  const accessUrl = await getAccessUrl();
  return c.redirect(accessUrl);
});

app.get("/access-code", getTokenExchange, setSessionCookie, (c: Context) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.redirect("/auth/login");
  }
  return c.redirect("/home");
});
export default app;
