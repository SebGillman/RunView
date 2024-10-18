import { getLeaderboard, getTilesWithinBounds } from "../utils/index.ts";
import { type Context, Hono } from "jsr:@hono/hono";

const app = new Hono();

app.get("/leaderboard", async (c: Context) => {
  const { user_id } = c.req.query();
  return c.json(await getLeaderboard({ userId: parseInt(user_id) }));
});

app.get("/in-range", async (c: Context) => {
  const { bottomLeftX, bottomLeftY, topRightX, topRightY } = c.req.query();
  if (![bottomLeftX, bottomLeftY, topRightX, topRightY].every((t) => !!t)) {
    return c.json({}, 403);
  }
  return c.json(
    await getTilesWithinBounds(bottomLeftX, bottomLeftY, topRightX, topRightY)
  );
});
export default app;
