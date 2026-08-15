/**
 * Resolve the desktop SQLite directory under ~/.kworks/data.
 *
 * QiLin's ``database.sqlite_dir`` is resolved via
 * ``Path(self.sqlite_dir).resolve()`` — a relative path would be anchored at
 * the gateway process CWD (the qilin/ submodule), which is NOT where desktop
 * user data should live. We therefore emit an absolute path so the SQLite
 * database always lands under the stable ``~/.kworks/data`` home regardless
 * of where ``uv run`` is invoked.
 */
function desktopSqliteDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return home ? `${home}/.kworks/data` : ".kworks/data";
}

interface SectionRange {
  start: number;
  end: number;
  text: string;
}

function findTopLevelSections(source: string, sectionName: string): SectionRange[] {
  const sectionRe = new RegExp(`^${sectionName}:\\s*$`, "gm");
  const nextTopLevelRe = /^[A-Za-z0-9_-]+:\s*.*$/gm;
  const ranges: SectionRange[] = [];

  for (const match of source.matchAll(sectionRe)) {
    const start = match.index ?? 0;
    const headerEnd = source.indexOf("\n", start);
    const bodyStart = headerEnd === -1 ? source.length : headerEnd + 1;
    let end = source.length;

    nextTopLevelRe.lastIndex = bodyStart;
    const next = nextTopLevelRe.exec(source);
    if (next && (next.index ?? source.length) > start) {
      end = next.index ?? source.length;
    }

    ranges.push({ start, end, text: source.slice(start, end) });
  }

  return ranges;
}

function appendSection(source: string, section: string): string {
  const separator = source.endsWith("\n") ? "\n" : "\n\n";
  return `${source}${separator}${section}`;
}

function replaceOrAppendAgentsApi(source: string): string {
  const ranges = findTopLevelSections(source, "agents_api");
  const enabledSection = "agents_api:\n  enabled: true\n";

  if (ranges.length === 0) {
    return appendSection(source, enabledSection);
  }

  if (
    ranges.length === 1 &&
    /^[ \t]+enabled:\s*true\s*$/m.test(ranges[0]?.text ?? "")
  ) {
    return source;
  }

  let migrated = source;
  for (const range of [...ranges].reverse()) {
    migrated = `${migrated.slice(0, range.start)}${migrated.slice(range.end)}`;
  }
  return appendSection(migrated.trimEnd(), enabledSection);
}

function replaceOrAppendDesktopDatabase(source: string): string {
  const sqliteDir = desktopSqliteDir();
  const ranges = findTopLevelSections(source, "database");
  const desktopDatabaseSection = `database:\n  backend: sqlite\n  sqlite_dir: ${sqliteDir}\n`;

  if (ranges.length === 0) {
    return appendSection(source, desktopDatabaseSection);
  }

  const range = ranges[0];
  if (!range) return source;

  const backendMatch = range.text.match(/^[ \t]+backend:\s*([^\s#]+).*$/m);
  if (backendMatch && backendMatch[1] !== "sqlite") {
    return source;
  }

  const lines = range.text.split("\n");
  let backendIdx = -1;
  let sqliteIdx = -1;

  // Pass 1: update existing values in place, recording their line indices.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (/^[ \t]+backend:\s*/.test(line)) {
      lines[i] = "  backend: sqlite";
      backendIdx = i;
    }
    if (/^[ \t]+sqlite_dir:\s*/.test(line)) {
      lines[i] = `  sqlite_dir: ${sqliteDir}`;
      sqliteIdx = i;
    }
  }

  // Insert `backend: sqlite` right after the `database:` header if missing.
  if (backendIdx === -1) {
    lines.splice(1, 0, "  backend: sqlite");
    backendIdx = 1;
    if (sqliteIdx !== -1) sqliteIdx += 1; // shifted by the splice above
  }

  // Insert `sqlite_dir` immediately after `backend` if missing. Keeping the
  // two adjacent prevents the value from landing after a downstream comment
  // block (which `findTopLevelSections` cannot distinguish from `database:`'s
  // own body — see the class docstring on `Paths` for why this matters).
  if (sqliteIdx === -1) {
    lines.splice(backendIdx + 1, 0, `  sqlite_dir: ${sqliteDir}`);
    sqliteIdx = backendIdx + 1;
  }

  // Realign `sqlite_dir` if a prior revision inserted it far from `backend`
  // with only comments / blank lines in between. We never reorder when the gap
  // contains another real key — that would silently rewrite a user's
  // intentional key ordering.
  if (sqliteIdx > backendIdx + 1) {
    let gapIsCommentsOnly = true;
    for (let i = backendIdx + 1; i < sqliteIdx; i += 1) {
      const gapLine = (lines[i] ?? "").trim();
      if (gapLine !== "" && !gapLine.startsWith("#")) {
        gapIsCommentsOnly = false;
        break;
      }
    }
    if (gapIsCommentsOnly) {
      const [moved] = lines.splice(sqliteIdx, 1);
      lines.splice(backendIdx + 1, 0, moved);
    }
  }

  const migratedSection = lines.join("\n");
  if (migratedSection === range.text) {
    return source;
  }
  return `${source.slice(0, range.start)}${migratedSection}${source.slice(range.end)}`;
}

/**
 * The community browser-automation tool block exactly as it shipped in the
 * embedded config through v1.0.5. Used as a pristine-marker for the
 * conditional swap to the native browser tools: the block is only replaced
 * when it matches byte-for-byte — any user edit (added options, removed
 * tools, altered comments) makes the marker miss and the config is left
 * untouched.
 */
const PRISTINE_COMMUNITY_BROWSER_BLOCK = `\
  # 浏览器自动化（已安装 playwright + Chromium，headless 模式运行）
  # 浏览器会话驻留在单 worker 内存中，保持 GATEWAY_WORKERS=1。
  - name: browser_navigate
    group: browser
    use: qilin.community.browser_automation.tools:browser_navigate_tool
    headless: true
    timeout_ms: 30000
    viewport_width: 1280
    viewport_height: 720
  - name: browser_snapshot
    group: browser
    use: qilin.community.browser_automation.tools:browser_snapshot_tool
  - name: browser_click
    group: browser
    use: qilin.community.browser_automation.tools:browser_click_tool
  - name: browser_type
    group: browser
    use: qilin.community.browser_automation.tools:browser_type_tool
  - name: browser_get_text
    group: browser
    use: qilin.community.browser_automation.tools:browser_get_text_tool
    max_chars: 8000
  - name: browser_back
    group: browser
    use: qilin.community.browser_automation.tools:browser_back_tool
  - name: browser_screenshot
    group: browser
    use: qilin.community.browser_automation.tools:browser_screenshot_tool
  - name: browser_close
    group: browser
    use: qilin.community.browser_automation.tools:browser_close_tool\
`;

/** The native browser tool block this migration upgrades pristine installs to. */
const NATIVE_BROWSER_TOOLS_BLOCK = `\
  # 原生浏览器工具（共享无头 Chromium，Playwright）。一次性调用：每次带 URL
  # 执行并返回结果，不在调用间保持交互会话。
  #   browser_navigate   → 页面标题 + HTTP 状态 + 最终 URL
  #   browser_read_page  → 页面可见正文（超过 max_chars 截断）
  #   browser_screenshot → PNG 存入线程输出目录，返回路径
  # 启动参数（headless/超时/视口）以 browser_navigate 为准，三个工具共享。
  # Playwright 未安装时工具保持注册并返回明确的安装指引。
  # 如需社区版有状态浏览器套件（snapshot/click/type 循环），注释掉下面三条，
  # 改用 qilin.community.browser_automation.tools:* 系列（同名工具不可并存）。
  - name: browser_navigate
    group: browser
    use: qilin.tools.builtins.browser_tools:browser_navigate_tool
    headless: true
    timeout_ms: 30000
    network_idle_timeout_ms: 5000
    viewport_width: 1280
    viewport_height: 720
    # allow_private_addresses: false  # SSRF 防护默认开启，保持 false
  - name: browser_read_page
    group: browser
    use: qilin.tools.builtins.browser_tools:browser_read_page_tool
    max_chars: 20000
  - name: browser_screenshot
    group: browser
    use: qilin.tools.builtins.browser_tools:browser_screenshot_tool\
`;

/**
 * Swap the pristine community browser-automation block for the native
 * browser tools. Byte-exact marker matching keeps user-customized blocks
 * (and configs that never had the community suite) untouched.
 */
function replacePristineCommunityBrowserTools(source: string): string {
  if (!source.includes(PRISTINE_COMMUNITY_BROWSER_BLOCK)) {
    return source;
  }
  return source.replace(
    PRISTINE_COMMUNITY_BROWSER_BLOCK,
    NATIVE_BROWSER_TOOLS_BLOCK,
  );
}

export function migrateDesktopConfigYaml(source: string): string {
  return replaceOrAppendAgentsApi(
    replaceOrAppendDesktopDatabase(
      replacePristineCommunityBrowserTools(source),
    ),
  );
}
