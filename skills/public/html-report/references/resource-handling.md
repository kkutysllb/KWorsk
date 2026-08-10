# Resource Handling Guide

## Why relative paths break

The KWorks frontend previews `.html` artifacts by fetching the file text and rendering it in a **sandboxed iframe via a blob URL** (`<iframe sandbox="allow-scripts allow-forms">`). A blob URL has no filesystem base, so any relative reference (`./chart.png`, `assets/x.png`, `../data.csv`) resolves to `blob:.../chart.png` and returns **404**.

Desktop (managed) mode adds another constraint: artifact fetches require an auth header, which a plain `<img>` inside the sandboxed iframe cannot attach.

## The three safe image sources

| Source | When to use | Example |
|--------|-------------|---------|
| **base64 data URL** | Small images (icons, thumbnails); desktop managed mode; when the image must always render | `src="data:image/png;base64,iVBOR..."` |
| **Absolute API URL** | Web mode; images saved under the thread outputs dir | `src="/api/threads/{thread_id}/artifacts/mnt/user-data/outputs/chart.png"` |
| **Online chart URL** | Charts from the `chart-visualization` skill (Mode A) | `src="https://antv-studio.alipay.com/..."` |

**Never** use relative paths, `file://` URLs, or remote `http://` URLs that require cookies/auth.

## Base64 conversion

```bash
# PNG/JPG → base64 data URL (small files only)
base64 -i image.png | pbcopy   # macOS: copies base64 to clipboard
# or inline:
IMG_B64=$(base64 -i image.png | tr -d '\n')
echo "data:image/png;base64,$IMG_B64"
```

Keep each data URL reasonably small (a few hundred KB max); for large charts prefer an absolute API URL or an online chart URL.

## Other resources

- **Fonts**: use the system font stack already in the template. No external webfonts.
- **Stylesheets**: all CSS stays inside the single `<style>` block. No `<link rel="stylesheet">`.
- **Scripts**: the only allowed external script is ECharts CDN. No tracking, analytics, or third-party widgets.
- **Iframes/embeds**: avoid external embeds (YouTube etc.) — they are blocked or degraded inside the sandbox.

## Self-containment check

Before saving the report, grep for forbidden patterns:

```bash
grep -nE '<link |@import|src="\.\.?/|src="file:' report.html
# Expect no output
grep -nE 'src="(data:|https?://|/api/)' report.html
# Expect all image sources listed
```
