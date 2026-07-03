export interface AttendanceRecord {
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string;
  check_out: string;
  duration: string;
  status: string;
  minutes_late?: number;
  reason?: string;
  half_day_until?: string;
  profile_img?: string;
  cv_file?: string; 
}
