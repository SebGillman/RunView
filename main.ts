// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */

import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  barChart,
  getAccessUrl,
  // getLoggedInAthlete,
  getLoggedInAthleteActivities,
  getTokenExchange,
  getWeeklyDistance,
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

    const weeklyActivities = getWeeklyDistance(myActivities);

    const data: BarChartData = {
      title: "Distance Per Week",
      xlabel: "Week",
      ylabel: "Distance",
      bar_labels: Object.keys(weeklyActivities).toReversed(),
      bar_values: Object.values(weeklyActivities).toReversed(),
    };

    const head = `<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.2/dist/echarts.min.js"></script>`;
    let body = `<div id="myChart-parent" style="width:45%; height:50%;">
  <canvas id="myChart" style="margin:20px"></canvas>
</div>`;

    body = barChart(body, "myChart", data);

    return c.html(`
<head>
${head}
</head>
<body>
${body}
</body>
`);
  } catch (error) {
    return c.text(error);
  }
});

app.get("/", (c: Context) => {
  return c.redirect("/auth/login");
});

Deno.serve(app.fetch);
