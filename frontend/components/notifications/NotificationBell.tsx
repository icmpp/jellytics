"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function NotificationBell({
  side = "bottom",
  align = "end",
  sideOffset,
  triggerClassName,
  label,
}: {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  triggerClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: countData } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const count = countData?.count ?? 0;
  const unread = notifications.filter((n) => !n.readAt);
  const read = notifications.filter((n) => n.readAt);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            "relative w-10 h-10 flex items-center justify-center rounded-xl text-white/50 hover:text-white transition-all tap-target"
          }
          aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
        >
          <span className="relative shrink-0">
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-2 -right-1.5 flex items-center justify-center">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-sm opacity-50"
                  style={{ background: "#7c3aed" }}
                />
                <span
                  className="relative min-w-[16px] h-[13px] flex items-center justify-center rounded-sm font-mono text-[9px] font-bold text-white px-1 leading-none"
                  style={{ background: "#7c3aed", border: "1px solid rgba(167,139,250,0.5)" }}
                >
                  {count > 99 ? "99+" : count}
                </span>
              </span>
            )}
          </span>
          {label && <span className="ml-1">{label}</span>}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="w-80 sm:w-96 p-0 rounded-lg border-0 shadow-2xl shadow-black/60"
        style={{ background: "#08080f", border: "1px solid rgba(139,92,246,0.18)" }}
      >
        <div className="terminal-scanlines relative overflow-hidden rounded-lg">
          <div className="relative z-10 flex flex-col">
            {/* Terminal title bar */}
            <div
              className="flex items-center gap-2.5 px-3 h-9 shrink-0"
              style={{ borderBottom: "1px solid #16162a", background: "#06060d" }}
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-2 h-2 rounded-full bg-[#ef4444]/70" />
                <div className="w-2 h-2 rounded-full bg-[#f59e0b]/70" />
                <div className="w-2 h-2 rounded-full bg-[#22c55e]/70" />
              </div>
              <span className="font-mono text-[11px] text-white/40 select-none ml-1">
                <span className="text-violet-400/60">jellytics</span>
                <span className="text-white/25"> — </span>
                notifications
              </span>
              {count > 0 && (
                <span
                  className="ml-auto font-mono text-[10px] font-semibold text-violet-200 px-2 py-0.5 rounded-sm select-none"
                  style={{ background: "#7c3aed", border: "1px solid rgba(167,139,250,0.4)" }}
                >
                  {count} unread
                </span>
              )}
            </div>

            {/* Notifications list */}
            <div className="max-h-[340px] overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-5 font-mono text-sm text-white/35 flex items-center gap-2">
                  <span className="text-violet-400/50">$</span>
                  <span>loading</span>
                  <span className="cursor-blink text-violet-400/70">_</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-5 font-mono text-sm text-white/35 flex items-center gap-2">
                  <span className="text-violet-400/50">$</span>
                  <span>no pending notifications</span>
                  <span className="cursor-blink text-violet-400/70">_</span>
                </div>
              ) : (
                <>
                  {unread.length > 0 && (
                    <div>
                      <SectionHeader label="unread" count={unread.length} />
                      {unread.map((n) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          onMarkRead={() => markRead.mutate(n.id)}
                          onClick={() => setOpen(false)}
                        />
                      ))}
                    </div>
                  )}
                  {read.length > 0 && (
                    <div>
                      <SectionHeader label="read" count={read.length} />
                      {read.map((n) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          onMarkRead={() => {}}
                          onClick={() => setOpen(false)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Vim-style status bar */}
            <div
              className="flex items-center gap-3 px-3 py-1.5 font-mono select-none"
              style={{ background: "#5b21b6", borderTop: "1px solid rgba(139,92,246,0.3)" }}
            >
              <span className="text-[10px] text-white/75 truncate flex-1">
                {notifications.length === 0
                  ? "~"
                  : `${notifications.length} total · ${count} unread`}
              </span>
              {count > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="font-mono text-[10px] text-white/60 hover:text-white/90 transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <span className="text-white/40">$</span>
                  <span>mark-all-read</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="font-mono text-[11px] text-violet-400/55 tracking-[0.2em] uppercase select-none">
        # {label}
        <span className="text-violet-400/30 ml-1">[{count}]</span>
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
      />
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
  onClick,
}: {
  notification: {
    id: number;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    readAt?: string | null;
    createdAt: string;
  };
  onMarkRead: () => void;
  onClick: () => void;
}) {
  const isUnread = !notification.readAt;
  const showId = notification.data?.show_id as number | undefined;
  const href = showId ? `/shows/${showId}` : "#";

  const timestamp = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  const content = (
    <div
      className={cn(
        "group flex items-start gap-2.5 px-3 py-2.5 transition-colors relative",
        isUnread ? "hover:bg-[#0d0d1a]" : "hover:bg-[#0a0a12] opacity-60 hover:opacity-80",
      )}
      style={isUnread ? { boxShadow: "inset 3px 0 0 rgba(139,92,246,0.4)" } : {}}
    >
      {/* Prompt marker */}
      <span
        className={cn(
          "font-mono text-xs shrink-0 mt-0.5 select-none transition-colors",
          isUnread
            ? "text-violet-400/70 group-hover:text-violet-400 phosphor-glow"
            : "text-white/15",
        )}
      >
        {isUnread ? ">" : "·"}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "font-mono text-xs leading-snug truncate",
              isUnread ? "text-white/85" : "text-white/40",
            )}
          >
            {notification.title}
          </p>
          {isUnread && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkRead();
              }}
              className="shrink-0 font-mono text-[9px] text-violet-400/40 hover:text-violet-300/70 transition-colors select-none"
              title="Mark read"
            >
              [read]
            </button>
          )}
        </div>
        {notification.body && (
          <p
            className={cn(
              "font-mono text-[11px] mt-0.5 line-clamp-2",
              isUnread ? "text-white/45" : "text-white/25",
            )}
          >
            {notification.body}
          </p>
        )}
        <p className="font-mono text-[10px] text-white/25 mt-1">{timestamp}</p>
      </div>
    </div>
  );

  if (href !== "#") {
    return (
      <Link
        href={href}
        onClick={() => {
          onMarkRead();
          onClick();
        }}
        className="block"
        style={{ borderBottom: "1px solid #16162a" }}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      onClick={() => {
        onMarkRead();
        onClick();
      }}
      className="cursor-pointer"
      style={{ borderBottom: "1px solid #16162a" }}
    >
      {content}
    </div>
  );
}
