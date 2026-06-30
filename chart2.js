// ============================================================
// Chart 2: Global Literacy Distribution Map (Choropleth)
// Attributes: country_code, country, year, lit_rate_adult_pct
// Interactivity: year slider, hover tooltip, colour legend,
//                zoom & pan, reset zoom, syncs with global filter
// ============================================================

(function () {
  "use strict";

  const DATA_PATH = "cleaned_world_education_dataset.csv";
  const TOPO_URL  = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

  // ── ISO Alpha-3 → ISO Numeric (matches world-atlas country IDs) ──
  const ISO3_NUMERIC = {
    AFG:4,  ALB:8,  DZA:12, AND:20, AGO:24, ATG:28, ARG:32, ARM:51,
    AUS:36, AUT:40, AZE:31, BHS:44, BHR:48, BGD:50, BRB:52, BLR:112,
    BEL:56, BLZ:84, BEN:204,BTN:64, BOL:68, BIH:70, BWA:72, BRA:76,
    BRN:96, BGR:100,BFA:854,BDI:108,KHM:116,CMR:120,CAN:124,CPV:132,
    CAF:140,TCD:148,CHL:152,CHN:156,COL:170,COM:174,COD:180,COG:178,
    CRI:188,CIV:384,HRV:191,CUB:192,CYP:196,CZE:203,DNK:208,DJI:262,
    DOM:214,ECU:218,EGY:818,SLV:222,GNQ:226,ERI:232,EST:233,ETH:231,
    FJI:242,FIN:246,FRA:250,GAB:266,GMB:270,GEO:268,DEU:276,GHA:288,
    GRC:300,GTM:320,GIN:324,GNB:624,GUY:328,HTI:332,HND:340,HUN:348,
    ISL:352,IND:356,IDN:360,IRN:364,IRQ:368,IRL:372,ISR:376,ITA:380,
    JAM:388,JPN:392,JOR:400,KAZ:398,KEN:404,PRK:408,KOR:410,KWT:414,
    KGZ:417,LAO:418,LVA:428,LBN:422,LSO:426,LBR:430,LBY:434,LIE:438,
    LTU:440,LUX:442,MDG:450,MWI:454,MYS:458,MDV:462,MLI:466,MLT:470,
    MRT:478,MUS:480,MEX:484,MDA:498,MNG:496,MNE:499,MAR:504,MOZ:508,
    MMR:104,NAM:516,NPL:524,NLD:528,NZL:554,NIC:558,NER:562,NGA:566,
    MKD:807,NOR:578,OMN:512,PAK:586,PAN:591,PNG:598,PRY:600,PER:604,
    PHL:608,POL:616,PRT:620,QAT:634,ROU:642,RUS:643,RWA:646,SAU:682,
    SEN:686,SRB:688,SLE:694,SGP:702,SVK:703,SVN:705,SOM:706,ZAF:710,
    ESP:724,LKA:144,SDN:729,SSD:728,SUR:740,SWZ:748,SWE:752,CHE:756,
    SYR:760,TJK:762,TZA:834,THA:764,TLS:626,TGO:768,TTO:780,TUN:788,
    TUR:792,TKM:795,UGA:800,UKR:804,ARE:784,GBR:826,USA:840,URY:858,
    UZB:860,VEN:862,VNM:704,YEM:887,ZMB:894,ZWE:716,PSE:275,DMA:212,
    GRD:308,KNA:659,LCA:662,VCT:670,WSM:882,STP:678,TON:776,VUT:548,
    SLB:90, FSM:583,MHL:584,PLW:585,KIR:296,TUV:798,SYC:690,HKG:344,
    MAC:446,PRI:630,PRY:600,ABW:533,TTO:780,
  };

  // ── state ─────────────────────────────────────────────────
  let allData = [], worldGeo;
  let allYears = [], currentYear;
  let svg, mapG, projection, pathGen, colorScale;
  let zoomBehaviour;
  let tooltip;

  // ── init ──────────────────────────────────────────────────
  function init() {
    tooltip = d3.select("#tooltip");

    Promise.all([
      d3.json(TOPO_URL),
      d3.csv(DATA_PATH)
    ]).then(([topo, raw]) => {

      worldGeo = topojson.feature(topo, topo.objects.countries);

      allData = raw
        .filter(d => d.country && d.year && d.lit_rate_adult_pct !== "")
        .map(d => ({
          country:    d.country,
          iso3:       d.country_code,
          year:       +d.year,
          lit:        +d.lit_rate_adult_pct,
          numericId:  ISO3_NUMERIC[d.country_code] || null
        }))
        .filter(d => !isNaN(d.year) && !isNaN(d.lit));

      allYears = Array.from(new Set(allData.map(d => d.year))).sort((a, b) => a - b);
      currentYear = allYears[allYears.length - 1]; // default to most recent

      buildSvg();
      buildControls();
      listenToFilters();
      render();

    }).catch(err => {
      console.error("Chart 2 error:", err);
      d3.select("#chart2").html(
        '<div class="no-data">Failed to load map data. Check console for details.</div>'
      );
    });
  }

  // ── build SVG + map skeleton ──────────────────────────────
  function buildSvg() {
    const container = document.getElementById("chart2");
    const W = Math.max(container.clientWidth || 0, 480);
    const H = 490;

    d3.select("#chart2").selectAll("*").remove();

    // Colour scale: low literacy = light yellow, high = dark blue-green
    colorScale = d3.scaleSequential()
      .domain([20, 100])
      .interpolator(d3.interpolateYlGnBu);

    svg = d3.select("#chart2")
      .append("svg")
      .attr("width", "100%")
      .attr("height", H)
      .style("cursor", "grab")
      .style("border-radius", "14px");

    // ── projection & path ──
    projection = d3.geoNaturalEarth1()
      .scale((W / 960) * 153)
      .translate([W / 2, H / 2 - 10]);

    pathGen = d3.geoPath().projection(projection);

    // ── map group (zoomed) ──
    mapG = svg.append("g").attr("class", "map-group");

    // Ocean background
    mapG.append("path")
      .datum({ type: "Sphere" })
      .attr("d", pathGen)
      .attr("fill", "#d0e9f5")
      .attr("stroke", "#8ab9d4")
      .attr("stroke-width", 0.6);

    // Graticule (latitude/longitude grid lines)
    const graticule = d3.geoGraticule();
    mapG.append("path")
      .datum(graticule())
      .attr("d", pathGen)
      .attr("fill", "none")
      .attr("stroke", "#b0d0e0")
      .attr("stroke-width", 0.25);

    // Country paths
    mapG.selectAll(".country")
      .data(worldGeo.features)
      .enter().append("path")
      .attr("class", "country")
      .attr("d", pathGen)
      .attr("fill", "#ccc")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.45);

    // Country borders overlay (slightly thicker for readability)
    mapG.append("path")
      .datum(topojson.mesh(
        { objects: { countries: { type: "GeometryCollection", geometries: worldGeo.features.map(f => f.geometry) } } },
        worldGeo.features,
        (a, b) => a !== b
      ))
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.6)")
      .attr("stroke-width", 0.4);

    // ── zoom behaviour ──
    zoomBehaviour = d3.zoom()
      .scaleExtent([1, 10])
      .on("zoom", event => {
        mapG.attr("transform", event.transform);
        svg.style("cursor", event.transform.k > 1.05 ? "move" : "grab");
      });

    svg.call(zoomBehaviour)
      .on("dblclick.zoom", null); // disable default double-click zoom

    // ── legend (fixed, not part of mapG) ──
    buildLegend(W, H);
  }

  // ── colour legend ─────────────────────────────────────────
  function buildLegend(W, H) {
    const lW = 220, lH = 12;
    const lX = W / 2 - lW / 2;
    const lY = H - 45;

    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "lit-grad-c2");
    const stops = d3.range(0, 1.01, 0.05);
    grad.selectAll("stop")
      .data(stops)
      .enter().append("stop")
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d => colorScale(20 + d * 80));

    const legG = svg.append("g")
      .attr("class", "legend-c2")
      .attr("transform", `translate(${lX},${lY})`);

    // gradient bar
    legG.append("rect")
      .attr("width", lW).attr("height", lH).attr("rx", 4)
      .attr("fill", "url(#lit-grad-c2)")
      .attr("stroke", "#ccc").attr("stroke-width", 0.5);

    // tick axis
    const legScale = d3.scaleLinear().domain([20, 100]).range([0, lW]);
    legG.append("g")
      .attr("transform", `translate(0,${lH})`)
      .call(
        d3.axisBottom(legScale)
          .tickValues([20, 40, 60, 80, 100])
          .tickFormat(d => d + "%")
          .tickSize(4)
      )
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").attr("stroke", "#5f6f81"))
      .call(g => g.selectAll("text").attr("fill", "#5f6f81").attr("font-size", 11));

    // label
    legG.append("text")
      .attr("x", lW / 2).attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("font-size", 12).attr("fill", "#5f6f81").attr("font-weight", 600)
      .text("Adult Literacy Rate (%)");

    // no-data swatch
    const ndG = legG.append("g").attr("transform", "translate(-95, 0)");
    ndG.append("rect")
      .attr("width", 14).attr("height", lH).attr("rx", 2).attr("fill", "#ccc")
      .attr("stroke", "#bbb").attr("stroke-width", 0.5);
    ndG.append("text")
      .attr("x", 18).attr("y", lH / 2 + 1)
      .attr("dominant-baseline", "middle")
      .attr("font-size", 11).attr("fill", "#5f6f81")
      .text("No data");
  }

  // ── controls (year slider + reset zoom) ───────────────────
  function buildControls() {
    const ctrl = d3.select("#chart2")
      .insert("div", "svg")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "14px")
      .style("margin-bottom", "10px")
      .style("flex-wrap", "wrap");

    // Year label
    ctrl.append("label")
      .style("font-size", "13px")
      .style("font-weight", "700")
      .style("color", "#2f6fae")
      .text("Year:");

    // Slider
    const slider = ctrl.append("input")
      .attr("type", "range")
      .attr("id", "chart2YearSlider")
      .attr("min", allYears[0])
      .attr("max", allYears[allYears.length - 1])
      .attr("value", currentYear)
      .attr("step", 1)
      .style("width", "180px")
      .style("cursor", "pointer")
      .style("accent-color", "#4f8fcf");

    const yearDisplay = ctrl.append("span")
      .attr("id", "chart2YearDisplay")
      .style("font-weight", "700")
      .style("font-size", "14px")
      .style("color", "#2f6fae")
      .style("min-width", "42px")
      .text(currentYear);

    slider.on("input", function () {
      currentYear = +this.value;
      yearDisplay.text(currentYear);
      render();

      // Sync global year filter (if populated by chart5)
      const globalFilter = document.getElementById("yearFilter");
      if (globalFilter && globalFilter.querySelector(`option[value="${currentYear}"]`)) {
        globalFilter.value = currentYear;
        globalFilter.dispatchEvent(new Event("change"));
      }
    });

    // Reset zoom button
    ctrl.append("button")
      .attr("class", "control-btn secondary-btn")
      .style("font-size", "12px")
      .style("padding", "6px 13px")
      .text("⟳ Reset Zoom")
      .on("click", () => {
        svg.transition().duration(500)
          .call(zoomBehaviour.transform, d3.zoomIdentity);
      });

    // Hint text
    ctrl.append("span")
      .style("font-size", "11px")
      .style("color", "#8a9aaa")
      .text("Scroll or pinch to zoom · Drag to pan");
  }

  // ── render map for currentYear ────────────────────────────
  function render() {
    // Build lookup: numericId → row
    const litMap = new Map();
    allData
      .filter(d => d.year === currentYear && d.numericId !== null)
      .forEach(d => litMap.set(d.numericId, d));

    mapG.selectAll(".country")
      .attr("fill", feature => {
        const row = litMap.get(+feature.id);
        return row ? colorScale(row.lit) : "#ccc";
      })
      .on("mouseover", function (event, feature) {
        const row = litMap.get(+feature.id);
        d3.select(this)
          .raise()
          .attr("stroke", "#f4c95d")
          .attr("stroke-width", 1.8);

        if (row) {
          tooltip.style("opacity", 1)
            .html(
              `<strong>${row.country}</strong><br>` +
              `Year: ${currentYear}<br>` +
              `Literacy Rate: <strong>${row.lit.toFixed(1)}%</strong>`
            )
            .style("left", (event.pageX + 14) + "px")
            .style("top", (event.pageY - 32) + "px");
        } else {
          // Show country name from world topology if we can find it
          tooltip.style("opacity", 1)
            .html(`<em style="color:#888">No data for ${currentYear}</em>`)
            .style("left", (event.pageX + 14) + "px")
            .style("top", (event.pageY - 32) + "px");
        }
      })
      .on("mousemove", event => {
        tooltip
          .style("left", (event.pageX + 14) + "px")
          .style("top", (event.pageY - 32) + "px");
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.45);
        tooltip.style("opacity", 0);
      });

    // Update slider display
    d3.select("#chart2YearDisplay").text(currentYear);
    const slider = document.getElementById("chart2YearSlider");
    if (slider) slider.value = currentYear;
  }

  // ── listen to global filters ──────────────────────────────
  function listenToFilters() {
    const yearEl  = document.getElementById("yearFilter");
    const resetEl = document.getElementById("resetBtn");

    if (yearEl) {
      yearEl.addEventListener("change", () => {
        const y = +yearEl.value;
        if (!isNaN(y) && allYears.includes(y)) {
          currentYear = y;
          render();
        }
      });
    }

    if (resetEl) {
      resetEl.addEventListener("click", () => {
        currentYear = allYears[allYears.length - 1];
        render();
        svg.transition().duration(500)
          .call(zoomBehaviour.transform, d3.zoomIdentity);
      });
    }
  }

  // ── bootstrap ────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
