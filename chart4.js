// ============================================================
// Chart 4: Top & Bottom Countries by Tertiary Enrollment Rate
// ============================================================

(function () {
  // Dimensions
  const MARGIN = { top: 60, right: 40, bottom: 140, left: 70 };
  const WIDTH  = 860 - MARGIN.left - MARGIN.right;
  const HEIGHT = 500 - MARGIN.top  - MARGIN.bottom;

  const COLOUR_TOP    = "#4e8df5";  // blue  — top countries
  const COLOUR_BOTTOM = "#e03e3e";  // red   — bottom countries
  const N = 10;                     // how many top / bottom to show

  /* ── state ── */
  let svg, xScale, yScale, xAxis, yAxis, tooltip, allData = [];
  let currentMode = "top";          // "top" | "bottom" | "both"

  // ── public API (mirrors chart3 pattern) ──────────────────────
  window.initBarChart = function (rawData) {
    allData = rawData;
    _build();
    window.updateBarChart(rawData);
  };

  window.updateBarChart = function (filteredData) {
    const clean = filteredData.filter(
      (d) => !isNaN(+d.school_enrol_tertiary_pct) && +d.school_enrol_tertiary_pct > 0
    );
    _update(clean);
  };

  // ── build (once) ─────────────────────────────────────────────
  function _build() {
    d3.select("#chart4").selectAll("*").remove();

    const container = d3.select("#chart4");

    // Header
    container.append("h2")
      .attr("class", "chart-title")
      .text("Tertiary Education Enrollment: Top & Bottom Countries");

    container.append("p")
      .attr("class", "chart-subtitle")
      .text("Comparing countries with the highest and lowest rates of enrollment in higher education (universities & technical schools).");

    // Controls row
    const controls = container.append("div").attr("class", "bar-controls");

    // Year filter
    controls.append("label").text("Filter by Year: ");
    const yearSel = controls.append("select").attr("id", "bar-year-filter");
    yearSel.append("option").attr("value", "all").text("All Years (average)");
    const years = [...new Set(allData.map(d => +d.year))].sort(d3.ascending);
    years.forEach(y => yearSel.append("option").attr("value", y).text(y));

    // Top / Bottom / Both toggle
    controls.append("label").attr("style", "margin-left:20px").text("Show: ");
    const modeSel = controls.append("select").attr("id", "bar-mode-filter");
    [["top", `Top ${N}`], ["bottom", `Bottom ${N}`], ["both", `Top & Bottom ${N}`]]
      .forEach(([val, label]) => modeSel.append("option").attr("value", val).text(label));

    // N selector
    controls.append("label").attr("style", "margin-left:20px").text("N: ");
    const nSel = controls.append("select").attr("id", "bar-n-filter");
    [5, 10, 15, 20].forEach(n => {
      const opt = nSel.append("option").attr("value", n).text(n);
      if (n === N) opt.attr("selected", true);
    });

    // SVG
    svg = container.append("svg")
      .attr("width",  WIDTH  + MARGIN.left + MARGIN.right)
      .attr("height", HEIGHT + MARGIN.top  + MARGIN.bottom)
      .attr("class", "bar-svg")
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Gridlines placeholder
    svg.append("g").attr("class", "grid grid-y-bar");

    // Axes
    xScale = d3.scaleBand().range([0, WIDTH]).padding(0.25);
    yScale = d3.scaleLinear().range([HEIGHT, 0]);

    xAxis = svg.append("g").attr("class", "axis axis-x").attr("transform", `translate(0,${HEIGHT})`);
    yAxis = svg.append("g").attr("class", "axis axis-y");

    // Axis labels
    svg.append("text").attr("class", "axis-label")
      .attr("x", WIDTH / 2).attr("y", HEIGHT + MARGIN.bottom - 10)
      .attr("text-anchor", "middle")
      .text("Country");

    svg.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -HEIGHT / 2).attr("y", -55)
      .attr("text-anchor", "middle")
      .text("Tertiary Enrollment Rate (%)");

    // Chart title inside SVG
    svg.append("text").attr("class", "svg-chart-label")
      .attr("x", WIDTH / 2).attr("y", -25)
      .attr("text-anchor", "middle")
      .text("Tertiary Enrollment Rate by Country");

    // Legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${WIDTH - 180}, -45)`);

    [[COLOUR_TOP, `Top N`], [COLOUR_BOTTOM, `Bottom N`]].forEach(([colour, label], i) => {
      const row = legend.append("g").attr("transform", `translate(${i * 100}, 0)`);
      row.append("rect").attr("width", 14).attr("height", 14).attr("y", -10).attr("rx", 3).attr("fill", colour);
      row.append("text").attr("x", 18).attr("y", 2).attr("class", "legend-label").text(label);
    });

    // Value labels group (rendered above bars)
    svg.append("g").attr("class", "value-labels");

    // Tooltip
    tooltip = d3.select("body").append("div")
      .attr("class", "bar-tooltip chart-tooltip")
      .style("opacity", 0)
      .style("pointer-events", "none");

    // ── Event listeners ──
    yearSel.on("change", _onFilterChange);
    modeSel.on("change", function () {
      currentMode = this.value;
      _onFilterChange.call(yearSel.node());
    });
    nSel.on("change", _onFilterChange);
  }

  function _onFilterChange() {
    const yearVal = d3.select("#bar-year-filter").property("value");
    const subset  = yearVal === "all"
      ? allData
      : allData.filter(d => +d.year === +yearVal);
    window.updateBarChart(subset);
    if (typeof window.onDashboardFilter === "function") {
      window.onDashboardFilter({ year: yearVal });
    }
  }

// ── update (on every filter change) ─────────────────────────
  function _update(data) {
    const nVal      = +d3.select("#bar-n-filter").property("value") || N;
    currentMode     = d3.select("#bar-mode-filter").property("value") || "top";

    // Aggregate: average per country (when "all years" is selected)
    const byCountry = d3.rollup(
      data,
      v => d3.mean(v, d => +d.school_enrol_tertiary_pct),
      d => d.country
    );

    let entries = [...byCountry.entries()]
      .map(([country, value]) => ({ country, value }))
      .sort((a, b) => d3.descending(a.value, b.value));

    // Build display set based on mode
    let displayData = [];
    if (currentMode === "top") {
      displayData = entries.slice(0, nVal).map(d => ({ ...d, group: "top" }));
    } else if (currentMode === "bottom") {
      displayData = entries.slice(-nVal).reverse().map(d => ({ ...d, group: "bottom" }));
    } else {
      // "both" — top N then bottom N separated by a gap marker
      const top    = entries.slice(0, nVal).map(d => ({ ...d, group: "top" }));
      const bottom = entries.slice(-nVal).reverse().map(d => ({ ...d, group: "bottom" }));
      displayData  = [...top, ...bottom];
    }

    // ── Scales ──
    xScale.domain(displayData.map(d => d.country));
    yScale.domain([0, Math.min(150, d3.max(displayData, d => d.value) * 1.12)]);

    // Gridlines
    svg.select(".grid-y-bar")
      .transition().duration(500)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-WIDTH).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").style("stroke", "#e0e0e0").style("stroke-dasharray", "3,3"));

    // Axes
    xAxis.transition().duration(500)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-40)")
      .attr("text-anchor", "end")
      .attr("dx", "-0.5em")
      .attr("dy", "0.2em")
      .style("font-size", displayData.length > 12 ? "10px" : "12px");

    yAxis.transition().duration(500)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d + "%"));

    // ── Bars ──
    const bars = svg.selectAll(".bar").data(displayData, d => d.country + "_" + d.group);

    // Exit: Shrink old bars smoothly out of view
    bars.exit()
      .transition().duration(250)
      .attr("y", HEIGHT)
      .attr("height", 0)
      .style("opacity", 0)
      .remove();

    // Enter: Start new bars at zero height
    const barsEnter = bars.enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => xScale(d.country))
      .attr("width", xScale.bandwidth())
      .attr("y", HEIGHT)
      .attr("height", 0)
      .style("opacity", 0)
      .attr("rx", 3);

    // Enter + Update: Animate layout transitions smoothly together
    barsEnter.merge(bars)
      .on("mouseover", function (event, d) {
        d3.select(this)
          .raise()
          .transition().duration(100)
          .style("opacity", 1)
          .style("stroke", "#222").style("stroke-width", 1.5);

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${d.country}</strong><br/>
            Tertiary Enrollment: <b>${d.value.toFixed(2)}%</b><br/>
            Rank: <b>${d.group === "top" ? "Top" : "Bottom"} ${nVal}</b>
          `);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.pageX + 14) + "px")
          .style("top",  (event.pageY - 36) + "px");
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition().duration(100)
          .style("opacity", 0.82)
          .style("stroke", "none");
        tooltip.style("opacity", 0);
      })
      // Static structural modifications run instantly
      .attr("width", xScale.bandwidth()) 
      .attr("fill", d => d.group === "top" ? COLOUR_TOP : COLOUR_BOTTOM)
      .transition().duration(600)
      .attr("x", d => xScale(d.country))
      .attr("y", d => yScale(d.value))
      .attr("height", d => HEIGHT - yScale(d.value))
      .style("opacity", 0.82);

    // ── Value labels above bars ──
    // FIX: Synced composite key assignment implemented here
    const labels = svg.select(".value-labels")
      .selectAll(".bar-label").data(displayData, d => d.country + "_" + d.group);

    // Clean exit tracking prevents layout collisions
    labels.exit()
      .transition().duration(250)
      .style("opacity", 0)
      .remove();

    const labelsEnter = labels.enter().append("text")
      .attr("class", "bar-label")
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#444")
      .style("opacity", 0)
      .attr("x", d => xScale(d.country) + xScale.bandwidth() / 2)
      .attr("y", HEIGHT);

    labelsEnter.merge(labels)
      .transition().duration(600)
      .attr("x", d => xScale(d.country) + xScale.bandwidth() / 2)
      .attr("y", d => yScale(d.value) - 5)
      .style("opacity", 1)
      .text(d => d.value.toFixed(1) + "%");

    // ── Divider line between top/bottom groups ──
    svg.selectAll(".group-divider").remove();
    if (currentMode === "both" && displayData.length > nVal) {
      const lastTop   = displayData[nVal - 1];
      const dividerX  = xScale(lastTop.country) + xScale.bandwidth() + xScale.step() * xScale.paddingInner() / 2;
      svg.append("line")
        .attr("class", "group-divider")
        .attr("x1", dividerX).attr("y1", 0)
        .attr("x2", dividerX).attr("y2", HEIGHT)
        .style("stroke", "#bbb")
        .style("stroke-dasharray", "5,4")
        .style("stroke-width", 1.5);

      svg.append("text").attr("class", "group-divider")
        .attr("x", xScale(displayData[0].country) + 4)
        .attr("y", 14)
        .attr("font-size", "11px").attr("fill", COLOUR_TOP)
        .text(`▲ Top ${nVal}`);

      svg.append("text").attr("class", "group-divider")
        .attr("x", xScale(displayData[nVal].country) + 4)
        .attr("y", 14)
        .attr("font-size", "11px").attr("fill", COLOUR_BOTTOM)
        .text(`▼ Bottom ${nVal}`);
    }
  }

})();