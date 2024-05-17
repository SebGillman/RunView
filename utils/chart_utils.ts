import { chartData } from "../types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/src/dom/dom-parser.ts";
import { Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

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