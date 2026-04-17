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
import { Button } from "@/components/ui/button";

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
            <Bell className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-purple-500 text-white text-xs font-medium">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </span>
          {label && <span>{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="w-80 sm:w-96 p-0"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold text-white">Notifications</h3>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-purple-400 hover:text-purple-300 h-8"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-white/40 text-sm">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-white/40 text-sm">No notifications</div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={() => {
                  if (!n.readAt) {
                    markRead.mutate(n.id);
                  }
                }}
                onClick={() => setOpen(false)}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
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

  return (
    <div
      className={`px-4 py-3 border-b border-white/6 last:border-0 ${
        isUnread ? "bg-purple-500/5" : ""
      }`}
    >
      {href !== "#" ? (
        <Link
          href={href}
          onClick={() => {
            onMarkRead();
            onClick();
          }}
          className="block"
        >
          <div className="font-medium text-white text-sm">{notification.title}</div>
          {notification.body && (
            <div className="text-xs text-white/50 mt-0.5">{notification.body}</div>
          )}
          <div className="text-xs text-white/30 mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
            })}
          </div>
        </Link>
      ) : (
        <div
          className="cursor-pointer"
          onClick={() => {
            onMarkRead();
            onClick();
          }}
        >
          <div className="font-medium text-white text-sm">{notification.title}</div>
          {notification.body && (
            <div className="text-xs text-white/50 mt-0.5">{notification.body}</div>
          )}
          <div className="text-xs text-white/30 mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
