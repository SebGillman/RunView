import { Client } from "npm:@libsql/client@0.6.0/node";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { chartData } from "../types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/src/dom/dom-parser.ts";
import {
  Element,
  HTMLDocument,
} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import {
  barChart,
  lineChart,
  getCurrentCumulativeYearDistance,
  getWeeklyDistance,
} from "./index.ts";

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
    line: lineChart,
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

    if (!(elementId && Object.keys(chartTypes).indexOf(chartType) !== -1))
      continue;

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
