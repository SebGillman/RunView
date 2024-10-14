import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  getLeaderboard,
  getTilesWithinBounds,
  refreshTokensIfExpired,
} from "../utils/index.ts";

const app = new Hono();

app.get("/leaderboard", async (c: Context) => {
  const { user_id } = c.req.query();
  return c.json(await getLeaderboard({ userId: parseInt(user_id) }));
});

app.get("/in-range", async (c: Context) => {
  const { bottomLeftX, bottomLeftY, topRightX, topRightY } = c.req.query();
  return c.json(
    await getTilesWithinBounds(bottomLeftX, bottomLeftY, topRightX, topRightY)
  );
});
export default app;
