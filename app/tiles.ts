import { type Context, Hono } from "jsr:@hono/hono";
import { getLeaderboard, getTilesWithinBounds } from "../utils/index.ts";
import { getSessionFromCookie } from "../utils/auth_utils.ts";

const app = new Hono();

app.post("/create-game", getSessionFromCookie, async (c: Context) => {
  const userId = Number(c.get("userId"));
  if (!userId) throw new Error("No userId found from cookie");

  const {
    game_name,
    is_team_game,
    team_list,
    owner_team,
  }: {
    game_name: string;
    is_team_game: boolean;
    team_list: string[];
    owner_team: string;
  } = await c.req.json();

  const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

  const createGameRes = await fetch(tileTrackerUrl + "/create-game", {
    method: "POST",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      name: game_name,
      teams: is_team_game,
      owner_id: userId,
    }),
  });

  if (!createGameRes.ok)
    throw new Error("Create game did not finish successfully");

  const { game_id }: { game_id: number } = await createGameRes.json();

  // add teams to game
  if (is_team_game) {
    const addTeamsRes = await fetch(tileTrackerUrl + "/add-teams", {
      method: "POST",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(
        team_list.map((name: string) => ({
          game_id,
          team: name,
        }))
      ),
    });

    if (!addTeamsRes.ok)
      throw new Error("Game created, but teams failed to be added");
    await addTeamsRes.json();
  }
  // add owner to game

  const addUserRes = await fetch(tileTrackerUrl + "/add-player", {
    method: "POST",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      user_id: userId,
      game_id,
      team: is_team_game ? owner_team : null,
    }),
  });

  if (!addUserRes.ok) throw new Error("Game created, but failed to add player");
  await addUserRes.json();

  return c.text("ok");
});

app.get("/user-games", getSessionFromCookie, async (c: Context) => {
  const userId = c.get("userId");
  if (!userId) throw new Error("No userId found from cookie");

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
  const game_id = c.req.query("game_id") || "1";
  const userId = c.get("userId");
  return c.json(
    await getLeaderboard({
      userId: parseInt(userId),
      gameId: parseInt(game_id),
    })
  );
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
