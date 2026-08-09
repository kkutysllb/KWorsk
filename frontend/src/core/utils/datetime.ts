import {
  format,
  formatDistanceToNow,
  isThisWeek,
  isThisYear,
  isToday,
  isYesterday,
} from "date-fns";
import { enUS as dateFnsEnUS, zhCN as dateFnsZhCN } from "date-fns/locale";

import { detectLocale, type Locale } from "@/core/i18n";
import { getLocaleFromCookie } from "@/core/i18n/cookies";

function getDateFnsLocale(locale: Locale) {
  switch (locale) {
    case "zh-CN":
      return dateFnsZhCN;
    case "en-US":
    default:
      return dateFnsEnUS;
  }
}

export function formatTimeAgo(date: Date | string | number, locale?: Locale) {
  const effectiveLocale =
    locale ??
    (getLocaleFromCookie() as Locale | null) ??
    // Fallback when cookie is missing (or on first render)
    detectLocale();
  // Guard against invalid/empty timestamps (e.g. a backend returning "" for
  // lastUpdated when there are no memories) -- date-fns would throw
  // "Invalid time value" on `new Date("")`. Return a neutral placeholder.
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return formatDistanceToNow(parsed, {
    addSuffix: true,
    locale: getDateFnsLocale(effectiveLocale),
  });
}

/**
 * Compact "smart" timestamp for space-constrained surfaces such as the
 * sidebar history list. Layers progressively coarser granularity as the
 * moment recedes in time:
 *
 *  - same day      -> `14:30`          (HH:mm)
 *  - yesterday     -> `昨天` / `Yesterday`
 *  - this week     -> `周三` / `Wed`     (locale-aware short weekday)
 *  - this year     -> `08-05` / `08/05`
 *  - older         -> `2025-08-05` / `2025/08/05`
 *
 * Falls back to `"-"` on an unparseable value so callers never throw.
 */
export function formatSmartTime(date: Date | string | number, locale?: Locale) {
  const effectiveLocale =
    locale ??
    (getLocaleFromCookie() as Locale | null) ??
    detectLocale();
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  const dfLocale = getDateFnsLocale(effectiveLocale);
  const isZh = effectiveLocale === "zh-CN";
  if (isToday(parsed)) {
    return format(parsed, "HH:mm", { locale: dfLocale });
  }
  if (isYesterday(parsed)) {
    return isZh ? "昨天" : "Yesterday";
  }
  if (isThisWeek(parsed, { weekStartsOn: 1 })) {
    return format(parsed, "EEE", { locale: dfLocale });
  }
  if (isThisYear(parsed)) {
    return format(parsed, isZh ? "MM-dd" : "MM/dd", { locale: dfLocale });
  }
  return format(parsed, isZh ? "yyyy-MM-dd" : "yyyy/MM/dd", {
    locale: dfLocale,
  });
}
