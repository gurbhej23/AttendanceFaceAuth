export const DEPARTMENTS = [
  "IT",
  "HR",
  "Finance",
  "Operations",
  "Sales",
  "Marketing",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_JOB_ROLES: Record<string, string[]> = {
  IT: [
    "Software Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "DevOps Engineer",
    "QA Engineer",
    "UI/UX Designer",
    "Project Manager",
    "Team Lead",
    "Intern",
  ],
  HR: [
    "HR Executive",
    "HR Manager",
    "Recruiter",
    "Talent Acquisition Specialist",
    "Intern",
  ],
  Finance: [
    "Accountant",
    "Financial Analyst",
    "Finance Manager",
    "Accounts Executive",
    "Intern",
  ],
  Operations: [
    "Operations Executive",
    "Operations Manager",
    "Logistics Coordinator",
    "Admin Executive",
    "Intern",
  ],
  Sales: [
    "Sales Executive",
    "Sales Manager",
    "Business Development Executive",
    "Account Manager",
    "Intern",
  ],
  Marketing: [
    "Marketing Executive",
    "Marketing Manager",
    "Content Writer",
    "Social Media Manager",
    "Digital Marketing Specialist",
    "Intern",
  ],
  General: ["Executive", "Manager", "Intern"],
};

const DEFAULT_DEPARTMENT = "IT";

export function getJobRolesForDepartment(
  department: string,
  currentRole?: string,
): string[] {
  const roles = [
    ...(DEPARTMENT_JOB_ROLES[department] ??
      DEPARTMENT_JOB_ROLES[DEFAULT_DEPARTMENT]),
  ];
  if (currentRole && !roles.includes(currentRole)) {
    roles.unshift(currentRole);
  }
  return roles;
}

export function pickDesignationForDepartment(
  department: string,
  currentDesignation: string,
): string {
  const roles = getJobRolesForDepartment(department);
  if (roles.includes(currentDesignation)) return currentDesignation;
  return roles[0] ?? "";
}

export const ALL_JOB_ROLES = Array.from(
  new Set(Object.values(DEPARTMENT_JOB_ROLES).flat()),
).sort();
