import { type Context, Hono } from "jsr:@hono/hono";
import {
  getLeaderboard,
  getTilesWithinBounds,
  tileCache,
} from "../utils/index.ts";
import { getSessionFromCookie } from "../utils/auth_utils.ts";

const app = new Hono();

app.get("/leaderboard", getSessionFromCookie, async (c: Context) => {
  const userId = c.get("userId");
  return c.json(await getLeaderboard({ userId: parseInt(userId) }));
});

app.get("/in-range", async (c: Context) => {
  console.log("GET TILES");

  const { bottomLeftX, bottomLeftY, topRightX, topRightY } = c.req.query();
  if (![bottomLeftX, bottomLeftY, topRightX, topRightY].every((t) => !!t)) {
    return c.json({}, 403);
  }

  const tilesWithinBounds = await getTilesWithinBounds(
    bottomLeftX,
    bottomLeftY,
    topRightX,
    topRightY
  );
  return c.json(tilesWithinBounds);
});
export default app;
