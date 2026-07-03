import type { Contact, OpenChat } from "./chatHelpers";

export type NotificationAction =
  | { type: "open_chat"; chat: OpenChat; contact?: Contact }
  | { type: "admin_leaves_tab" }
  | { type: "employee_leaves_modal" };

const EVENT = "app:notification-action";

export const dispatchNotificationAction = (action: NotificationAction) => {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: action }));
};

export const listenNotificationAction = (
  handler: (action: NotificationAction) => void,
) => {
  const listener = (event: Event) => {
    handler((event as CustomEvent<NotificationAction>).detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
