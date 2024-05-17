import { Context } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import { Client } from "npm:@libsql/client@0.6.0/node";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { Activity, chartData } from "./types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/src/dom/dom-parser.ts";
import {
  Element,
  HTMLDocument,
} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

export function getAccessUrl(env: Record<string, string>): string {
  try {
    const CLIENT_ID = env["CLIENT_ID"];
    const REDIRECT_URI = "http://localhost:8000/auth/access-code";

    const queryParams = {
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "activity:read_all,profile:read_all",
    };

    const url = new URL("https://www.strava.com/oauth/authorize");

    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const urlString = url.toString();

    return urlString;
  } catch (error) {
    throw new Error(error);
  }
}

export async function getTokenExchange(
  c: Context,
  envFile: Record<string, string>,
  env: Client
) {
  const CLIENT_ID = envFile["CLIENT_ID"];
  const CLIENT_SECRET = envFile["CLIENT_SECRET"];
  let REFRESH_TOKEN = (await getEnvVar(env, "REFRESH_TOKEN")) || "";
  let ACCESS_TOKEN = (await getEnvVar(env, "ACCESS_TOKEN")) || "";

  const reqUrl = new URL(c.req.url);
  const reqSearchParams = reqUrl.searchParams;
  if (!reqSearchParams.has("code")) {
    return c.redirect("/auth/login");
  }
  const accessCode = reqSearchParams.get("code");
  if (!accessCode) throw new Error("Missing access code");

  const tokenExchange = await fetch(
    "https://www.strava.com/api/v3/oauth/token",
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: accessCode,
        grant_type: "authorization_code", //todo
      }),
    }
  );
  if (!tokenExchange.ok) throw new Error("Token Exchange failed.");

  const tokenData = await tokenExchange.json();

  const tokenExpiresAt = tokenData.expires_at;
  // const tokenExpiresIn = tokenData.expires_in;
  REFRESH_TOKEN = tokenData.refresh_token;
  ACCESS_TOKEN = tokenData.access_token;

  env.execute(`
    UPDATE env
    SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
    REFRESH_TOKEN = '${REFRESH_TOKEN}',
    ACCESS_TOKEN_EXPIRES_AT = '${tokenExpiresAt as string}'
    WHERE id = '1';
    `);
}

export async function refreshTokensIfExpired(
  envFile: Record<string, string>,
  env: Client
) {
  const expiryTime = Number(await getEnvVar(env, "ACCESS_TOKEN_EXPIRES_AT"));
  const currentTime = new Date().getTime() / 1000;

  const CLIENT_ID = envFile["CLIENT_ID"];
  const CLIENT_SECRET = envFile["CLIENT_SECRET"];
  let REFRESH_TOKEN = (await getEnvVar(env, "REFRESH_TOKEN")) || "";

  if (expiryTime > currentTime + 3600) return;

  const refreshResponse = await fetch(
    "https://www.strava.com/api/v3/oauth/token",
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    }
  );

  if (!refreshResponse.ok) throw new Error("Refresh Failed!");

  const refreshData = await refreshResponse.json();

  const tokenExpiresAt = refreshData.expires_at;
  REFRESH_TOKEN = refreshData.refresh_token;
  const ACCESS_TOKEN = refreshData.access_token;

  env.execute(`
      UPDATE env
      SET ACCESS_TOKEN = '${ACCESS_TOKEN}',
      REFRESH_TOKEN = '${REFRESH_TOKEN}',
      ACCESS_TOKEN_EXPIRES_AT = '${tokenExpiresAt as string}'
      WHERE id = '1';
      `);
}

export async function getEnvVar(env: Client, column: string) {
  const res = (await env.execute(`SELECT * FROM env WHERE id = '1';`)).rows[0][
    column
  ] as string;
  // console.log(`Var ${column} is ${res}`);
  return res;
}

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

export async function getHTMLDoc(): Promise<HTMLDocument> {
  const parser = new DOMParser();
  const htmlContent = await Deno.readTextFile("./index.html");
  const doc = parser.parseFromString(htmlContent, "text/html");

  if (doc === null) throw new Error("HTML Template not found.");

  return doc;
}

export async function addCharts(body: Element, env: Client) {
  let bodyWithCharts = body;
  const client = new DB("./db/charts.db");

  const funcs: {
    [key: string]: (env: Client) => Promise<{ [key: string]: number }>;
  } = {
    getWeeklyDistance: getWeeklyDistance,
    getCurrentCumulativeYearDistance: getCurrentCumulativeYearDistance,
  };

  const chartTypes: {
    [key: string]: (
      body: Element,
      chartName: string,
      data: chartData
    ) => Element;
  } = {
    bar: barChart,
  };

  for (const node of body.querySelectorAll("canvas")) {
    if (!(node instanceof Element)) continue;

    const element = node as Element;
    const elementId = element.getAttribute("id");

    const query = client.query(
      `SELECT * FROM charts WHERE id = '${elementId}'`
    );

    if (!query.length) throw new Error("Data does not exist for this chart!");

    const [
      _chartId,
      chartType,
      chartTitle,
      chartXlabel,
      chartYlabel,
      chartFunc,
    ] = query[0] as [string, string, string, string, string, string];

    if (!(elementId && chartType === "bar")) continue;

    const data = await funcs[chartFunc](env);

    const outputData: chartData = {
      title: chartTitle,
      xlabel: chartXlabel,
      ylabel: chartYlabel,
      data_labels: Object.keys(data),
      data_values: Object.values(data),
    };

    bodyWithCharts = chartTypes[chartType](
      bodyWithCharts,
      elementId,
      outputData
    );
  }
  return bodyWithCharts;
}

export function barChart(
  body: Element,
  chartName: string,
  data: chartData
): Element {
  const parser = new DOMParser();
  const dom = parser.parseFromString(body.innerHTML, "text/html");

  const nameWithoutDashes = chartName.replaceAll("-", "_");

  if (dom === null) throw new Error("Body does not exist!");

  const chartScript = dom.createElement("script");
  chartScript.textContent = `
    var element = document.getElementById("${chartName}");
    var chart_${nameWithoutDashes} = echarts.init(element, 'dark',{
      useCoarsePointer: true,
      width:document.getElementById("${chartName}-parent").offsetWidth,
      height:document.getElementById("${chartName}-parent").offsetHeight
    });

    var options = {
      tooltip: {
          trigger: 'axis',
          confine: true
      },
      grid: {
          left: 60,
          right: 35,
          top: 10,
          bottom: 95,
      },
      xAxis: {
          data: [${data.data_labels.map((date) => JSON.stringify(date))}],
          axisLabel: {
              // interval: 1,
              rotate: 40
          }
      },
      yAxis: {
          splitNumber: 3,
          axisLabel: {
              formatter: '{value} km'
          },
      },
      series: [{
          type: 'bar',
          data: [${data.data_values.toString()}],
          symbolSize: 10,
          markLine: {
              data: [{
                  type: 'median',
                  name: 'Median',
                  label: {
                      formatter: function (params) {
                          return Math.round(params.value)
                      .toString();
                      },
                      show: true,
                  }
              }],
              lineStyle: {
                  color: 'white'
              }
          },
          itemStyle: {
              color: 'rgb(242, 102, 171)'
          },
          tooltip: {
              valueFormatter: value => value + ' kilometers'
          },
      }]
    };
    chart_${nameWithoutDashes}.setOption(options);
    window.addEventListener('resize', () => {
      chart_${nameWithoutDashes}.resize({
        width:document.getElementById("${chartName}-parent").offsetWidth,
        height:document.getElementById("${chartName}-parent").offsetHeight}
      )}
    );`;

  const chart = body.getElementById(chartName);
  const parent = chart?.parentElement;

  if (!parent) throw new Error("This chart does not exist!");

  const chartTitle = dom.createElement("h1");
  chartTitle.setAttribute(
    "style",
    "color:white; text-align:center; padding-top:10px"
  );
  chartTitle.innerHTML = data.title;

  parent.insertBefore(chartTitle, chart);
  parent.appendChild(chartScript);
  return body;
}

// function _groupActivitiesByWeek(data: Activity[]): {
//   [key: string]: Activity[];
// } {
//   const grouped: { [key: string]: Activity[] } = {};
//   data.forEach((item) => {
//     const date = new Date(item.start_date);
//     const week = `${date.getFullYear()}-${getWeek(date)}`;
//     if (!(week in grouped)) {
//       grouped[week] = [];
//     }
//     grouped[week].push(item);
//   });
//   return grouped;
// }
