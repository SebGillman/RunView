// /** @jsxImportSource https://esm.sh/hono@v4.1.4/jsx */
import { createClient } from "npm:@libsql/client@0.6.0/node";
import { Context, Hono } from "https://deno.land/x/hono@v4.1.4/mod.ts";
import {
  addCharts,
  getAccessUrl,
  getHTMLDoc,
  getTokenExchange,
  refreshTokensIfExpired,
} from "./utils.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

const envFile = await load();

const env = createClient({
  url: "file:auth.db",
  encryptionKey: Deno.env.get(envFile["AUTH_ENCRYPTION_KEY"]),
});

const app = new Hono();

app.get("/auth/login", async (c: Context) => {
  const accessUrl = await getAccessUrl(envFile);
  return c.redirect(accessUrl);
});

app.get("/auth/access-code", async (c: Context) => {
  try {
    await getTokenExchange(c, envFile, env);

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
    await refreshTokensIfExpired(envFile, env);
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
    console.error(error);
    return c.redirect("/auth/login");
  }
});

app.get("/", (c: Context) => {
  return c.redirect("/activities");
});

Deno.serve(app.fetch);
