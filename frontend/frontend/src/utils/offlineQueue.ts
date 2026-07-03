const QUEUE_KEY = "offline_attendance_queue";

export interface OfflineMarkPresent {
  id: string;
  employee_id: string;
  work_mode?: string;
  location?: Record<string, unknown>;
  created_at: string;
}

export function getOfflineQueue(): OfflineMarkPresent[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function enqueueMarkPresent(item: Omit<OfflineMarkPresent, "id" | "created_at">) {
  const queue = getOfflineQueue();
  queue.push({
    ...item,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function flushOfflineQueue(
  post: (body: Record<string, unknown>) => Promise<unknown>,
) {
  const queue = getOfflineQueue();
  if (!queue.length) return 0;
  const remaining: OfflineMarkPresent[] = [];
  let synced = 0;
  for (const item of queue) {
    try {
      await post({
        employee_id: item.employee_id,
        work_mode: item.work_mode,
        ...item.location,
      });
      synced += 1;
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return synced;
}
