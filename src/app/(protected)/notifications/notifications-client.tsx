"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/server/actions/notification-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationsClient({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const markRead = async (notificationId: string) => {
    const result = await markNotificationRead({ notificationId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Notification marked as read.");
    router.refresh();
  };

  const markAll = async () => {
    const result = await markAllNotificationsRead();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Marked ${result.data.count} notifications as read.`);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Notifications</span>
            <Button variant="outline" onClick={markAll}>
              Mark all read
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded border border-slate-200 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium text-slate-900">{notification.title}</p>
                  <Badge variant={notification.readAt ? "default" : "info"}>{notification.readAt ? "Read" : "Unread"}</Badge>
                </div>
                <p className="text-sm text-slate-700">{notification.message}</p>
                <p className="mt-1 text-xs text-slate-500">{notification.type} - {formatDate(notification.createdAt)}</p>

                <div className="mt-2 flex gap-2">
                  {notification.link ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={notification.link}>Open</a>
                    </Button>
                  ) : null}
                  {!notification.readAt ? (
                    <Button size="sm" onClick={() => markRead(notification.id)}>
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
            {!notifications.length ? <li className="text-sm text-slate-500">No notifications.</li> : null}
          </ul>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}
