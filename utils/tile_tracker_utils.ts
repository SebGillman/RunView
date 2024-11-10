import { type Context } from "jsr:@hono/hono";
import { Client } from "npm:@libsql/core/api";
import { TileTrackerCoordPayload } from "../types.ts";
import { getActivityStream } from "./index.ts";
import { cache } from "jsr:@hono/hono/cache";

// TODO: Decache tiles in the bounding box of this activity
export async function passActivityToTileTracker(
  c: Context,
  env: Client,
  activityId: number,
  createdAt: number
) {
  const userId: number = Number(c.get("userId"));
  const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

  if (!tileTrackerUrl) {
    console.log(
      "ERROR: passActivityToTileTracker failed due to missing TILE_TRACKER_URL"
    );
    return;
  }

  const activityStream = await getActivityStream(c, env, activityId);
  if (activityStream.error || activityStream.latlng === undefined) {
    console.error(
      activityStream.status,
      "Failed to get activity coordinates:",
      activityStream.error
    );
    return;
  }

  const payload: TileTrackerCoordPayload = {
    userId,
    activityId,
    coords: activityStream.latlng.data,
    createdAt,
  };

  const res = await fetch(tileTrackerUrl + "/process-activity", {
    method: "POST",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.log(
      "ERROR [passActivityToTileTracker]",
      res.status,
      res.statusText
    );
    return;
  }

  console.log("Activity route posted to TileTracker.");
}

export async function getFullNameById(c: Context, user_id: string) {
  const db: Client = c.get("db");
  if (!db) throw new Error("Failed to get db");

  const res = await db.execute(
    `SELECT firstname, lastname FROM users WHERE id = "${user_id}";`
  );

  const row = res.rows[0];

  console.log(`${row.firstname} ${row.lastname}`);

  return `${row.firstname} ${row.lastname}`;
}

export async function getLeaderboard(options: {
  userId?: number;
  limit?: number;
  offset?: number;
  gameId?: number;
}) {
  const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

  const url = new URL(tileTrackerUrl + "/leaderboard");
  if (options.limit !== undefined && !isNaN(options.limit)) {
    url.searchParams.append("limit", `${options.limit}`);
  }
  if (options.offset !== undefined && !isNaN(options.offset)) {
    url.searchParams.append("offset", `${options.offset}`);
  }
  if (options.userId !== undefined && !isNaN(options.userId)) {
    url.searchParams.append("user_id", `${options.userId}`);
  }
  if (options.gameId !== undefined && !isNaN(options.gameId)) {
    url.searchParams.append("game_id", `${options.gameId}`);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
  });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return await res.json();
}

export async function getTilesWithinBounds(
  bottomLeftX: string,
  bottomLeftY: string,
  topRightX: string,
  topRightY: string,
  gameId: string
): Promise<{
  tiles: {
    x_index: number;
    activity_id: number;
    created_at: number;
    user_id: number;
    y_index: number;
  }[];
  tile_count?: number;
}> {
  const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

  const url = new URL(tileTrackerUrl + "/tiles");
  url.searchParams.append("x1", `${bottomLeftX}`);
  url.searchParams.append("y1", `${bottomLeftY}`);
  url.searchParams.append("x2", `${topRightX}`);
  url.searchParams.append("y2", `${topRightY}`);
  if (gameId) {
    url.searchParams.append("game_id", `${gameId}`);
  }

  const res = await fetch(url.toString(), { method: "GET" });

  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  const resJson = await res.json();
  return resJson;
}

export const tileCache = cache({
  cacheName: "tiles-in-range",
  cacheControl: "max-age=300",
  wait: true,
  keyGenerator: (c: Context) => c.req.url,
});
