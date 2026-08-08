"use client";

import {
  LogOutIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetch, getCsrfHeaders } from "@/core/api/fetcher";
import { useAuth } from "@/core/auth/AuthProvider";
import { setDesktopSessionToken } from "@/core/auth/session";
import { type LoginResponse, parseAuthError } from "@/core/auth/types";
import { getBackendBaseURL, isDesktop } from "@/core/config";
import { enUS, isLocale, zhCN, type Locale } from "@/core/i18n";
import { useI18n } from "@/core/i18n/hooks";

const languageOptions: { value: Locale; label: string }[] = [
  { value: "en-US", label: enUS.locale.localName },
  { value: "zh-CN", label: zhCN.locale.localName },
];

/** 设置分组卡片：标题 + 圆角边框列表。 */
function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
        {title}
      </h3>
      <div className="divide-y overflow-hidden rounded-xl border">{children}</div>
    </section>
  );
}

/** 行式设置项：左侧标签 + 描述，右侧控件。 */
function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function GeneralSettingsPage() {
  const { t } = useI18n();
  const { user, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, changeLocale } = useI18n();
  const currentTheme = (theme ?? "system") as "system" | "light" | "dark";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError(t.settings.account.passwordMismatch);
      return;
    }
    if (newPassword.length < 8) {
      setError(t.settings.account.passwordTooShort);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${getBackendBaseURL()}/api/v1/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(),
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        const authError = parseAuthError(data);
        setError(authError.message);
        return;
      }

      const data = (await res.json()) as LoginResponse;
      if (isDesktop() && data.access_token) {
        setDesktopSessionToken(data.access_token);
      }
      await refreshUser();

      setMessage(t.settings.account.passwordSuccess);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError(t.settings.account.networkError);
    } finally {
      setLoading(false);
    }
  };

  const themeOptions: {
    value: "system" | "light" | "dark";
    label: string;
    icon: typeof SunIcon;
  }[] = [
    { value: "system", label: t.settings.appearance.system, icon: MonitorSmartphoneIcon },
    { value: "light", label: t.settings.appearance.light, icon: SunIcon },
    { value: "dark", label: t.settings.appearance.dark, icon: MoonIcon },
  ];

  return (
    <div className="space-y-6">
      {/* 账户 */}
      <SettingsGroup title={t.settings.general.accountGroup}>
        <SettingsRow label={t.settings.account.email}>
          <span className="text-muted-foreground text-sm">
            {user?.email ?? "—"}
          </span>
        </SettingsRow>
        <SettingsRow label={t.settings.account.role}>
          <span className="text-muted-foreground text-sm capitalize">
            {user?.system_role ?? "—"}
          </span>
        </SettingsRow>

        {/* 密码修改 */}
        <form onSubmit={handleChangePassword} className="space-y-3 px-4 py-4">
          <div className="text-sm font-medium">
            {t.settings.account.passwordSection}
          </div>
          <div className="grid max-w-md grid-cols-[110px_1fr] gap-x-3 gap-y-2.5">
            <label
              htmlFor="current-pwd"
              className="text-muted-foreground flex items-center text-sm"
            >
              {t.settings.account.currentPassword}
            </label>
            <Input
              id="current-pwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="h-8"
            />
            <label
              htmlFor="new-pwd"
              className="text-muted-foreground flex items-center text-sm"
            >
              {t.settings.account.newPassword}
            </label>
            <Input
              id="new-pwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="h-8"
            />
            <label
              htmlFor="confirm-pwd"
              className="text-muted-foreground flex items-center text-sm"
            >
              {t.settings.account.confirmPassword}
            </label>
            <Input
              id="confirm-pwd"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="h-8"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-500">{message}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="outline" size="sm" disabled={loading}>
              {loading
                ? t.settings.account.updating
                : t.settings.account.update}
            </Button>
          </div>
        </form>

        {/* 退出登录 */}
        <div className="px-4 py-3">
          <Button
            variant="destructive"
            size="sm"
            onClick={logout}
            className="gap-2"
          >
            <LogOutIcon className="size-4" />
            {t.settings.account.logout}
          </Button>
        </div>
      </SettingsGroup>

      {/* 外观 */}
      <SettingsGroup title={t.settings.general.appearanceGroup}>
        <SettingsRow
          label={t.settings.appearance.themeTitle}
          description={t.settings.appearance.themeDescription}
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={currentTheme}
            onValueChange={(value) => {
              if (value) setTheme(value);
            }}
          >
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="gap-1.5"
                >
                  <Icon className="size-3.5" />
                  {option.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </SettingsRow>
        <SettingsRow
          label={t.settings.appearance.languageTitle}
          description={t.settings.appearance.languageDescription}
        >
          <Select
            value={locale}
            onValueChange={(value) => {
              if (isLocale(value)) {
                changeLocale(value);
              }
            }}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
