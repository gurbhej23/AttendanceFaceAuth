# Advance Leave Feature Documentation

## Overview
Employees can now request leave for a single date or a date range in advance. The system will create individual leave records for each day in the requested range.

---

## Backend Changes

### Endpoint: `/attendance/request-leave/` (POST)

#### Request Payload
```json
{
  "employee_id": "EMP-2024-0001",
  "reason": "Family vacation",
  "leave_date": "2024-12-20",
  "leave_end_date": "2024-12-25",
  "leave_type": "casual"
}
```

#### Parameters
- `employee_id` (required): Employee identifier
- `reason` (required): Reason for leave
- `leave_date` (required): Leave start date (YYYY-MM-DD format)
- `leave_end_date` (optional): Leave end date (YYYY-MM-DD format). Defaults to `leave_date` if not provided
- `leave_type` (optional): "casual", "sick", or "emergency" (default: "casual")

#### Logic
1. Validates date format and that end_date ≥ start_date
2. Checks for conflicts (no existing attendance records for requested dates)
3. Creates one `AttendanceRecord` per day with status `leave_pending`
4. Returns list of all requested dates

#### Response
```json
{
  "success": true,
  "message": "Leave requested from 2024-12-20 to 2024-12-25. Awaiting admin approval.",
  "requested_dates": [
    "2024-12-20",
    "2024-12-21",
    "2024-12-22",
    "2024-12-23",
    "2024-12-24",
    "2024-12-25"
  ]
}
```

#### Error Cases
- Invalid date format → 400
- End date < Start date → 400
- Attendance already marked for any date in range → 400
- Employee not found → 404
- Server error → 500

---

## Frontend Changes

### Leave Request Modal

#### New Fields
1. **Leave Start Date** (date input)
   - Minimum: today
   - Populated with current date by default

2. **Leave End Date** (date input)
   - Minimum: same as leave start date
   - Auto-updates if start date changes to ensure end ≥ start
   - Populated with start date by default for single-day requests

#### User Flow
1. Employee clicks "Leaves" button on dashboard
2. Modal opens with leave start date pre-filled to today
3. Employee selects leave end date (can be same day for single-day leave)
4. Selects leave type (Casual, Sick, Emergency)
5. Enters reason
6. Clicks "Submit Request"
7. System validates and sends request to backend
8. On success:
   - Modal closes
   - Success message displayed
   - Leave list refreshes
   - Employee sees all requested dates with "Pending" status

#### Validation
- Both dates required
- End date cannot be before start date
- Reason must not be empty
- System prevents marking attendance for requested dates

---

## Database Schema Update

### AttendanceRecord
- No schema changes required (already supports `leave_type`, `leave_end_date` can be optionally stored)
- Each day in a range gets its own record with:
  - `status`: "leave_pending"
  - `reason`: shared reason for all days
  - `leave_type`: shared leave type for all days
  - `date`: individual date for that day

---

## Example Workflows

### Single Day Leave (Same as before)
```
User selects: 2024-12-20 (start) → 2024-12-20 (end)
System creates: 1 record for 2024-12-20
Status shown: "Leave for 2024-12-20 - Pending"
```

### Multi-Day Advance Leave (NEW)
```
User selects: 2024-12-20 (start) → 2024-12-25 (end)
System creates: 6 records (one per day)
  - 2024-12-20 → leave_pending
  - 2024-12-21 → leave_pending
  - 2024-12-22 → leave_pending
  - 2024-12-23 → leave_pending
  - 2024-12-24 → leave_pending
  - 2024-12-25 → leave_pending
Status shown: "Leave from 2024-12-20 to 2024-12-25 - Pending"
```

### Admin Approval
When admin approves a leave request from the admin panel, they approve **any single record**. Each day's record is independent and can be:
- Approved → status = "leave_approved"
- Rejected → status = "leave_rejected"

**Note:** For multi-day leaves, admin must approve/reject each day individually (or bulk action can be added later).

---

## API Testing with cURL

### Single Day Leave
```bash
curl -X POST http://localhost:8000/api/attendance/request-leave/ \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP-2024-0001",
    "reason": "Medical checkup",
    "leave_date": "2024-12-20",
    "leave_type": "sick"
  }'
```

### Multi-Day Leave
```bash
curl -X POST http://localhost:8000/api/attendance/request-leave/ \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP-2024-0001",
    "reason": "Family vacation",
    "leave_date": "2024-12-20",
    "leave_end_date": "2024-12-25",
    "leave_type": "casual"
  }'
```

---

## Future Enhancements

1. **Bulk Approval**: Allow admin to approve/reject all days of a leave request at once
2. **Leave Balance**: Track leave quotas per employee (e.g., 10 casual leaves/year)
3. **Overlapping Leave Check**: Prevent overlapping leave requests from the same employee
4. **Leave History**: Show approved/rejected leaves in employee dashboard
5. **Export**: Export leave requests to CSV/PDF for HR records
6. **Notifications**: Email notifications for leave approval/rejection
7. **Leave Type Rules**: Different quotas for casual, sick, emergency leaves

---

## Files Modified

1. `backend/attendance/views.py`
   - Updated `request_leave()` function

2. `frontend/frontend/src/pages/Dashboard.tsx`
   - Added `leaveEndDate` state
   - Updated `requestLeave()` function
   - Updated leave modal UI with end date field

---

## Testing Checklist

- [ ] Single day leave request (start = end)
- [ ] Multi-day leave request (start < end)
- [ ] Leave end date before start date (should error)
- [ ] Invalid date format (should error)
- [ ] Conflicting attendance (should error)
- [ ] Admin approval/rejection of individual days
- [ ] My leave requests shows all days
- [ ] Attendance sheet shows leave status for all days
