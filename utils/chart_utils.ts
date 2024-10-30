import { ChartData } from "../types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/src/dom/dom-parser.ts";
import { Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

export function barChart(
  body: Element,
  chartName: string,
  data: ChartData
): Element {
  const parser = new DOMParser();
  const dom = parser.parseFromString(body.innerHTML, "text/html");

  const nameWithoutDashes = chartName.replaceAll("-", "_");

  if (dom === null) throw new Error("Body does not exist!");

  const chart = body.getElementById(chartName);
  const parent = chart?.parentElement;

  if (!parent) throw new Error("This chart does not exist!");

  const chartScript = dom.createElement("script");
  const chartScriptText = `
                const element_${nameWithoutDashes} = document.getElementById("${chartName}");
                const chart_${nameWithoutDashes} = echarts.init(element_${nameWithoutDashes}, 'light',{
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
                        data: [${data.data_labels.map((date) =>
                          JSON.stringify(date)
                        )}],
                        axisLabel: {
                            // interval: 1,
                            color: 'black',
                            rotate: 40
                        }
                    },
                    yAxis: {
                        splitNumber: 3,
                        splitLine:{
                            lineStyle: {
                                color: 'rgba(0, 0, 0, 0.5)' // Change to your preferred color
                            }
                        },
                        axisLabel: {
                            color: 'black',
                            formatter: '{value} km'
                        },
                    },
                    series: [{
                        type: 'bar',
                        data: [${data.data_values.toString()}],
                        symbolSize: 10,
                        markLine: {
                            data: [{
                                type: 'average',
                                name: 'Average',
                                label: {
                                    formatter: function (params) {
                                        return Math.round(params.value)
                                    .toString();
                                    },
                                    show: true,
                                }
                            }],
                            lineStyle: {
                                color: 'black'
                            }
                        },
                        itemStyle: {
                            color: '#57481f'
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
  chartScript.textContent = `

    function initChart_${nameWithoutDashes}(){
        console.log("INIT CHART");
        const chart_ref_${nameWithoutDashes} = document.getElementById("${chartName}");
        const parent_ref_${nameWithoutDashes} = chart_ref_${nameWithoutDashes}?.parentElement;
        
        console.log("PARENT",parent_ref_${nameWithoutDashes})
        console.log("STATE",document.readyState)
        if (document.readyState !== "loading"){
            const chartScript = document.createElement("script");
            chartScript.textContent = \`${chartScriptText}\`;
            document.body.appendChild(chartScript);
        }else{
            document.addEventListener("DOMContentLoaded",function () {
                const chartScript = document.createElement("script");
                chartScript.textContent = \`${chartScriptText}\`;
                document.body.appendChild(chartScript);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const checkEChartsLoaded = setInterval(() => {
            if (window.echarts && document.readyState=="complete") {
                clearInterval(checkEChartsLoaded); // Stop polling when ECharts is available
                initChart_${nameWithoutDashes}(); // Call your chart initialization function
            }
        }, 100); // Poll every 100ms
    });
      `;

  const chartTitle = dom.createElement("h1");
  chartTitle.setAttribute(
    "style",
    "color:black; text-align:center; padding-top:10px"
  );
  chartTitle.innerHTML = data.title;

  parent.insertBefore(chartTitle, chart);
  parent.appendChild(chartScript);
  return body;
}

export function lineChart(
  body: Element,
  chartName: string,
  data: ChartData
): Element {
  const parser = new DOMParser();
  const dom = parser.parseFromString(body.innerHTML, "text/html");

  const nameWithoutDashes = chartName.replaceAll("-", "_");

  if (dom === null) throw new Error("Body does not exist!");

  const chartScript = dom.createElement("script");
  const chartScriptText = `
        var element = document.getElementById("${chartName}");
        var chart_${nameWithoutDashes} = echarts.init(element, 'light',{
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
              type: 'category',
              data: [${data.data_labels.map((date) => JSON.stringify(date))}],
              axisLabel: {
                  // interval: 1,
                  color: 'black',
                  rotate: 40
              }
          },
          yAxis: {
              type: 'value',
              splitNumber: 3,
              splitLine:{
                  lineStyle: {
                      color: 'rgba(0, 0, 0, 0.5)' // Change to your preferred color
                  }
              },
              axisLabel: {
                  color: 'black',
                  formatter: '{value} km'
              },
          },
          series: [{
              type: 'line',
              data: [${data.data_values.toString()}],
            //   symbolSize: 10,
              markLine: {
                  data: [{
                      type: 'average',
                      name: 'Average',
                      label: {
                          formatter: function (params) {
                              return Math.round(params.value)
                          .toString();
                          },
                          show: true,
                      }
                  }],
                  lineStyle: {
                      color: 'black'
                  }
              },
              itemStyle: {
                  color: '#57481f'
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

  chartScript.textContent = `

    function initChart_${nameWithoutDashes}(){
        console.log("INIT CHART");
        const chart_ref_${nameWithoutDashes} = document.getElementById("${chartName}");
        const parent_ref_${nameWithoutDashes} = chart_ref_${nameWithoutDashes}?.parentElement;
        
        console.log("PARENT",parent_ref_${nameWithoutDashes})
        console.log("STATE",document.readyState)

        if (document.readyState !== "loading" ){
            const chartScript = document.createElement("script");
            chartScript.textContent = \`${chartScriptText}\`;
            document.body.appendChild(chartScript);
        }else{
            document.addEventListener("DOMContentLoaded",function () {
                const chartScript = document.createElement("script");
                chartScript.textContent = \`${chartScriptText}\`;
                document.body.appendChild(chartScript);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const checkEChartsLoaded = setInterval(() => {
            if (window.echarts && document.readyState=="complete") {
                clearInterval(checkEChartsLoaded); // Stop polling when ECharts is available
                initChart_${nameWithoutDashes}(); // Call your chart initialization function
            }
        }, 100); // Poll every 100ms
    });
      `;

  const chart = body.getElementById(chartName);
  const parent = chart?.parentElement;

  if (!parent) throw new Error("This chart does not exist!");

  const chartTitle = dom.createElement("h1");
  chartTitle.setAttribute(
    "style",
    "color:black; text-align:center; padding-top:10px"
  );
  chartTitle.innerHTML = data.title;

  parent.insertBefore(chartTitle, chart);
  parent.appendChild(chartScript);
  return body;
}
