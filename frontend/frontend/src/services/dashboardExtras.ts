import API from "./api";

export interface DashboardExtrasData {
  announcements: { id: string; title: string; body: string; created_by_name?: string }[];
  celebrations: {
    type: "birthday" | "anniversary" | "welcome";
    name: string;
    employee_id: string;
    department?: string;
    years?: number;
    profile_img?: string;
  }[];
  streak: { present_streak: number; on_time_streak: number; badge: string };
}

export async function fetchDashboardExtras(
  employeeId: string,
): Promise<DashboardExtrasData | null> {
  try {
    const res = await API.get("/employees/dashboard-extras/", {
      params: { employee_id: employeeId },
    });
    if (res.data.success) return res.data;
  } catch {
    /* silent */
  }
  return null;
}
