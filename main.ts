// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */

import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  barChart,
  getAccessUrl,
  // getLoggedInAthlete,
  getLoggedInAthleteActivities,
  getTokenExchange,
} from "./utils.ts";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { Activity, BarChartData } from "./types.ts";

const env = new DB("./auth.db");

const app = new Hono();

app.get("/auth/login", async (c: Context) => {
  const accessUrl = await getAccessUrl(env);
  console.log("GO TO", accessUrl);
  return c.redirect(accessUrl);
});

app.get("/auth/access-code", async (c: Context) => {
  try {
    await getTokenExchange(c, env);

    // const me = await getLoggedInAthlete(env);
    return c.redirect("/activities");
  } catch (error) {
    return c.text(error);
  }
});

app.get("/activities", async (c: Context) => {
  try {
    const myActivities: Activity[] = await getLoggedInAthleteActivities(env);

    let activities = "";

    myActivities.forEach((activity) => {
      activities =
        activities +
        `
        
        Athlete ID: ${activity.athlete.id}
        Activity Name: ${activity.name}
        Date: ${activity.start_date}
        Distance: ${activity.distance}
        `;
    });

    return c.text(activities);
  } catch (error) {
    return c.text(error);
  }
});

app.get("/", (c: Context) => {
  return c.redirect("/auth/login");
});

app.get("/haha", (c: Context) => {
  const head = `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`;
  let body = `<div style="width:50%">
  <canvas id="myChart"></canvas>
</div>`;

  const data: BarChartData = {
    title: "Title",
    xlabel: "x",
    ylabel: "y",
    bar_labels: ["a", "b", "c", "d"],
    bar_values: [1, 2, 3, 4],
  };

  body = barChart(body, "myChart", data);

  return c.html(`
  <head>
  ${head}
  </head>
  <body>
  ${body}
  </body>
  `);
});

Deno.serve(app.fetch);
