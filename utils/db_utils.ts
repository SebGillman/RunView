import { Client } from "npm:@libsql/core/api";
import { getLoggedInAthlete } from "./index.ts";

export async function createUserDataTables(db: Client, env: Client) {
  // console.log("USER DATA START");
  const tables = await db.execute(`
  SELECT name 
  FROM sqlite_master 
  WHERE type = 'table';`);

  const { id } = await getLoggedInAthlete(env);
  if (!id) throw new Error("Failed to retrieve id.");

  if (tables.rows.some((x) => x.name === `user-${id}`)) {
    console.log("User data table already exists");
    return;
  }

  await db.execute(
    `CREATE TABLE "user-${id}" (
      id INTEGER PRIMARY KEY NOT NULL,
      activity_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      distance REAL,
      weight REAL,
      description TEXT,
      gear_id TEXT,
      elapsed_time INTEGER,
      max_speed REAL,
      average_speed REAL
    );`
  );
  console.log("Created user data table.");
  return;
}

export async function createAuthTable(env: Client) {
  const tables = await env.execute(`
  SELECT name 
  FROM sqlite_master 
  WHERE type = 'table';`);

  if (tables.rows.some((x) => x.name === `users_strava_auth`)) {
    console.log("User strava auth table already exists");
    return;
  }

  await env.execute(
    `CREATE TABLE "users_strava_auth" (
      id INTEGER PRIMARY KEY NOT NULL,
      ACCESS_TOKEN TEXT,
      ACCESS_TOKEN_EXPIRES_AT TEXT,
      REFRESH_TOKEN TEXT
    );`
  );
  console.log("User strava auth table created");
  return;
}
