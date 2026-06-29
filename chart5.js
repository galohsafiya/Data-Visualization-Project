const DATA_PATH = "cleaned_world_education_dataset.csv";

let educationData = [];
let allYears = [];
let allCountries = [];

let yearAnimationTimer = null;
let isYearAnimationPlaying = false;

const tooltip = d3.select("#tooltip");

const enrollmentKeys = [
  {
    key: "school_enrol_primary_pct",
    label: "Primary Enrollment"
  },
  {
    key: "school_enrol_secondary_pct",
    label: "Secondary Enrollment"
  },
  {
    key: "school_enrol_tertiary_pct",
    label: "Tertiary Enrollment"
  }
];

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const cleaned = String(value).replace(/,/g, "").trim();
  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const validValues = values.filter(value => value !== null && Number.isFinite(value));

  if (validValues.length === 0) return null;

  return d3.mean(validValues);
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "No data";
  }

  return `${value.toFixed(2)}%`;
}

function showTooltip(event, html) {
  tooltip
    .style("opacity", 1)
    .html(html)
    .style("left", `${event.pageX + 15}px`)
    .style("top", `${event.pageY - 20}px`);
}

function moveTooltip(event) {
  tooltip
    .style("left", `${event.pageX + 15}px`)
    .style("top", `${event.pageY - 20}px`);
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

d3.csv(DATA_PATH).then(rawData => {
  educationData = rawData
    .map(d => ({
      country: d.country,
      country_code: d.country_code,
      year: cleanNumber(d.year),

      gov_exp_pct_gdp: cleanNumber(d.gov_exp_pct_gdp),
      lit_rate_adult_pct: cleanNumber(d.lit_rate_adult_pct),
      pri_comp_rate_pct: cleanNumber(d.pri_comp_rate_pct),

      pupil_teacher_primary: cleanNumber(d.pupil_teacher_primary),
      pupil_teacher_secondary: cleanNumber(d.pupil_teacher_secondary),

      school_enrol_primary_pct: cleanNumber(d.school_enrol_primary_pct),
      school_enrol_secondary_pct: cleanNumber(d.school_enrol_secondary_pct),
      school_enrol_tertiary_pct: cleanNumber(d.school_enrol_tertiary_pct)
    }))
    .filter(d => d.country && d.year !== null);

  allYears = Array.from(new Set(educationData.map(d => d.year))).sort((a, b) => a - b);
  allCountries = Array.from(new Set(educationData.map(d => d.country))).sort();

  setupFilters();
  updateDashboard();
}).catch(error => {
  console.error("Dataset loading error:", error);

  d3.select("#chart5").html(`
    <div class="no-data">
      Dataset could not be loaded. Please check the CSV filename in chart5.js.
    </div>
  `);

  d3.select("#chart6").html(`
    <div class="no-data">
      Dataset could not be loaded. Please check the CSV filename in chart5.js.
    </div>
  `);
});

function setupFilters() {
  const yearFilter = d3.select("#yearFilter");
  const countryFilter = d3.select("#countryFilter");

  yearFilter
    .selectAll("option")
    .data(allYears)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  yearFilter.property("value", d3.max(allYears));

  countryFilter
    .selectAll("option")
    .data(allCountries)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  setDefaultCountries();

  yearFilter.on("change", () => {
    stopYearAnimation();
    updateDashboard();
  });

  countryFilter.on("change", () => {
    stopYearAnimation();
    updateDashboard();
  });

  d3.select("#sortFilter").on("change", () => {
    stopYearAnimation();
    updateDashboard();
  });

  d3.select("#resetBtn").on("click", () => {
    stopYearAnimation();
    yearFilter.property("value", d3.max(allYears));
    d3.select("#sortFilter").property("value", "alphabetical");
    setDefaultCountries();
    updateDashboard();
  });

  d3.select("#playYearsBtn").on("click", startYearAnimation);
  d3.select("#pauseYearsBtn").on("click", stopYearAnimation);
}

function setDefaultCountries() {
  const latestYear = d3.max(allYears);

  const defaultCountries = educationData
    .filter(d => d.year === latestYear)
    .filter(d =>
      d.school_enrol_primary_pct !== null ||
      d.school_enrol_secondary_pct !== null ||
      d.school_enrol_tertiary_pct !== null
    )
    .slice(0, 7)
    .map(d => d.country);

  d3.select("#countryFilter")
    .selectAll("option")
    .property("selected", d => defaultCountries.includes(d));
}

function getSelectedYear() {
  return Number(d3.select("#yearFilter").property("value"));
}

function getSelectedCountries() {
  const selectedCountries = Array.from(
    document.querySelector("#countryFilter").selectedOptions
  ).map(option => option.value);

  if (selectedCountries.length === 0) {
    return allCountries.slice(0, 7);
  }

  return selectedCountries;
}

function getSelectedSort() {
  return d3.select("#sortFilter").property("value");
}

function updateDashboard() {
  const selectedYear = getSelectedYear();
  const selectedCountries = getSelectedCountries();
  const selectedSort = getSelectedSort();

  updateDashboardKpis(selectedYear, selectedCountries);
  drawChart5(selectedYear, selectedCountries, selectedSort);

  if (window.Chart6 && typeof window.Chart6.draw === "function") {
    window.Chart6.draw(educationData, selectedYear, selectedCountries);
  }
}

function startYearAnimation() {
  if (isYearAnimationPlaying) return;

  isYearAnimationPlaying = true;

  d3.select("#playYearsBtn").text("▶ Playing...");
  d3.select("#pauseYearsBtn").text("⏸ Pause");

  const yearFilter = d3.select("#yearFilter");
  const currentYear = Number(yearFilter.property("value"));

  let currentIndex = allYears.indexOf(currentYear);

  if (currentIndex === -1 || currentIndex === allYears.length - 1) {
    currentIndex = 0;
    yearFilter.property("value", allYears[currentIndex]);
    updateDashboard();
  }

  yearAnimationTimer = setInterval(() => {
    currentIndex++;

    if (currentIndex >= allYears.length) {
      stopYearAnimation();
      return;
    }

    const nextYear = allYears[currentIndex];

    yearFilter.property("value", nextYear);
    updateDashboard();
  }, 1200);
}

function stopYearAnimation() {
  if (yearAnimationTimer) {
    clearInterval(yearAnimationTimer);
    yearAnimationTimer = null;
  }

  isYearAnimationPlaying = false;

  d3.select("#playYearsBtn").text("▶ Play Years");
  d3.select("#pauseYearsBtn").text("⏸ Pause");
}

function prepareChart5Data(selectedYear, selectedCountries) {
  return selectedCountries
    .map(country => {
      const countryRows = educationData.filter(d => {
        return d.country === country && d.year === selectedYear;
      });

      const primary = average(countryRows.map(d => d.school_enrol_primary_pct));
      const secondary = average(countryRows.map(d => d.school_enrol_secondary_pct));
      const tertiary = average(countryRows.map(d => d.school_enrol_tertiary_pct));

      return {
        country: country,
        school_enrol_primary_pct: primary,
        school_enrol_secondary_pct: secondary,
        school_enrol_tertiary_pct: tertiary,
        access_gap: primary !== null && tertiary !== null ? primary - tertiary : null
      };
    })
    .filter(d =>
      d.school_enrol_primary_pct !== null ||
      d.school_enrol_secondary_pct !== null ||
      d.school_enrol_tertiary_pct !== null
    );
}

function sortChart5Data(data, selectedSort) {
  const sorted = [...data];

  if (selectedSort === "primary") {
    sorted.sort((a, b) => d3.descending(a.school_enrol_primary_pct ?? -Infinity, b.school_enrol_primary_pct ?? -Infinity));
  } else if (selectedSort === "secondary") {
    sorted.sort((a, b) => d3.descending(a.school_enrol_secondary_pct ?? -Infinity, b.school_enrol_secondary_pct ?? -Infinity));
  } else if (selectedSort === "tertiary") {
    sorted.sort((a, b) => d3.descending(a.school_enrol_tertiary_pct ?? -Infinity, b.school_enrol_tertiary_pct ?? -Infinity));
  } else if (selectedSort === "gap") {
    sorted.sort((a, b) => d3.descending(a.access_gap ?? -Infinity, b.access_gap ?? -Infinity));
  } else {
    sorted.sort((a, b) => d3.ascending(a.country, b.country));
  }

  return sorted;
}

function updateDashboardKpis(selectedYear, selectedCountries) {
  const rows = educationData.filter(d => {
    return d.year === selectedYear && selectedCountries.includes(d.country);
  });

  const validCountries = Array.from(
    new Set(rows.map(d => d.country).filter(Boolean))
  );

  const avgLiteracy = average(rows.map(d => d.lit_rate_adult_pct));
  const avgSpending = average(rows.map(d => d.gov_exp_pct_gdp));
  const avgCompletion = average(rows.map(d => d.pri_comp_rate_pct));

  d3.select("#kpiCountries").text(validCountries.length);
  d3.select("#kpiLiteracy").text(formatPercent(avgLiteracy));
  d3.select("#kpiSpending").text(formatPercent(avgSpending));
  d3.select("#kpiCompletion").text(formatPercent(avgCompletion));
}

function drawChart5(selectedYear, selectedCountries, selectedSort) {
  const container = d3.select("#chart5");
  container.selectAll("*").remove();

  let data = prepareChart5Data(selectedYear, selectedCountries);
  data = sortChart5Data(data, selectedSort);

  d3.select("#chart5Badge").text(`Year: ${selectedYear}`);

  if (data.length === 0) {
    container.html(`
      <div class="no-data">
        No enrollment data available for the selected countries and year.
      </div>
    `);
    return;
  }

  const containerWidth = container.node().clientWidth;
  const width = Math.max(containerWidth, 980);
  const height = 540;

  const margin = {
    top: 35,
    right: 30,
    bottom: 115,
    left: 75
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const x0 = d3.scaleBand()
    .domain(data.map(d => d.country))
    .range([0, innerWidth])
    .padding(0.18);

  const x1 = d3.scaleBand()
    .domain(enrollmentKeys.map(d => d.key))
    .range([0, x0.bandwidth()])
    .padding(0.08);

  const maxValue = d3.max(data, d => {
    return d3.max(enrollmentKeys, level => d[level.key]);
  });

  const y = d3.scaleLinear()
    .domain([0, Math.max(100, maxValue || 0)])
    .nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(enrollmentKeys.map(d => d.key))
    .range(["#6aa9e9", "#63c7a6", "#f5c76a"]);

  chart
    .append("g")
    .attr("class", "grid")
    .call(
      d3.axisLeft(y)
        .ticks(6)
        .tickSize(-innerWidth)
        .tickFormat("")
    );

  chart
    .append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(y)
        .ticks(6)
        .tickFormat(d => `${d}%`)
    );

  chart
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-30)")
    .style("text-anchor", "end");

  chart
    .append("text")
    .attr("class", "axis-label")
    .attr("x", -innerHeight / 2)
    .attr("y", -55)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Enrollment Rate (%)");

  const countryGroups = chart
    .selectAll(".country-group")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "country-group")
    .attr("transform", d => `translate(${x0(d.country)}, 0)`);

  countryGroups
    .selectAll("rect")
    .data(d => {
      return enrollmentKeys.map(level => ({
        country: d.country,
        key: level.key,
        label: level.label,
        value: d[level.key],
        gap: d.access_gap
      }));
    })
    .enter()
    .append("rect")
    .attr("x", d => x1(d.key))
    .attr("y", innerHeight)
    .attr("width", x1.bandwidth())
    .attr("height", 0)
    .attr("rx", 6)
    .attr("fill", d => color(d.key))
    .on("mouseover", function(event, d) {
      d3.select(this)
        .attr("opacity", 0.78)
        .attr("stroke", "#243447")
        .attr("stroke-width", 1.5);

      showTooltip(event, `
        <strong>${d.country}</strong><br>
        ${d.label}: ${formatPercent(d.value)}<br>
        Primary-to-tertiary gap: ${formatPercent(d.gap)}
      `);
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", function() {
      d3.select(this)
        .attr("opacity", 1)
        .attr("stroke", "none");

      hideTooltip();
    })
    .transition()
    .duration(750)
    .attr("y", d => d.value === null ? innerHeight : y(d.value))
    .attr("height", d => d.value === null ? 0 : innerHeight - y(d.value));

  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${margin.left}, ${height - 42})`);

  const legendItems = legend
    .selectAll(".legend-item")
    .data(enrollmentKeys)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(${i * 215}, 0)`);

  legendItems
    .append("rect")
    .attr("width", 15)
    .attr("height", 15)
    .attr("rx", 4)
    .attr("fill", d => color(d.key));

  legendItems
    .append("text")
    .attr("x", 23)
    .attr("y", 12)
    .text(d => d.label);
}