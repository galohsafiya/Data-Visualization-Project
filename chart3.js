// ============================================================
// Chart 3: Education Spending vs Adult Literacy Rate
// With zoom & pan support
// ============================================================

(function () {
  // Dimensions
  const MARGIN = { top: 50, right: 160, bottom: 70, left: 70 };
  const WIDTH  = 820 - MARGIN.left - MARGIN.right;
  const HEIGHT = 500 - MARGIN.top  - MARGIN.bottom;

  // Income group colours
  const REGION_COLOURS = {
    "High Income":         "#4e8df5",
    "Upper-Middle Income": "#f5a623",
    "Lower-Middle Income": "#7ed321",
    "Low Income":          "#e03e3e",
    "Unknown":             "#aaaaaa",
  };

  function incomeGroup(d) {
    const lit = +d.lit_rate_adult_pct;
    const exp = +d.gov_exp_pct_gdp;
    if (isNaN(lit) || isNaN(exp)) return "Unknown";
    if (lit >= 95 && exp >= 4)   return "High Income";
    if (lit >= 85)               return "Upper-Middle Income";
    if (lit >= 65)               return "Lower-Middle Income";
    return "Low Income";
  }

  /* ── state ── */
  let svg, xScale, yScale, xScaleOrig, yScaleOrig;
  let xAxisG, yAxisG, xGridG, yGridG;
  let dotsG, trendLine, tooltip;
  let zoomBehaviour, currentTransform = d3.zoomIdentity;
  let allData = [], currentClean = [];

  // ── public API ────────────────────────────────────────────
  window.initScatterPlot = function (rawData) {
    allData = rawData;
    _build();
    window.updateScatterPlot(rawData);
  };

  window.updateScatterPlot = function (filteredData) {
    currentClean = filteredData.filter(
      d => !isNaN(+d.gov_exp_pct_gdp) && !isNaN(+d.lit_rate_adult_pct)
    );
    // Reset zoom when data changes so new domain fits
    currentTransform = d3.zoomIdentity;
    if (zoomBehaviour) {
      d3.select("#chart3 svg").call(zoomBehaviour.transform, d3.zoomIdentity);
    }
    _update(currentClean);
  };

  // ── build (once) ─────────────────────────────────────────
  function _build() {
    d3.select("#chart3").selectAll("*").remove();

    const container = d3.select("#chart3");

    // Header
    container.append("h2")
      .attr("class", "chart-title")
      .text("Education Spending vs. Adult Literacy Rate");

    container.append("p")
      .attr("class", "chart-subtitle")
      .text("Scatter plot exploring whether higher government education investment is associated with better literacy outcomes. Scroll to zoom · drag to pan · double-click to reset.");

    // Controls
    const controls = container.append("div").attr("class", "scatter-controls");

    controls.append("label").text("Filter by Year: ");
    const yearSel = controls.append("select").attr("id", "scatter-year-filter");
    yearSel.append("option").attr("value", "all").text("All Years");

    controls.append("label").attr("style", "margin-left:16px").text("Show Trend Line ");
    controls.append("input")
      .attr("type", "checkbox")
      .attr("id", "scatter-trendline")
      .property("checked", true);

    // Reset zoom button
    controls.append("button")
      .attr("id", "scatter-zoom-reset")
      .attr("style", "margin-left:16px;padding:4px 10px;border:1px solid #ccc;border-radius:6px;background:#fafafa;cursor:pointer;font-size:0.88rem;")
      .text("Reset Zoom");

    // Root SVG
    const rootSvg = container.append("svg")
      .attr("width",  WIDTH  + MARGIN.left + MARGIN.right)
      .attr("height", HEIGHT + MARGIN.top  + MARGIN.bottom)
      .attr("class", "scatter-svg");

    // Clip path so dots/trendline stay inside plot area
    rootSvg.append("defs").append("clipPath")
      .attr("id", "scatter-clip")
      .append("rect")
      .attr("width", WIDTH)
      .attr("height", HEIGHT);

    svg = rootSvg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    xScale     = d3.scaleLinear().range([0, WIDTH]);
    yScale     = d3.scaleLinear().range([HEIGHT, 0]);
    xScaleOrig = xScale.copy();
    yScaleOrig = yScale.copy();

    // Gridline groups (behind dots)
    xGridG = svg.append("g").attr("class", "grid grid-x").attr("transform", `translate(0,${HEIGHT})`);
    yGridG = svg.append("g").attr("class", "grid grid-y");

    // Clipped content group (dots + trend line)
    const plotG = svg.append("g").attr("clip-path", "url(#scatter-clip)");

    // Dots group
    dotsG = plotG.append("g").attr("class", "dots-group");

    // Trend line inside clipped group
    trendLine = plotG.append("line")
      .attr("class", "trend-line")
      .style("stroke", "#e03e3e")
      .style("stroke-width", 2)
      .style("stroke-dasharray", "6,4")
      .style("opacity", 0.85);

    // Axes
    xAxisG = svg.append("g").attr("class", "axis axis-x").attr("transform", `translate(0,${HEIGHT})`);
    yAxisG = svg.append("g").attr("class", "axis axis-y");

    // Axis labels
    svg.append("text").attr("class", "axis-label")
      .attr("x", WIDTH / 2).attr("y", HEIGHT + 55)
      .attr("text-anchor", "middle")
      .text("Government Education Expenditure (% of GDP)");

    svg.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -HEIGHT / 2).attr("y", -55)
      .attr("text-anchor", "middle")
      .text("Adult Literacy Rate (%)");

    // Chart title
    svg.append("text").attr("class", "svg-chart-label")
      .attr("x", WIDTH / 2).attr("y", -20)
      .attr("text-anchor", "middle")
      .text("Relationship Between Education Spending and Literacy");

    // Legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${WIDTH + 20}, 20)`);

    Object.entries(REGION_COLOURS).forEach(([label, colour], i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
      row.append("circle").attr("r", 6).attr("cx", 6).attr("cy", 0).attr("fill", colour);
      row.append("text").attr("x", 16).attr("y", 4).attr("class", "legend-label").text(label);
    });

    // Tooltip
    tooltip = d3.select("body").append("div")
      .attr("class", "scatter-tooltip chart-tooltip")
      .style("opacity", 0)
      .style("pointer-events", "none");

  // ── Zoom behaviour ──────────────────────────────────────
    zoomBehaviour = d3.zoom()
      .scaleExtent([0.5, 20])
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .translateExtent([[-WIDTH, -HEIGHT], [2 * WIDTH, 2 * HEIGHT]])
      .on("zoom", _onZoom);

    // Apply zoom directly to the root SVG
    rootSvg.call(zoomBehaviour)
      .on("dblclick.zoom", _resetZoom); // double-click resets

    // Style the root SVG to show grab cursors appropriately
    rootSvg.style("cursor", "grab")
      .on("mousedown", function () {
        d3.select(this).style("cursor", "grabbing");
      })
      .on("mouseup mouseleave", function () {
        d3.select(this).style("cursor", "grab");
      });


    // Year dropdown
    const years = [...new Set(allData.map(d => +d.year))].sort(d3.ascending);
    years.forEach(y => yearSel.append("option").attr("value", y).text(y));

    yearSel.on("change", function () {
      const val    = this.value;
      const subset = val === "all" ? allData : allData.filter(d => +d.year === +val);
      window.updateScatterPlot(subset);
      if (typeof window.onDashboardFilter === "function") window.onDashboardFilter({ year: val });
    });

    d3.select("#scatter-trendline").on("change", function () {
      trendLine.style("display", this.checked ? null : "none");
    });

    d3.select("#scatter-zoom-reset").on("click", _resetZoom);
  }

  // ── zoom handler ─────────────────────────────────────────
  function _onZoom(event) {
    currentTransform = event.transform;

    // Rescale axes from original domains
    const newX = currentTransform.rescaleX(xScaleOrig);
    const newY = currentTransform.rescaleY(yScaleOrig);

    // Update live scales (used by dots / trendline)
    xScale.domain(newX.domain());
    yScale.domain(newY.domain());

    // Redraw axes
    xAxisG.call(d3.axisBottom(xScale).ticks(6).tickFormat(d => d + "%"));
    yAxisG.call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d + "%"));

    // Redraw gridlines
    xGridG.call(d3.axisBottom(xScale).ticks(6).tickSize(-HEIGHT).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").style("stroke", "#e0e0e0").style("stroke-dasharray", "3,3"));

    yGridG.call(d3.axisLeft(yScale).ticks(6).tickSize(-WIDTH).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").style("stroke", "#e0e0e0").style("stroke-dasharray", "3,3"));

    // Reposition dots (no transition during zoom for responsiveness)
    dotsG.selectAll(".dot")
      .attr("cx", d => xScale(+d.gov_exp_pct_gdp))
      .attr("cy", d => yScale(+d.lit_rate_adult_pct));

    // Reposition trend line
    _updateTrendLine(currentClean);
  }

  function _resetZoom() {
    currentTransform = d3.zoomIdentity;
    d3.select("#chart3 svg")
      .transition().duration(500)
      .call(zoomBehaviour.transform, d3.zoomIdentity);
  }

  // ── update (on filter change) ─────────────────────────────
  function _update(data) {
    const xExt = d3.extent(data, d => +d.gov_exp_pct_gdp);
    const yExt = d3.extent(data, d => +d.lit_rate_adult_pct);
    const xPad = (xExt[1] - xExt[0]) * 0.08 || 1;
    const yPad = (yExt[1] - yExt[0]) * 0.05 || 2;

    const xDomain = [Math.max(0, xExt[0] - xPad), xExt[1] + xPad];
    const yDomain = [Math.max(0, yExt[0] - yPad), Math.min(100, yExt[1] + yPad)];

    xScale.domain(xDomain);
    yScale.domain(yDomain);
    xScaleOrig = xScale.copy();
    yScaleOrig = yScale.copy();

    // Gridlines
    xGridG.transition().duration(500)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-HEIGHT).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").style("stroke", "#e0e0e0").style("stroke-dasharray", "3,3"));

    yGridG.transition().duration(500)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-WIDTH).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").style("stroke", "#e0e0e0").style("stroke-dasharray", "3,3"));

    // Axes
    xAxisG.transition().duration(500).call(d3.axisBottom(xScale).ticks(6).tickFormat(d => d + "%"));
    yAxisG.transition().duration(500).call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d + "%"));

    // Dots
    const dots = dotsG.selectAll(".dot").data(data, d => d.country + d.year);

    dots.exit()
      .transition().duration(300)
      .attr("r", 0).style("opacity", 0)
      .remove();

    const dotsEnter = dots.enter().append("circle")
      .attr("class", "dot")
      .attr("r", 0)
      .style("opacity", 0)
      .attr("cx", d => xScale(+d.gov_exp_pct_gdp))
      .attr("cy", d => yScale(+d.lit_rate_adult_pct));

    dotsEnter.merge(dots)
      .on("mouseover", function (event, d) {
        d3.select(this).raise()
          .transition().duration(100)
          .attr("r", 10)
          .style("stroke", "#222").style("stroke-width", 2);

        tooltip.style("opacity", 1)
          .html(`
            <strong>${d.country}</strong> (${d.year})<br/>
            Gov. Spending: <b>${(+d.gov_exp_pct_gdp).toFixed(2)}%</b><br/>
            Adult Literacy: <b>${(+d.lit_rate_adult_pct).toFixed(1)}%</b><br/>
            Category: <b>${incomeGroup(d)}</b>
          `);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.pageX + 14) + "px")
          .style("top",  (event.pageY - 36) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).transition().duration(100)
          .attr("r", 5).style("stroke", "none");
        tooltip.style("opacity", 0);
      })
      .transition().duration(600)
      .attr("r", 5)
      .style("opacity", 0.75)
      .attr("fill", d => REGION_COLOURS[incomeGroup(d)])
      .attr("cx", d => xScale(+d.gov_exp_pct_gdp))
      .attr("cy", d => yScale(+d.lit_rate_adult_pct));

    // Trend line & Pearson r
    _updateTrendLine(data);
  }

  function _updateTrendLine(data) {
    if (data.length < 2) return;

    const xs = data.map(d => +d.gov_exp_pct_gdp);
    const ys = data.map(d => +d.lit_rate_adult_pct);
    const { slope, intercept } = leastSquares(xs, ys);

    const x1 = d3.min(xs), x2 = d3.max(xs);
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;

    trendLine
      .attr("x1", xScale(x1)).attr("y1", yScale(Math.min(100, Math.max(0, y1))))
      .attr("x2", xScale(x2)).attr("y2", yScale(Math.min(100, Math.max(0, y2))));

    svg.selectAll(".corr-label").remove();
    const r = pearsonR(xs, ys);
    svg.append("text").attr("class", "corr-label")
      .attr("x", WIDTH - 10).attr("y", 14)
      .attr("text-anchor", "end")
      .attr("font-size", "12px")
      .attr("fill", "#e03e3e")
      .text(`r = ${r.toFixed(3)}  (Pearson correlation)`);
  }

  // ── Helpers ───────────────────────────────────────────────
  function leastSquares(xs, ys) {
    const xM  = d3.mean(xs), yM = d3.mean(ys);
    const num = d3.sum(xs.map((x, i) => (x - xM) * (ys[i] - yM)));
    const den = d3.sum(xs.map(x => (x - xM) ** 2));
    const slope = den === 0 ? 0 : num / den;
    return { slope, intercept: yM - slope * xM };
  }

  function pearsonR(xs, ys) {
    const xM = d3.mean(xs), yM = d3.mean(ys);
    const num = d3.sum(xs.map((x, i) => (x - xM) * (ys[i] - yM)));
    const den = Math.sqrt(
      d3.sum(xs.map(x => (x - xM) ** 2)) *
      d3.sum(ys.map(y => (y - yM) ** 2))
    );
    return den === 0 ? 0 : num / den;
  }

})();