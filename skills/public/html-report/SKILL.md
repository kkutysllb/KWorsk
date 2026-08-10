---
name: html-report
description: Use this skill whenever the final deliverable should be a polished self-contained HTML report instead of plain Markdown — market analysis, industry research, consulting-grade reports, data reports, project summaries, literature reviews, or any document deliverable that should be visually rich and printable. Produces a single .html file with embedded CSS (cover page, auto-generated table of contents, chapter sections, charts via the chart-visualization skill or inline ECharts, styled tables, citations, print-ready styling). Triggers on "HTML report", "自包含报告", "图文并茂的报告", "可视化报告", or whenever an agent plans to deliver a research report as a document file.
---

# HTML Report Skill

Produce a **single-file, self-contained HTML report** (embedded CSS + inline resources, no external stylesheets, no relative-path assets) that renders correctly both in the KWorks artifact preview (sandboxed iframe) and in any browser. Every report is **visually rich**: cover page, auto-generated table of contents, chapter sections with chart anchors, styled tables, citations and print-ready CSS.

This skill is the **output-format authority** for report deliverables. Analysis skills such as `consulting-analysis`, `github-deep-research`, `systematic-literature-review` and `academic-paper-review` hand off their final report stage to this skill. When invoked on its own, apply the workflow below to whatever data/chapter plan is provided.

## When to Use

- The user asks for a "report", "research summary", "analysis document", "交付报告" or similar **document deliverable**.
- An upstream skill (consulting-analysis, deep-research, data-analysis, ...) has collected data and needs a polished final output.
- The deliverable benefits from charts, tables, a cover page, or print/PDF export.

## Inputs

| Input | Description | Required |
|-------|-------------|----------|
| **Data Package** | Structured data per chapter (numbers, findings, sources) | Yes |
| **Chapter Plan** | Section skeleton + per-chapter visualization plan | Recommended |
| **Chart Files / URLs** | Pre-generated chart images or data for chart generation | Optional |
| **Sources** | Citation list (URLs, titles, dates) | Recommended |

## Workflow

### Step 1 — Plan Chapters and Chart Anchors

1. Build the section skeleton (cover, abstract, main chapters, conclusion, references).
2. For each chapter, decide which data deserves a **visual anchor** (chart) and which belongs in a comparison table.
3. Only use data present in the Data Package. Never invent or "smooth" numbers.

### Step 2 — Generate Charts

Follow `references/chart-embedding.md` for the two supported modes:

- **Mode A — online chart image (default)**: delegate to the `chart-visualization` skill (`/mnt/skills/public/chart-visualization/SKILL.md`) which returns an **image URL** for each chart. Embed as `<figure><img>`.
- **Mode B — inline ECharts (interactive)**: when the user needs hover tooltips, drill-down, linked views or export interaction, embed ECharts (jsdelivr CDN `<script>`) with an option object. See the template's commented ECharts block.

Decide per chart. Mode A is always safe; use Mode B only when interaction genuinely adds value (the CDN requires network at view time; offline environments fall back to Mode A).

### Step 3 — Assemble from the Template

1. Read `assets/report_template.html`.
2. Copy the full template, then fill every section:
   - Cover: title, subtitle, date, author/agent name, abstract.
   - TOC: generated automatically by the template script from `h2`/`h3` — keep heading hierarchy clean.
   - Chapters: one `<section class="chapter">` per chapter, `h2` title + body.
   - Visual anchors: `<figure>` with `<img>` (Mode A) or `<div class="chart">` + init script (Mode B).
   - Tables: `<table class="data-table">` with `<caption>`.
   - References: `<ol id="sources">` with clickable links.
3. Keep the template's CSS and script blocks **intact** — do not strip them.

### Step 4 — Make It Self-Contained

Follow `references/resource-handling.md`:

- All images must be **base64 data URLs**, **absolute API URLs** (`/api/threads/{tid}/artifacts/mnt/user-data/outputs/...`), or **online chart URLs** (Mode A). Relative paths like `./chart.png` or `assets/x.png` **will break** in the sandboxed preview — never use them.
- No external stylesheets or webfonts. Only allowed external script: ECharts CDN.
- Keep all CSS inside the single `<style>` block.

### Step 5 — Self-Containment Checklist

Verify all of the following before saving:

- [ ] Single `.html` file; all CSS inline; no `<link rel="stylesheet">`.
- [ ] Every `<img src>` is a data URL, absolute API URL, or online URL — zero relative paths.
- [ ] All sections from the chapter plan are present and in order.
- [ ] Every table cell/`<figure>` value matches the Data Package (no invented numbers).
- [ ] Sources section exists with clickable links.
- [ ] Language matches the user's locale (Chinese reports use full-width punctuation).
- [ ] The template script blocks (TOC generation) are present.

### Step 6 — Save and Deliver

1. Save as `/mnt/user-data/outputs/report_{topic_slug}_{YYYYMMDD}.html` (topic_slug = lowercase, hyphens).
2. Present it with the `present_files` tool (it is a deliverable under `/mnt/user-data/outputs`).

## Rules

- **One file, everything inline** — the report must render from a single HTML file.
- **Data discipline** — only data from the Data Package; mark missing data explicitly (e.g., "data unavailable" instead of fabricating).
- **Charts before prose** — generate all chart anchors before writing the narrative (consistent visual story, no interleaving).
- **Citations** — every claim from an external source gets a clickable link in the report body and in the Sources section.
- **Do not** include tracking scripts, remote iframes, or anything beyond ECharts CDN.

## Related Skills

- `chart-visualization` — generates online chart image URLs (Mode A).
- `consulting-analysis` — produces consulting-grade reports; its Phase 2 output uses this skill.
- `deep-research` / `data-analysis` — upstream data collection skills that feed the Data Package.

## License

MIT
