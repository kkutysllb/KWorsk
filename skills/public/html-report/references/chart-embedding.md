# Chart Embedding Guide

Two supported modes for visual anchors in HTML reports. Decide per chart.

## Mode A — Online Chart Image (default)

Delegate chart generation to the `chart-visualization` skill:

1. Read `/mnt/skills/public/chart-visualization/SKILL.md`.
2. Select the chart type (line/bar/pie/radar/sankey/...). Consult the per-type spec in `references/` of that skill.
3. Run the generator:

```bash
node /mnt/skills/public/chart-visualization/scripts/generate.js '<payload_json>'
```

The script returns an **image URL** (rendered by the antv online service).

4. Embed as:

```html
<figure>
  <img src="{CHART_IMAGE_URL}" alt="{ALT_TEXT}" />
  <figcaption>图 2-1 {CAPTION}</figcaption>
</figure>
```

**When to prefer Mode A**
- Simple trend / comparison / part-to-whole visuals.
- Offline or low-bandwidth environments (the report still renders; only the image may be missing if the URL is unreachable — acceptable degradation).
- Multiple charts (cheap to generate, zero JS).

**Notes**
- Use the returned URL as-is; do not re-host or download the image into the outputs directory (relative paths break the sandboxed preview).
- `alt` text is required — describe what the chart shows.

## Mode B — Inline ECharts (interactive, optional)

Use when the user benefits from **hover tooltips, zoom, drill-down, linked views, or export interaction** — e.g. a multi-series trend that deserves axis zoom, or a dashboard-style report.

1. Keep the ECharts CDN script line in `<head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
```

2. Reserve a sized container:

```html
<div class="chart" id="chart-2-1"></div>
```

3. Initialize and configure:

```html
<script>
  const chart = echarts.init(document.getElementById("chart-2-1"));
  chart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["Series A"] },
    xAxis: { type: "category", data: [...] },
    yAxis: { type: "value" },
    series: [{ name: "Series A", type: "line", data: [...] }],
  });
  window.addEventListener("resize", function () { chart.resize(); });
</script>
```

**When to prefer Mode B**
- Interactive exploration genuinely adds value.
- Network is available at view time (CDN must load; otherwise the chart area stays empty — in that case fall back to Mode A).

**Notes**
- One `echarts.init` per container; always register the `resize` handler.
- Keep chart data derived strictly from the Data Package.
- The template already ships a commented ECharts block — copy it.

## Data Rules (both modes)

- Use **only** numbers present in the Data Package. Never invent or smooth data.
- If data points are missing, the chart must reflect that (broken line / empty slot) or the chart type must be adjusted — never fake values.
- Every chart needs a `<figcaption>` or caption line with the chart number and title.
