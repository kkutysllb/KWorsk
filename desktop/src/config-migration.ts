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

export function migrateDesktopConfigYaml(source: string): string {
  return replaceOrAppendAgentsApi(replaceOrAppendDesktopDatabase(source));
}
