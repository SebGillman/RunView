// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */

import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  addCharts,
  getAccessUrl,
  getHTMLDoc,
  getTokenExchange,
  refreshTokensIfExpired,
} from "./utils.ts";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";

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

// app.get("/landing-page", async (c: Context) => {
//   try {
//     let body = `<div id="myChart-parent" style="width:45%; height:50%;">
//   <canvas id="myChart" style="margin:20px"></canvas>
// </div>`;
//   } catch (error) {
//     return c.text(error);
//   }
// });

app.get("/activities", async (c: Context) => {
  try {
    await refreshTokensIfExpired(env);
    let { head, body } = await getHTMLDoc();

    body = await addCharts(body, env);

    return c.html(`
        <head>
        ${head.innerHTML}
        </head>
        <body>
        ${body.innerHTML}
        </body>
    `);
  } catch (error) {
    console.log(error);
    return c.redirect("/auth/login");
  }
});

app.get("/", (c: Context) => {
  return c.redirect("/activities");
});

Deno.serve(app.fetch);
