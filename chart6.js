window.Chart6 = {};
window.Chart6.lockedSelection = null;

const correlationFields = [
  {
    key: "gov_exp_pct_gdp",
    label: "Gov. Spending"
  },
  {
    key: "lit_rate_adult_pct",
    label: "Adult Literacy"
  },
  {
    key: "pri_comp_rate_pct",
    label: "Primary Completion"
  },
  {
    key: "pupil_teacher_primary",
    label: "Pupil-Teacher Primary"
  },
  {
    key: "pupil_teacher_secondary",
    label: "Pupil-Teacher Secondary"
  },
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

function getSelectedCountriesForChart6(data, selectedYear, selectedCountries) {
  if (Array.isArray(selectedCountries) && selectedCountries.length > 0) {
    return selectedCountries;
  }

  const countryFilter = document.querySelector("#countryFilter");

  if (countryFilter) {
    const selectedFromFilter = Array.from(countryFilter.selectedOptions)
      .map(option => option.value);

    if (selectedFromFilter.length > 0) {
      return selectedFromFilter;
    }
  }

  return Array.from(
    new Set(
      data
        .filter(d => d.year === selectedYear)
        .map(d => d.country)
        .filter(Boolean)
    )
  );
}

function pearsonCorrelation(rows, keyX, keyY) {
  const pairs = rows
    .map(d => [d[keyX], d[keyY]])
    .filter(([x, y]) =>
      x !== null &&
      y !== null &&
      Number.isFinite(x) &&
      Number.isFinite(y)
    );

  if (pairs.length < 3) return null;

  const xs = pairs.map(d => d[0]);
  const ys = pairs.map(d => d[1]);

  const meanX = d3.mean(xs);
  const meanY = d3.mean(ys);

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (let i = 0; i < pairs.length; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;

    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  }

  const denominator = Math.sqrt(denominatorX * denominatorY);

  if (denominator === 0) return null;

  return numerator / denominator;
}

function prepareCorrelationMatrix(data, selectedYear, activeCountries) {
  const rows = data.filter(d => {
    return d.year === selectedYear && activeCountries.includes(d.country);
  });

  const matrix = [];

  correlationFields.forEach(rowField => {
    correlationFields.forEach(columnField => {
      matrix.push({
        rowKey: rowField.key,
        rowLabel: rowField.label,
        columnKey: columnField.key,
        columnLabel: columnField.label,
        value: pearsonCorrelation(rows, rowField.key, columnField.key)
      });
    });
  });

  return matrix;
}

function updateRelationshipInsights(matrix) {
  const uniquePairs = matrix.filter(d => {
    return d.value !== null && d.rowKey !== d.columnKey && d.rowKey < d.columnKey;
  });

  if (uniquePairs.length === 0) {
    d3.select("#strongestPositive").text("No valid relationship data available for the selected countries and year.");
    d3.select("#strongestNegative").text("No valid relationship data available for the selected countries and year.");
    return;
  }

  const positivePairs = uniquePairs.filter(d => d.value > 0);
  const negativePairs = uniquePairs.filter(d => d.value < 0);

  const strongestPositiveValue = positivePairs.length > 0
    ? d3.max(positivePairs, d => d.value)
    : null;

  const strongestNegativeValue = negativePairs.length > 0
    ? d3.min(negativePairs, d => d.value)
    : null;

  const positiveItem = positivePairs.find(d => d.value === strongestPositiveValue);
  const negativeItem = negativePairs.find(d => d.value === strongestNegativeValue);

  d3.select("#strongestPositive").html(
    positiveItem
      ? `<strong>${positiveItem.rowLabel}</strong> and <strong>${positiveItem.columnLabel}</strong> show the strongest positive relationship with r = ${positiveItem.value.toFixed(3)}.`
      : "No positive relationship found for the selected countries and year."
  );

  d3.select("#strongestNegative").html(
    negativeItem
      ? `<strong>${negativeItem.rowLabel}</strong> and <strong>${negativeItem.columnLabel}</strong> show the strongest negative relationship with r = ${negativeItem.value.toFixed(3)}.`
      : "No negative relationship found for the selected countries and year."
  );
}

window.Chart6.draw = function(data, selectedYear, selectedCountries) {
  const container = d3.select("#chart6");
  container.selectAll("*").remove();

  window.Chart6.lockedSelection = null;

  const activeCountries = getSelectedCountriesForChart6(data, selectedYear, selectedCountries);

  d3.select("#chart6Badge").text(`Year: ${selectedYear} | Countries: ${activeCountries.length}`);

  const matrix = prepareCorrelationMatrix(data, selectedYear, activeCountries);
  updateRelationshipInsights(matrix);

  const validValues = matrix.filter(d => d.value !== null);

  if (activeCountries.length < 3 || validValues.length === 0) {
    container.html(`
      <div class="no-data">
        No correlation data available. Please select at least 3 countries with valid data for this year.
      </div>
    `);
    return;
  }

  const tooltip = d3.select("#tooltip");

  const containerWidth = container.node().clientWidth;
  const width = Math.max(containerWidth, 1020);
  const height = 650;

  const margin = {
    top: 125,
    right: 90,
    bottom: 85,
    left: 200
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 34)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", "#5f6f81")
    .text(`Correlation heatmap for ${activeCountries.length} selected countries in ${selectedYear}`);

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const labels = correlationFields.map(d => d.label);

  const x = d3.scaleBand()
    .domain(labels)
    .range([0, innerWidth])
    .padding(0.04);

  const y = d3.scaleBand()
    .domain(labels)
    .range([0, innerHeight])
    .padding(0.04);

  const color = d3.scaleDiverging()
    .domain([-1, 0, 1])
    .interpolator(d3.interpolateBrBG);

  chart
    .append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  chart
    .append("g")
    .attr("class", "axis")
    .call(d3.axisTop(x))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "start");

  const cells = chart
    .selectAll(".heatmap-cell")
    .data(matrix)
    .enter()
    .append("rect")
    .attr("class", "heatmap-cell")
    .attr("x", d => x(d.columnLabel))
    .attr("y", d => y(d.rowLabel))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 6)
    .attr("fill", d => d.value === null ? "#e5e7eb" : color(d.value))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      if (!window.Chart6.lockedSelection) {
        applyHeatmapHighlight(cells, d);
      }

      d3.select(this)
        .attr("stroke", "#243447")
        .attr("stroke-width", 2);

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.rowLabel}</strong> × <strong>${d.columnLabel}</strong><br>
          Correlation: ${d.value === null ? "No data" : d.value.toFixed(3)}<br>
          <em>Click to lock highlight</em>
        `)
        .style("left", `${event.pageX + 15}px`)
        .style("top", `${event.pageY - 20}px`);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", `${event.pageX + 15}px`)
        .style("top", `${event.pageY - 20}px`);
    })
    .on("mouseout", function() {
      if (window.Chart6.lockedSelection) {
        applyHeatmapHighlight(cells, window.Chart6.lockedSelection);
      } else {
        resetHeatmapHighlight(cells);
      }

      tooltip.style("opacity", 0);
    })
    .on("click", function(event, d) {
      event.stopPropagation();

      const current = window.Chart6.lockedSelection;

      const clickedSameCell =
        current &&
        current.rowLabel === d.rowLabel &&
        current.columnLabel === d.columnLabel;

      if (clickedSameCell) {
        window.Chart6.lockedSelection = null;
        resetHeatmapHighlight(cells);
      } else {
        window.Chart6.lockedSelection = {
          rowLabel: d.rowLabel,
          columnLabel: d.columnLabel
        };

        applyHeatmapHighlight(cells, window.Chart6.lockedSelection);
      }
    });

  svg.on("click", function() {
    window.Chart6.lockedSelection = null;
    resetHeatmapHighlight(cells);
  });

  chart
    .selectAll(".heatmap-text")
    .data(matrix)
    .enter()
    .append("text")
    .attr("class", "heatmap-text")
    .attr("x", d => x(d.columnLabel) + x.bandwidth() / 2)
    .attr("y", d => y(d.rowLabel) + y.bandwidth() / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "700")
    .attr("pointer-events", "none")
    .attr("fill", d => {
      if (d.value === null) return "#6b7280";
      return Math.abs(d.value) > 0.55 ? "#ffffff" : "#243447";
    })
    .text(d => d.value === null ? "NA" : d.value.toFixed(2));

  drawCorrelationLegend(svg, color, width, height);
};

function drawCorrelationLegend(svg, color, width, height) {
  const legendWidth = 270;
  const legendHeight = 13;

  const legendX = width - legendWidth - 95;
  const legendY = height - 48;

  const defs = svg.append("defs");

  const gradient = defs
    .append("linearGradient")
    .attr("id", "correlation-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const stops = d3.range(0, 1.01, 0.1);

  gradient
    .selectAll("stop")
    .data(stops)
    .enter()
    .append("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => color(-1 + d * 2));

  svg
    .append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("rx", 7)
    .attr("fill", "url(#correlation-gradient)");

  const legendScale = d3.scaleLinear()
    .domain([-1, 1])
    .range([legendX, legendX + legendWidth]);

  const legendAxis = d3.axisBottom(legendScale)
    .tickValues([-1, -0.5, 0, 0.5, 1])
    .tickFormat(d => d.toFixed(1));

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${legendY + legendHeight})`)
    .call(legendAxis);

  svg
    .append("text")
    .attr("x", legendX)
    .attr("y", legendY - 9)
    .attr("font-size", "12px")
    .attr("font-weight", "700")
    .attr("fill", "#405264")
    .text("Correlation Strength");
}

function applyHeatmapHighlight(cells, selectedCell) {
  cells
    .attr("opacity", cell => {
      return cell.rowLabel === selectedCell.rowLabel ||
             cell.columnLabel === selectedCell.columnLabel
        ? 1
        : 0.22;
    })
    .attr("stroke", cell => {
      return cell.rowLabel === selectedCell.rowLabel &&
             cell.columnLabel === selectedCell.columnLabel
        ? "#243447"
        : "#ffffff";
    })
    .attr("stroke-width", cell => {
      return cell.rowLabel === selectedCell.rowLabel &&
             cell.columnLabel === selectedCell.columnLabel
        ? 2.5
        : 1;
    });
}

function resetHeatmapHighlight(cells) {
  cells
    .attr("opacity", 1)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1);
}