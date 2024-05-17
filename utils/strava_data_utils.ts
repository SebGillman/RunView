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

export async function getLoggedInAthleteActivities(env: Client) {
  const ACCESS_TOKEN = await getEnvVar(env, "ACCESS_TOKEN");
  const response = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=200",
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
  return res.filter((activity) => {
    return activity.sport_type === "Run";
  });
}
