// src/components/NotificationBell.jsx
import React, { useEffect, useState } from "react";
import { authFetch } from "../auth";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]); // history + new
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // ───────────────────────────────
  // Poll NEW notifications every 15s
  // ───────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const fetchNewNotifications = async () => {
      try {
        const data = await authFetch(
          "/api/notifications?unreadOnly=true",
          {
            method: "GET",
          }
        );

        if (!isMounted) return;

        if (Array.isArray(data) && data.length > 0) {
          // Mark them as "new" for UI highlighting
          const withFlags = data.map((n) => ({
            ...n,
            isNew: true,
          }));

          // Prepend new ones, avoid duplicates by id
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const filtered = withFlags.filter((n) => !existingIds.has(n.id));
            return [...filtered, ...prev];
          });

          setUnreadCount((prev) => prev + data.length);
        }
      } catch (err) {
        // authFetch can throw on 401 etc.
        console.error("Error fetching new notifications", err);
      }
    };

    // initial fetch
    fetchNewNotifications();

    // poll every 15 seconds
    const intervalId = setInterval(fetchNewNotifications, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // ───────────────────────────────
  // Load HISTORY when opening panel
  // ───────────────────────────────
  const loadHistory = async () => {
    try {
      const data = await authFetch(
        "/api/notifications?unreadOnly=false",
        { method: "GET" }
      );

      if (!Array.isArray(data)) return;

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));

        const historyItems = data.map((n) => ({
          ...n,
          // If it's already in prev as new, keep isNew=true
          isNew: existingIds.has(n.id)
            ? prev.find((p) => p.id === n.id)?.isNew || false
            : false,
        }));

        // Merge: history first (sorted from backend), then any extra already in state
        const mergedMap = new Map();

        // history items
        for (const n of historyItems) {
          mergedMap.set(n.id, n);
        }

        // any not-yet-in-history items from prev
        for (const n of prev) {
          if (!mergedMap.has(n.id)) {
            mergedMap.set(n.id, n);
          }
        }

        return Array.from(mergedMap.values());
      });

      setHistoryLoaded(true);
    } catch (err) {
      console.error("Failed to load notification history", err);
    }
  };

  const toggleOpen = () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      // Opening the panel → clear badge
      setUnreadCount(0);

      // Load history only once
      if (!historyLoaded) {
        loadHistory();
      }
    }
  };

  return (
    <div className="notifBellWrapper">
      <button className="notifBellButton" onClick={toggleOpen}>
        🔔
        {unreadCount > 0 && (
          <span className="notifBadge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notifPanel">
          <div className="notifPanelHeader">Notifications</div>

          {notifications.length === 0 && (
            <div className="notifEmpty">No notifications yet</div>
          )}

          {notifications.map((n) => {
            const type = n.payload?.type;
            const start = n.payload?.startTime;
            const end = n.payload?.endTime;
            const isNew = n.isNew;

            const cardClass = [
              "notifCard",
              isNew ? "notifNew" : "",
              type === "SLOT_ASSIGNED" ? "success" : "",
              type === "SLOT_REJECTED" ? "error" : "",
              type === "BOOKING_ACCEPTED" || type === "BOOKING_REMINDER"
                ? "info"
                : "",
            ]
              .filter(Boolean)
              .join(" ");

            // 1) Booking accepted (right after user clicks confirm)
            if (type === "BOOKING_ACCEPTED") {
              return (
                <div key={n.id} className={cardClass}>
                  <div className="notifTitle">
                    Pre-booking received {isNew && <span>•</span>}
                  </div>
                  <div className="notifBody">
                    We’ve received your request for{" "}
                    <strong>{start}</strong> → <strong>{end}</strong>.
                  </div>
                  <div className="notifSub">
                    We’ll assign a parking slot closer to your start time.
                  </div>
                </div>
              );
            }

            // 2) Reminder 15 minutes before
            if (type === "BOOKING_REMINDER") {
              return (
                <div key={n.id} className={cardClass}>
                  <div className="notifTitle">
                    Parking starts soon {isNew && <span>•</span>}
                  </div>
                  <div className="notifBody">
                    Your parking window from <strong>{start}</strong> to{" "}
                    <strong>{end}</strong> starts in about 15 minutes.
                  </div>
                </div>
              );
            }

            // 3) Slot assigned
            if (type === "SLOT_ASSIGNED") {
              return (
                <div key={n.id} className={cardClass}>
                  <div className="notifTitle">
                    Slot assigned {isNew && <span>•</span>}
                  </div>
                  <div className="notifBody">
                    Your parking slot is <strong>{n.payload.slotId}</strong>.
                  </div>
                  <div className="notifSub">
                    Valid from <strong>{start}</strong> to{" "}
                    <strong>{end}</strong>.
                  </div>
                </div>
              );
            }

            // 4) Slot rejected
            if (type === "SLOT_REJECTED") {
              return (
                <div key={n.id} className={cardClass}>
                  <div className="notifTitle">
                    No slot available {isNew && <span>•</span>}
                  </div>
                  <div className="notifBody">
                    {n.payload.reason ||
                      "We couldn’t find a free slot in your requested time window."}
                  </div>
                  <div className="notifSub">
                    {start} → {end}
                  </div>
                </div>
              );
            }

            // 5) Fallback for any unknown types
            return (
              <div key={n.id} className={cardClass}>
                <div className="notifTitle">
                  {type || "Notification"} {isNew && <span>•</span>}
                </div>
                <div className="notifBody">
                  {JSON.stringify(n.payload)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
