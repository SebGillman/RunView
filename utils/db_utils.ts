import { Context } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import { Client } from "npm:@libsql/core/api";
import { getLoggedInAthlete } from "./index.ts";
import { getLoggedInAthlete, getLoggedInAthleteActivityById } from "./index.ts";
import { Athlete, WebHookRequest } from "../types.ts";
import { Activity } from "../types.ts";

export async function createUserDataTables(
  c: Context,
  db: Client,
  env: Client
) {
  // console.log("USER DATA START");
  const tables = await db.execute(`
  SELECT name 
  FROM sqlite_master 
  WHERE type = 'table';`);

  if (tables.rows.every((x) => x.name !== `users`)) {
    console.log("Users table missing");
    await db.execute(
      `CREATE TABLE "users" (
      id INTEGER PRIMARY KEY NOT NULL,
      username TEXT NOT NULL,
      resource_state TEXT NOT NULL,
      firstname REAL,
      lastname REAL,
      bio TEXT,
      city TEXT,
      state INTEGER,
      country TEXT,
      sex TEXT,
      premium BOOLEAN,
      summit BOOLEAN,
      created_at TEXT,
      updated_at TEXT,
      badge_type_id INTEGER,
      weight INTEGER,
      profile_medium TEXT,
      profile TEXT,
      friend  BOOLEAN,
      follower  BOOLEAN,
      blocked BOOLEAN,
      can_follow BOOLEAN,
      follower_count INTEGER,
      friend_count INTEGER,
      mutual_friend_count INTEGER,
      athlete_type INTEGER,
      date_preference TEXT,
      measurement_preference TEXT,
      clubs BLOB,
      postable_clubs_count INTEGER,
      ftp  BLOB,
      bikes BLOB,
      shoes BLOB,
      is_winback_via_upload BOOLEAN,
      is_winback_via_view BOOLEAN
    );`
    );
    console.log("Users table created!");
  }

  const user: Athlete = await getLoggedInAthlete(c, env);
  if (!user.id) throw new Error("Failed to retrieve userId.");

  const users = await db.execute("SELECT id FROM users");

  if (!users.rows.some((x) => x.id === user.id)) {
    console.log("User missing from users table.");

    const columns = Object.keys(user)
      .map((value) => JSON.stringify(value))
      .join(", ");
    const values = Object.values(user)
      .map((value) => `'${JSON.stringify(value)}'`)
      .join(", ");

    await db.execute(`INSERT INTO users (${columns}) VALUES (${values});`);
    console.log("User record created");
  }

  if (tables.rows.every((x) => x.name !== `activities`)) {
    await db.execute(
      `CREATE TABLE activities (
      id INTEGER UNIQUE NOT NULL,
      resource_state INTEGER,
      athlete_id INTEGER NOT NULL,
      name TEXT,
      distance REAL,
      moving_time REAL,
      elapsed_time REAL,
      total_elevation_gain REAL,
      type TEXT,
      sport_type TEXT,
      workout_type INTEGER,
      start_date TEXT,
      start_date_local TEXT,
      timezone TEXT,
      utc_offset INTEGER,
      location_city TEXT,
      location_state TEXT,
      location_country TEXT,
      achievement_count INTEGER,
      kudos_count INTEGER,
      comment_count INTEGER,
      athlete_count INTEGER,
      photo_count INTEGER,
      map BLOB,
      trainer BOOLEAN,
      commute BOOLEAN,
      manual BOOLEAN,
      private BOOLEAN,
      visibility TEXT,
      flagged BOOLEAN,
      gear_id TEXT,
      start_latlng BLOB,
      end_latlng BLOB,
      average_speed REAL,
      average_cadence REAL,
      max_speed REAL,
      has_heartrate BOOLEAN,
      max_heartrate REAL,
      average_heartrate REAL,
      heartrate_opt_out BOOLEAN,
      display_hide_heartrate_option BOOLEAN,
      elev_high REAL,
      elev_low REAL,
      upload_id INTEGER,
      upload_id_str TEXT,
      external_id TEXT,
      from_accepted_tag BOOLEAN,
      pr_count INTEGER,
      total_photo_count INTEGER,
      has_kudoed BOOLEAN,
      description  TEXT,
      weight_volume REAL,
      calories REAL,
      perceived_exertion INTEGER,
      prefer_perceived_exertion BOOLEAN,
      segment_efforts BLOB,
      splits_metric BLOB,
      splits_standard BLOB,
      laps BLOB,
      best_efforts BLOB,
      gear BLOB,
      photos BLOB,
      stats_visibility BLOB,
      hide_from_home BOOLEAN,
      device_name TEXT,
      embed_token TEXT,
      similar_activities BLOB,
      available_zones BLOB,
      athlete BLOB
    );`
    );
    console.log("Created activity data table.");
  }

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
