import { Context } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import { Client } from "npm:@libsql/core/api";
import { Activity, Athlete } from "../types.ts";
import { getEnvVar } from "./index.ts";

export async function getLoggedInAthlete(
  c: Context,
  env: Client
): Promise<Athlete> {
  const ACCESS_TOKEN = await getEnvVar(c, env, "ACCESS_TOKEN");
  const response = await fetch("https://www.strava.com/api/v3/athlete", {
    method: "GET",
    headers: new Headers({
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      Accept: "application/json",
    }),
  });
  const res = await response.json();
  return res;
}

export async function getLoggedInAthleteActivities(
  c: Context,
  env: Client,
  activityType: string,
  limit?: number
) {
  if (!limit) limit = 200;
  const ACCESS_TOKEN = await getEnvVar(c, env, "ACCESS_TOKEN");
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${limit}`,
    {
      method: "GET",
      headers: new Headers({
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Accept: "application/json",
      }),
    }
  );
  if (!response.ok) throw new Error("Retrieval of activities failed!");
  const res: Activity[] = await response.json();

  if (activityType === "") return res;

  return res.filter((activity) => {
    return activity.sport_type === activityType;
  });
}

export async function getLoggedInAthleteActivityById(
  c: Context,
  env: Client,
  id: number
): Promise<Activity> {
  const ACCESS_TOKEN = await getEnvVar(c, env, "ACCESS_TOKEN");
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${id}`,
    {
      method: "GET",
      headers: new Headers({
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Accept: "application/json",
      }),
    }
  );
  if (!response.ok) {
    console.log(response);
    throw new Error(`Retrieval of activity failed: id ${id}`);
  }

  const resJson: Activity = await response.json();
  resJson.athlete_id = resJson.athlete.id;
  return resJson;
}

export async function getActivityStream(
  c: Context,
  env: Client,
  activityId: number
): Promise<{ latlng: { data: Array<[number, number]> } }> {
  const ACCESS_TOKEN = await getEnvVar(c, env, "ACCESS_TOKEN");

  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng&key_by_type=true`,
    {
      method: "GET",
      headers: new Headers({
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Accept: "application/json",
      }),
    }
  );

  if (!res.ok) {
    throw new Error("ERROR: Failed to get activity stream!");
  }
  return await res.json();
}
