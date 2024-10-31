import { type Context, Hono } from "jsr:@hono/hono";
import { getLeaderboard, getTilesWithinBounds } from "../utils/index.ts";
import { getSessionFromCookie } from "../utils/auth_utils.ts";

const app = new Hono();

app.get("/user-games", getSessionFromCookie, async (c: Context) => {
  const userId = c.get("userId");
  const params = new URLSearchParams({ user_id: userId });

  const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

  const res = await fetch(tileTrackerUrl + "/user-games?" + params.toString());
  if (!res.ok) throw new Error("Request failed");
  return c.json(await res.json());
});

app.get("/game-teams", async (c: Context) => {
  const { game_id } = c.req.query();
  const params = new URLSearchParams({ game_id: game_id });

  const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

  const res = await fetch(tileTrackerUrl + "/teams?" + params.toString());
  if (!res.ok) throw new Error("Request failed");
  return c.json(await res.json());
});

app.get("/leaderboard", getSessionFromCookie, async (c: Context) => {
  const userId = c.get("userId");
  return c.json(await getLeaderboard({ userId: parseInt(userId) }));
});

app.get("/in-range", async (c: Context) => {
  console.log("GET TILES");

  const { bottomLeftX, bottomLeftY, topRightX, topRightY, game_id } =
    c.req.query();
  if (![bottomLeftX, bottomLeftY, topRightX, topRightY].every((t) => !!t)) {
    return c.json({}, 403);
  }

  const tilesWithinBounds = await getTilesWithinBounds(
    bottomLeftX,
    bottomLeftY,
    topRightX,
    topRightY,
    game_id
  );
  return c.json(tilesWithinBounds);
});
export default app;
