// ============================================================
// Chart 1: Literacy Rate Trend Over Time (Line Chart)
// Attributes: year, country, lit_rate_adult_pct
// Interactivity: country filter, hover tooltip, line highlight,
//                smooth transitions
// ============================================================

(function () {
  "use strict";

  const DATA_PATH = "cleaned_world_education_dataset.csv";
  const MARGIN = { top: 30, right: 178, bottom: 55, left: 65 };

  const COLOR_PALETTE = [
    "#4f8fcf", "#e07b5a", "#63bfa3", "#f4c95d", "#8e6bbf",
    "#5aab6e", "#e05a8e", "#6bbfe0", "#c4a35a", "#a34444"
  ];

  // ── state ──────────────────────────────────────────────────
  let allData = [];
  let svg, chartG, xScale, yScale;
  let tooltip;
  let selectedCountries = [];
  let innerW, innerH;

  // ── build SVG skeleton ────────────────────────────────────
  function buildSvg() {
    const container = document.getElementById("chart1");
    const W = Math.max(container.clientWidth || 0, 480);
    const H = 430;
    innerW = W - MARGIN.left - MARGIN.right;
    innerH = H - MARGIN.top - MARGIN.bottom;

    d3.select("#chart1").selectAll("*").remove();

    svg = d3.select("#chart1")
      .append("svg")
      .attr("width", "100%")
      .attr("height", H);

    chartG = svg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const yearExtent = d3.extent(allData, d => d.year);
    xScale = d3.scaleLinear().domain(yearExtent).range([0, innerW]);
    yScale = d3.scaleLinear().domain([0, 105]).range([innerH, 0]);

    // ── grid ──
    chartG.append("g").attr("class", "grid")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-innerH).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").attr("stroke", "#e7f0f5").attr("stroke-dasharray", "3,3"));

    chartG.append("g").attr("class", "grid")
      .call(d3.axisLeft(yScale).ticks(7).tickSize(-innerW).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").attr("stroke", "#e7f0f5").attr("stroke-dasharray", "3,3"));

    // ── axes ──
    chartG.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(6));

    chartG.append("g").attr("class", "axis")
      .call(d3.axisLeft(yScale).tickFormat(d => d + "%").ticks(7));

    // ── axis labels ──
    chartG.append("text").attr("class", "axis-label")
      .attr("x", innerW / 2).attr("y", innerH + 48)
      .attr("text-anchor", "middle").text("Year");

    chartG.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -52)
      .attr("text-anchor", "middle").text("Adult Literacy Rate (%)");

    // ── placeholder groups ──
    chartG.append("g").attr("class", "lines-group");
    chartG.append("g").attr("class", "legend-group")
      .attr("transform", `translate(${innerW + 16}, 10)`);

    // Hide tooltip when mouse leaves the whole chart area
    svg.on("mouseleave", () => {
      resetHighlight();
      tooltip.style("opacity", 0);
    });
  }

  // ── draw / update lines ───────────────────────────────────
  function update() {
    if (!chartG) return;

    const countries = getCountriesToShow();
    const colorMap = new Map(
      countries.map((c, i) => [c, COLOR_PALETTE[i % COLOR_PALETTE.length]])
    );

    const filtered = allData.filter(d => countries.includes(d.country));
    const grouped = d3.group(filtered, d => d.country);

    const line = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.lit))
      .curve(d3.curveMonotoneX)
      .defined(d => !isNaN(d.lit));

    const linesG = chartG.select(".lines-group");

    // ── data join on groups (one <g> per country) ──
    const groups = linesG.selectAll(".c-line-group")
      .data(Array.from(grouped.entries()), d => d[0]);

    // Exit
    groups.exit().transition().duration(300).attr("opacity", 0).remove();

    // Enter: each group gets a visible path + a wide invisible hit path
    const entered = groups.enter().append("g")
      .attr("class", "c-line-group")
      .attr("opacity", 0);

    entered.append("path").attr("class", "c-line-visible")
      .attr("fill", "none")
      .attr("stroke-width", 2.5)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("pointer-events", "none");   // visual only — hit path handles events

    entered.append("path").attr("class", "c-line-hit")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 18)          // wide hit area, easy to hover
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round");

    // Merge
    const allGroups = entered.merge(groups);

    // Update visible path colour
    allGroups.select(".c-line-visible")
      .attr("stroke", d => colorMap.get(d[0]) || "#aaa");

    // Attach events to hit path
    allGroups.select(".c-line-hit")
      .on("mouseover", function (event, d) {
        highlightLine(d[0]);
        showTip(event, d);
      })
      .on("mousemove", (event, d) => showTip(event, d))
      .on("mouseout", function () {
        resetHighlight();
        tooltip.style("opacity", 0);
      });

    // Animate both paths together
    allGroups.transition().duration(650)
      .attr("opacity", 1)
      .select(".c-line-visible")
      .attr("d", d => line(d[1].slice().sort((a, b) => a.year - b.year)));

    allGroups.select(".c-line-hit")
      .attr("d", d => line(d[1].slice().sort((a, b) => a.year - b.year)));

    // ── legend ──
    const legendG = chartG.select(".legend-group");
    legendG.selectAll("*").remove();

    Array.from(grouped.keys()).forEach((country, i) => {
      const g = legendG.append("g")
        .attr("transform", `translate(0,${i * 22})`)
        .style("cursor", "pointer")
        .on("mouseover", () => highlightLine(country))
        .on("mouseout", resetHighlight);

      g.append("rect")
        .attr("width", 16).attr("height", 4).attr("y", -2).attr("rx", 2)
        .attr("fill", colorMap.get(country) || "#aaa");

      g.append("text")
        .attr("x", 22).attr("y", 0)
        .attr("font-size", 12).attr("fill", "#405264")
        .attr("dominant-baseline", "middle")
        .text(country.length > 17 ? country.slice(0, 15) + "…" : country);
    });

    // ── no-data message ──
    chartG.selectAll(".no-data-text").remove();
    if (filtered.length === 0) {
      chartG.append("text").attr("class", "no-data-text")
        .attr("x", innerW / 2).attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#aaa").attr("font-size", 14)
        .text("No literacy data for the selected countries.");
    }
  }

  // ── helpers ───────────────────────────────────────────────
  function getCountriesToShow() {
    if (selectedCountries.length > 0) return selectedCountries;

    // Default: 6 countries with the most data points across the literacy spectrum
    const byCountry = d3.rollup(
      allData,
      v => ({ mean: d3.mean(v, d => d.lit), count: v.length }),
      d => d.country
    );
    const sorted = Array.from(byCountry.entries())
      .filter(([, v]) => v.count >= 8)
      .sort((a, b) => b[1].count - a[1].count);

    // Pick 6 spread across literacy range (high, mid, low)
    const all6 = sorted.slice(0, 20);
    all6.sort((a, b) => b[1].mean - a[1].mean);
    const picks = [
      all6[0], all6[Math.floor(all6.length * 0.2)],
      all6[Math.floor(all6.length * 0.4)], all6[Math.floor(all6.length * 0.6)],
      all6[Math.floor(all6.length * 0.8)], all6[all6.length - 1]
    ].filter(Boolean);

    return picks.map(([c]) => c);
  }

  function highlightLine(country) {
    chartG.selectAll(".c-line-group")
      .attr("opacity", d => d[0] === country ? 1 : 0.12);
    chartG.selectAll(".c-line-visible")
      .attr("stroke-width", d => d[0] === country ? 4 : 2.5);
  }

  function resetHighlight() {
    chartG.selectAll(".c-line-group").attr("opacity", 1);
    chartG.selectAll(".c-line-visible").attr("stroke-width", 2.5);
  }

  function showTip(event, d) {
    const [mx] = d3.pointer(event, chartG.node());
    const yr = Math.round(xScale.invert(mx));
    const pts = d[1].slice().sort((a, b) => a.year - b.year);
    const row = pts.find(r => r.year === yr)
      || pts.reduce((p, c) =>
        Math.abs(c.year - yr) < Math.abs(p.year - yr) ? c : p
      );

    const fmt  = (v, unit = "%", dp = 1) =>
      v !== null && !isNaN(v) ? v.toFixed(dp) + unit : "<span style='color:#bbb'>—</span>";

    tooltip.style("opacity", 1)
      .html(
        `<strong style="font-size:13px">${d[0]}</strong>` +
        `<span style="color:#888;font-size:11px;margin-left:6px">${row.year}</span><br>` +
        `<hr style="margin:5px 0;border-color:#eee">` +
        `<table style="border-collapse:collapse;font-size:12px;line-height:1.8">` +
          `<tr><td style="color:#5f6f81;padding-right:10px">Literacy Rate</td>` +
              `<td><strong>${fmt(row.lit)}</strong></td></tr>` +
          `<tr><td style="color:#5f6f81">Gov. Ed. Spending</td>` +
              `<td>${fmt(row.govExp, "% GDP")}</td></tr>` +
          `<tr><td style="color:#5f6f81">Primary Completion</td>` +
              `<td>${fmt(row.priComp)}</td></tr>` +
          `<tr><td style="color:#5f6f81">Primary Enrolment</td>` +
              `<td>${fmt(row.enrolPrimary)}</td></tr>` +
          `<tr><td style="color:#5f6f81">Secondary Enrolment</td>` +
              `<td>${fmt(row.enrolSecondary)}</td></tr>` +
          `<tr><td style="color:#5f6f81">Tertiary Enrolment</td>` +
              `<td>${fmt(row.enrolTertiary)}</td></tr>` +
          `<tr><td style="color:#5f6f81">Pupil-Teacher (Pri.)</td>` +
              `<td>${fmt(row.ptPrimary, "", 1)}</td></tr>` +
          `<tr><td style="color:#5f6f81">Pupil-Teacher (Sec.)</td>` +
              `<td>${fmt(row.ptSecondary, "", 1)}</td></tr>` +
        `</table>`
      )
      .style("left", (event.pageX + 14) + "px")
      .style("top", (event.pageY - 32) + "px");
  }

  // ── filter listeners ──────────────────────────────────────
  function listenToFilters() {
    const countryEl = document.getElementById("countryFilter");
    const resetEl = document.getElementById("resetBtn");

    if (countryEl) {
      countryEl.addEventListener("change", () => {
        selectedCountries = Array.from(countryEl.selectedOptions).map(o => o.value);
        update();
      });
    }

    if (resetEl) {
      resetEl.addEventListener("click", () => {
        selectedCountries = [];
        update();
      });
    }
  }

  // ── init ──────────────────────────────────────────────────
  function init() {
    tooltip = d3.select("#tooltip");

    d3.csv(DATA_PATH).then(raw => {
      allData = raw
        .filter(d => d.country && d.year && d.lit_rate_adult_pct !== "")
        .map(d => ({
          country:        d.country,
          country_code:   d.country_code,
          year:           +d.year,
          lit:            +d.lit_rate_adult_pct,
          govExp:         d.gov_exp_pct_gdp       !== "" ? +d.gov_exp_pct_gdp       : null,
          priComp:        d.pri_comp_rate_pct      !== "" ? +d.pri_comp_rate_pct      : null,
          ptPrimary:      d.pupil_teacher_primary  !== "" ? +d.pupil_teacher_primary  : null,
          ptSecondary:    d.pupil_teacher_secondary !== "" ? +d.pupil_teacher_secondary : null,
          enrolPrimary:   d.school_enrol_primary_pct   !== "" ? +d.school_enrol_primary_pct   : null,
          enrolSecondary: d.school_enrol_secondary_pct !== "" ? +d.school_enrol_secondary_pct : null,
          enrolTertiary:  d.school_enrol_tertiary_pct  !== "" ? +d.school_enrol_tertiary_pct  : null,
        }))
        .filter(d => !isNaN(d.year) && !isNaN(d.lit));

      buildSvg();
      listenToFilters();
      update();
    }).catch(err => {
      console.error("Chart 1 error:", err);
      d3.select("#chart1").html(
        '<div class="no-data">Failed to load Chart 1 data.</div>'
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
