"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useScopedKey } from "@/lib/auth";
import { notificationIcon } from "@/lib/nav";
import type { NotificationItem } from "@/lib/types";
import clsx from "clsx";

function relativeTime(iso: string, locale: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return locale === "ar" ? "الآن" : "Just now";
  if (mins < 60) return locale === "ar" ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale === "ar" ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return locale === "ar" ? `منذ ${days} ي` : `${days}d ago`;
}

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const key = useScopedKey(["notifications"]);
  const unreadKey = useScopedKey(["unread"]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => endpoints.notifications(),
    staleTime: 60_000,
  });
  const items = (query.data ?? []) as NotificationItem[];
  const unreadCount = items.filter((item) => !item.readAt).length;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: unreadKey }),
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notifications")}
        description={unreadCount ? t("unreadCount", { count: unreadCount }) : t("allCaughtUp")}
        actions={
          unreadCount ? (
            <button
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-bg"
              onClick={async () => {
                await endpoints.markAllNotificationsRead();
                await refresh();
              }}
            >
              {t("markAllRead")}
            </button>
          ) : null
        }
      />
      {!items.length ? (
        <EmptyState title={t("noNotifications")} />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = notificationIcon(item.type);
            const href = item.taskId
              ? `/tasks/detail?id=${item.taskId}`
              : item.projectId
                ? `/projects/detail?id=${item.projectId}`
                : null;
            const body = (
              <div
                className={clsx(
                  "flex gap-3 rounded-2xl border px-4 py-3.5 transition-colors duration-200",
                  item.readAt ? "border-line bg-white" : "border-accent/20 bg-accent/[0.04] shadow-sm",
                )}
              >
                <div
                  className={clsx(
                    "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    item.readAt ? "bg-bg text-muted" : "bg-sidebar text-white",
                  )}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx("text-sm", item.readAt ? "font-medium text-ink" : "font-semibold text-ink")}>
                          {item.title}
                        </span>
                        {!item.readAt ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">{relativeTime(item.createdAt, locale)}</span>
                  </div>
                </div>
              </div>
            );

            if (href) {
              return (
                <Link
                  key={item.id}
                  href={href}
                  onClick={async () => {
                    if (!item.readAt) {
                      await endpoints.markNotificationRead(item.id);
                      await refresh();
                    }
                  }}
                  className="block"
                >
                  {body}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                className="block w-full"
                onClick={async () => {
                  if (!item.readAt) {
                    await endpoints.markNotificationRead(item.id);
                    await refresh();
                  }
                }}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
