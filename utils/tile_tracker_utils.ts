import { Context } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import { Client } from "npm:@libsql/core/api";
import { TileTrackerCoordPayload } from "../types.ts";
import { getActivityStream } from "./index.ts";

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

  const payload: TileTrackerCoordPayload = {
    userId,
    activityId,
    coords: activityStream.latlng.data,
    createdAt,
  };
  const body: FormData = new FormData();
  Object.entries(payload).forEach(([k, v]) => body.append(k, v));

  const res = await fetch(tileTrackerUrl + "/process-activity", {
    method: "POST",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(
      "ERROR [passActivityToTileTracker]",
      res.status,
      res.statusText
    );
    return;
  }

  console.log("Activity route posted to TileTracker.");
}

export async function getLeaderboard(
  c: Context,
  limit?: number,
  offset?: number
) {
  const userId = c.get("userId");
  const tileTrackerUrl = Deno.env.get("TILE_TRACKER_URL");

  const url = new URL(tileTrackerUrl + "/leaderboard");
  if (limit !== undefined) url.searchParams.append("limit", `${limit}`);
  if (offset !== undefined) url.searchParams.append("offset", `${offset}`);
  if (userId !== undefined) url.searchParams.append("userId", `${userId}`);

  return await fetch(url.toString(), {
    method: "GET",
  });
}
