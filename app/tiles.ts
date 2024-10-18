import { type Context, Hono } from "jsr:@hono/hono";
import {
  getLeaderboard,
  getTilesWithinBounds,
  tileInRangeCache,
} from "../utils/index.ts";
import { getSessionFromCookie } from "../utils/auth_utils.ts";

const app = new Hono();

app.get("/leaderboard", async (c: Context) => {
  const { user_id } = c.req.query();
  return c.json(await getLeaderboard({ userId: parseInt(user_id) }));
});

app.get(
  "/in-range",
  getSessionFromCookie,
  tileInRangeCache,
  async (c: Context) => {
    console.log("GET TILES");
    const userId = Number(c.get("userId"));

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

    // if session provided by cookie
    if (userId) {
      tilesWithinBounds.user_id = userId;
    }
    return c.json(tilesWithinBounds);
  }
);
export default app;
