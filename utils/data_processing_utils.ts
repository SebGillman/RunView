import { Client } from "npm:@libsql/client@0.6.0/node";
import { Activity } from "../types.ts";
import { getLoggedInAthleteActivities } from "./index.ts";

function getWeekStart(originalDate: Date): string {
  const date = new Date(originalDate.getTime());
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

export async function getWeeklyDistance(env: Client, filterYear?: string) {
  const data: Activity[] = await getLoggedInAthleteActivities(env);
  const grouped: { [key: string]: number } = {};
  data
    .filter((activity) => {
      return filterYear ? activity.start_date.startsWith(filterYear) : true;
    })
    .reverse()
    .forEach((item) => {
      const date = new Date(item.start_date);
      const week = `${date.getFullYear()}-${getWeekStart(date)}`;
      if (!(week in grouped)) {
        grouped[week] = 0;
      }
      grouped[week] = grouped[week] + item.distance / 1000;
    });

  const keys = Object.keys(grouped);

  const startDate = new Date(keys[0]);
  const endDate = new Date(keys[keys.length - 1]);

  const interpolatedGrouped: { [key: string]: number } = {};

  for (
    const date = startDate;
    date < endDate;
    date.setDate(date.getDate() + 7)
  ) {
    const dateString = `${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}`;

    interpolatedGrouped[dateString] =
      keys.indexOf(dateString) !== -1 ? grouped[dateString] : 0;
  }

  return interpolatedGrouped;
}

export async function getCumulativeWeeklyYearDistance(
  env: Client,
  year: string
) {
  const data: { [key: string]: number } = await getWeeklyDistance(env, year);
  let prev = 0;
  for (const key of Object.keys(data)) {
    data[key] += prev;
    prev = data[key];
  }
  return data;
}

export async function getCurrentCumulativeYearDistance(env: Client) {
  const res = await getCumulativeWeeklyYearDistance(env, "2024");
  return res;
}
