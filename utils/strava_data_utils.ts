import { Client } from "npm:@libsql/client@0.6.0/node";
import { Activity } from "../types.ts";
import { getEnvVar } from "./index.ts";

export async function getLoggedInAthlete(env: Client): Promise<Activity[]> {
  const ACCESS_TOKEN = await getEnvVar(env, "ACCESS_TOKEN");
  const response = await fetch("https://www.strava.com/api/v3/athlete", {
    method: "GET",
    headers: new Headers({
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      Accept: "application/json",
    }),
  });
  return await response.json();
}

export async function getLoggedInAthleteActivities(
  env: Client,
  activityType: string,
  limit?: number
) {
  if (!limit) limit = 200;
  const ACCESS_TOKEN = await getEnvVar(env, "ACCESS_TOKEN");
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
  env: Client,
  id: number
): Promise<Activity> {
  const ACCESS_TOKEN = await getEnvVar(env, "ACCESS_TOKEN");
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
  return await response.json();
}
