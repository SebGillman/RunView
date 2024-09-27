import { Context } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import { Client } from "npm:@libsql/core/api";
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
      username TEXT,
      resource_state TEXT,
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

  const userId = Number(c.get("userId"));
  if (!userId) throw new Error("Failed to retrieve userId.");

  const authenticatedUsers = await env.execute(
    `SELECT id FROM "users_strava_auth"`
  );
  const users = await db.execute("SELECT id,username FROM users");

  // if tables being created by webhook, user will be missing from authTable, therefore just store id in a placeholder row.
  if (!authenticatedUsers.rows.some((x) => x.id === userId)) {
    console.log("User missing from auth and user tables.");

    const user: Partial<Athlete> = { id: userId };
    const columns = Object.keys(user)
      .map((value) => JSON.stringify(value))
      .join(", ");
    const values = Object.values(user)
      .map((value) => `'${JSON.stringify(value)}'`)
      .join(", ");

    await db.execute(`INSERT INTO users (${columns}) VALUES (${values});`);
    console.log("Temporary user record created");
  } else if (!users.rows.some((x) => x.id === userId && x.username !== null)) {
    console.log("User missing from users table.");

    const user: Athlete = await getLoggedInAthlete(c, env);

    const columns = Object.keys(user)
      .map((value) => JSON.stringify(value))
      .join(", ");
    const values = Object.values(user)
      .map((value) => `'${JSON.stringify(value)}'`)
      .join(", ");

    await db.execute(
      `INSERT OR REPLACE INTO users (${columns}) VALUES (${values});`
    );
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
      max_watts REAL,
      average_watts REAL,
      weighted_average_watts REAL,
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
      kilojoules REAL,
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
      device_watts BOOLEAN,
      embed_token TEXT,
      similar_activities BLOB,
      available_zones BLOB,
      athlete BLOB,
      private_note TEXT
    );`
    );
    console.log("Created activity data table.");
  }

  const triggers = await db.execute(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'trigger'
        AND name = 'delete_activities_on_delete_athlete';`);

  if (
    triggers.rows.every(
      (row) => row.name !== "delete_activities_on_delete_athlete"
    )
  ) {
    await db.execute(`
    CREATE TRIGGER 'delete_activities_on_delete_athlete'
    AFTER DELETE ON users
    FOR EACH ROW
    BEGIN
      DELETE FROM activities
      WHERE athlete_id = OLD.id;
    END;
    `);
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

async function addUserOrActivityToDbById(
  c: Context,
  db: Client,
  env: Client,
  table: string,
  objectId: number
) {
  const funcMap: {
    [key: string]: (
      c: Context,
      env: Client,
      _objectId: number
    ) => Promise<Activity | Athlete>;
  } = {
    users: (c: Context, env: Client, _objectId: number) =>
      getLoggedInAthlete(c, env),
    activities: (c: Context, env: Client, objectId: number) =>
      getLoggedInAthleteActivityById(c, env, objectId),
  };

  const object = await funcMap[table](c, env, objectId);

  const columns = Object.keys(object)
    .map((column) => JSON.stringify(column))
    .join(", ");
  const values = Object.values(object)
    .map((value) => `'${JSON.stringify(value).replace(/'/g, "''")}'`)
    .join(", ");

  const res = await db.execute(`
      INSERT INTO ${table} (${columns})
      VALUES (${values})
      `);
  return res;
}

export async function eventHandler(
  c: Context,
  db: Client,
  env: Client,
  event: WebHookRequest
) {
  const objectType = event.object_type;
  let table;
  if (objectType == "athlete") {
    table = "users";
  } else if (objectType == "activity") {
    table = "activities";
  }
  if (!table) throw new Error("Invalid webhook payload");

  const ownerId = event.owner_id;
  const objectId = event.object_id;

  c.set("userId", table === "users" ? objectId : ownerId);
  await createUserDataTables(c, db, env);

  let res;

  if (event.aspect_type == "create") {
    res = await addUserOrActivityToDbById(c, db, env, table, objectId);
    console.log(`${objectType} created.`);
  } else if (event.aspect_type == "update") {
    const currentObjectIds = await db.execute(`SELECT id FROM ${table};`);

    if (currentObjectIds.rows.every((row) => row.id !== objectId)) {
      res = await addUserOrActivityToDbById(c, db, env, table, objectId);
    } else {
      const updateMap: { [key: string]: string } = {
        title: "name",
      };

      const updateString = Object.entries(event.updates)
        .map(
          ([key, value]) =>
            `'${updateMap[key]}'='${JSON.stringify(value).replace(/'/g, "''")}'`
        )
        .join(", ");

      res = await db.execute(`
      UPDATE ${table}
      SET ${updateString}
      WHERE id = ${objectId};
      `);
    }
    console.log(`${objectType} updated!`);
  } else if (event.aspect_type == "delete") {
    res = await db.execute(`DELETE FROM ${table} WHERE id = ${objectId};`);
    console.log(`${objectType} deleted.`);
  }
  return res;
}
