import { Client } from "npm:@libsql/client@0.6.0/node";
import { Activity } from "../types.ts";
import { getLoggedInAthleteActivities } from "./index.ts";

function getWeekStart(originalDate: Date): string {
  const date = new Date(originalDate.getTime());
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

export async function getWeeklyDistance(env: Client) {
  const data: Activity[] = await getLoggedInAthleteActivities(env);
  const grouped: { [key: string]: number } = {};
  data.reverse().forEach((item) => {
    const date = new Date(item.start_date);
    const week = `${date.getFullYear()}-${getWeekStart(date)}`;
    if (!(week in grouped)) {
      grouped[week] = 0;
    }
    grouped[week] = grouped[week] + item.distance / 1000;
  });
  return grouped;
}

export async function getCumulativeYearDistance(env: Client, year: string) {
  const data: Activity[] = await getLoggedInAthleteActivities(env);
  const grouped: { [key: string]: number } = {};
  let prevWeek: string;
  data
    .filter((activity) => {
      return activity.start_date.startsWith(year);
    })
    .reverse()
    .forEach((item) => {
      const date = new Date(item.start_date);
      const week = `${date.getFullYear()}-${getWeekStart(date)}`;
      if (!(week in grouped)) {
        prevWeek ? (grouped[week] = grouped[prevWeek]) : (grouped[week] = 0);
        prevWeek = week;
      }
      grouped[week] = grouped[week] + item.distance / 1000;
    });
  return grouped;
}

export async function getCurrentCumulativeYearDistance(env: Client) {
  const res = await getCumulativeYearDistance(env, "2024");
  return res;
}
