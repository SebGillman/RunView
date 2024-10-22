import { type Context, Hono } from "jsr:@hono/hono";
import {
  getLeaderboard,
  getTilesWithinBounds,
  tileCache,
} from "../utils/index.ts";

const app = new Hono();

app.get("/leaderboard", async (c: Context) => {
  const { user_id } = c.req.query();
  return c.json(await getLeaderboard({ userId: parseInt(user_id) }));
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
