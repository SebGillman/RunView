import { Client } from "npm:@libsql/core/api";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { ChartData } from "../types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/src/dom/dom-parser.ts";
import {
  Element,
  HTMLDocument,
} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import {
  barChart,
  lineChart,
  getCurrentCumulativeYearDistance,
  getWeeklyRunDistance,
} from "./index.ts";
import { Context } from "https://deno.land/x/hono@v4.1.4/mod.ts";

export async function getHTMLDoc(path: string): Promise<HTMLDocument> {
  const parser = new DOMParser();
  const htmlContent = await Deno.readTextFile(`./${path}`);
  const doc = parser.parseFromString(htmlContent, "text/html");

  if (doc === null) throw new Error("HTML Template not found.");

  return doc;
}

export async function addCharts(c: Context, body: Element, env: Client) {
  let bodyWithCharts = body;
  const client = new DB("./db/charts.db");

  // Collect all chart elements
  const chartElements = Array.from(body.querySelectorAll("canvas"));

  // Get all chart IDs from the body at once for querying the database
  const chartIds = chartElements
    .map((el) => (el as Element).getAttribute("id"))
    .filter(Boolean);

  if (chartIds.length === 0) return bodyWithCharts;

  // Use parameterized query to retrieve data for all charts at once
  const chartDataRows = client.query(
    `SELECT * FROM charts WHERE id IN (${chartIds.map(() => "?").join(",")})`,
    chartIds
  );

  if (!chartDataRows.length) throw new Error("No data exists for the charts!");

  // Prepare functions and chart types once
  const funcs: Record<
    string,
    (c: Context, env: Client) => Promise<{ [key: string]: number }>
  > = {
    getWeeklyDistance: getWeeklyRunDistance,
    getCurrentCumulativeYearDistance: getCurrentCumulativeYearDistance,
  };

  const chartTypes: Record<
    string,
    (body: Element, chartName: string, data: ChartData) => Element
  > = {
    line: lineChart,
    bar: barChart,
  };

  // Process the charts in parallel
  const updatedCharts = await Promise.all(
    chartElements.map(async (element) => {
      if (!(element instanceof Element)) return bodyWithCharts;

      const elementId = (element as Element).getAttribute("id");
      const chartRow = chartDataRows.find(([id]) => id === elementId);

      if (!chartRow) return bodyWithCharts; // No chart data for this element

      const [
        _chartId,
        chartType,
        chartTitle,
        chartXlabel,
        chartYlabel,
        chartFunc,
      ] = chartRow as [string, string, string, string, string, string];

      // Skip if invalid chartType
      if (!(chartType in chartTypes)) return bodyWithCharts;

      // Fetch chart data in parallel
      const data = await funcs[chartFunc](c, env);

      const outputData: ChartData = {
        title: chartTitle,
        xlabel: chartXlabel,
        ylabel: chartYlabel,
        data_labels: Object.keys(data),
        data_values: Object.values(data),
      };

      // Update bodyWithCharts with the newly rendered chart
      return chartTypes[chartType](bodyWithCharts, elementId!, outputData);
    })
  );

  // Update the body with all charts
  bodyWithCharts = updatedCharts[updatedCharts.length - 1] || bodyWithCharts;

  return bodyWithCharts;
}
