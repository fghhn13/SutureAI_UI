/** Per-student dashboard payloads (mock). Report ids align with public/reports/catalog.json */

/** Served from `public/picture/` so `<img src>` always resolves (incl. subpath `base`). */
function publicAvatarUrl() {
  const base = import.meta.env.BASE_URL ?? "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}picture/avatar-placeholder.svg`;
}

const AVATAR_SRC = publicAvatarUrl();

/** Extra demo days so the heatmap looks populated (session count only—not scores). */
function buildDenseDemoDays(year, base) {
  const out = { ...base };
  let seed = year * 9973;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let month = 0; month < 12; month++) {
    for (let day = 1; day <= 27; day += 2) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (out[key]) continue;
      if (rnd() > 0.35) continue;
      const m = 14 + Math.floor(rnd() * 18);
      out[key] = {
        sessions: 1,
        tasks: ["Open practice"],
        totalMinutes: m,
        reportsReady: rnd() > 0.4 ? 1 : 0,
        records: [
          {
            taskName: "Open practice",
            score: 68 + Math.floor(rnd() * 14),
            reliability: "Medium",
            instructorStatus: rnd() > 0.5 ? "Pending" : "Confirmed",
            reportId: "report-default",
          },
        ],
      };
    }
  }
  return out;
}

const activityExplicit2026 = {
  "2026-04-25": {
    sessions: 2,
    tasks: ["Simple Suturing", "Knot Tying"],
    totalMinutes: 28,
    reportsReady: 2,
    records: [
      {
        taskName: "Simple Suturing",
        score: 78,
        reliability: "Medium",
        instructorStatus: "Pending",
        reportId: "report-default",
      },
      {
        taskName: "Knot Tying",
        score: 72,
        reliability: "High",
        instructorStatus: "Confirmed",
        reportId: "report-alt",
      },
    ],
  },
  "2026-04-21": {
    sessions: 1,
    tasks: ["Knot Tying"],
    totalMinutes: 14,
    reportsReady: 1,
    records: [
      {
        taskName: "Knot Tying",
        score: 72,
        reliability: "High",
        instructorStatus: "Confirmed",
        reportId: "report-alt",
      },
    ],
  },
  "2026-04-18": {
    sessions: 1,
    tasks: ["Needle Handling"],
    totalMinutes: 18,
    reportsReady: 1,
    records: [
      {
        taskName: "Needle Handling",
        score: 69,
        reliability: "Medium",
        instructorStatus: "Commented",
        reportId: "report-video-demo",
      },
    ],
  },
  "2026-03-30": {
    sessions: 3,
    tasks: ["Simple Suturing", "Knot Tying", "Warm-up"],
    totalMinutes: 42,
    reportsReady: 3,
    records: [
      {
        taskName: "Simple Suturing",
        score: 76,
        reliability: "Medium",
        instructorStatus: "Pending",
        reportId: "report-default",
      },
      {
        taskName: "Knot Tying",
        score: 74,
        reliability: "High",
        instructorStatus: "Confirmed",
        reportId: "report-alt",
      },
      {
        taskName: "Warm-up",
        score: 68,
        reliability: "Medium",
        instructorStatus: "Confirmed",
        reportId: "report-default",
      },
    ],
  },
  "2026-03-12": {
    sessions: 1,
    tasks: ["Simple Suturing"],
    totalMinutes: 16,
    reportsReady: 1,
    records: [
      {
        taskName: "Simple Suturing",
        score: 75,
        reliability: "Medium",
        instructorStatus: "Pending",
        reportId: "report-default",
      },
    ],
  },
  "2026-02-08": {
    sessions: 1,
    tasks: ["Needle Handling"],
    totalMinutes: 12,
    reportsReady: 1,
    records: [
      {
        taskName: "Needle Handling",
        score: 71,
        reliability: "Medium",
        instructorStatus: "Pending",
        reportId: "report-video-demo",
      },
    ],
  },
  "2026-01-20": {
    sessions: 2,
    tasks: ["Simple Suturing", "Knot Tying"],
    totalMinutes: 31,
    reportsReady: 2,
    records: [
      {
        taskName: "Simple Suturing",
        score: 74,
        reliability: "Medium",
        instructorStatus: "Pending",
        reportId: "report-default",
      },
      {
        taskName: "Knot Tying",
        score: 70,
        reliability: "High",
        instructorStatus: "Confirmed",
        reportId: "report-alt",
      },
    ],
  },
};

const activity2025Sparse = {
  "2025-11-08": {
    sessions: 1,
    tasks: ["Introduction drill"],
    totalMinutes: 10,
    reportsReady: 1,
    records: [
      {
        taskName: "Introduction drill",
        score: 65,
        reliability: "Medium",
        instructorStatus: "Confirmed",
        reportId: "report-default",
      },
    ],
  },
  "2025-09-14": {
    sessions: 2,
    tasks: ["Knot Tying", "Simple Suturing"],
    totalMinutes: 26,
    reportsReady: 2,
    records: [
      {
        taskName: "Knot Tying",
        score: 68,
        reliability: "Medium",
        instructorStatus: "Confirmed",
        reportId: "report-alt",
      },
      {
        taskName: "Simple Suturing",
        score: 71,
        reliability: "Medium",
        instructorStatus: "Pending",
        reportId: "report-default",
      },
    ],
  },
};

const alexDashboard = {
  profile: {
    avatarSrc: AVATAR_SRC,
  },
  studentName: "Alex Rivera",
  courseName: "Fundamentals of Simulated Suturing",
  trainingFocus: "Insertion control and consistent stitch spacing",

  currentTask: {
    name: "Simple Suturing Practice",
    status: "In progress",
    dueDate: "May 15, 2026",
    estimatedDuration: "15–20 min",
    dimensions: ["Efficiency", "Accuracy", "Procedural Flow", "Safety", "Product Quality"],
  },

  lastReportLinkReportId: "report-default",

  lastReport: {
    taskName: "Simple Suturing Practice",
    score: 78,
    reliability: "Medium Confidence",
    mainStrength: "Procedural Flow improved",
    mainIssue: "Repeated needle insertion attempts",
    instructorStatus: "Waiting for instructor review",
  },

  trends: {
    sessionsCount: 6,
    scoreChange: "+8 pts this month",
    completionTime: "132s → 118s",
    errorCount: "5 → 2",
    weakestDimension: "Accuracy",
  },

  nextSteps: [
    "Reduce repeated insertion attempts",
    "Keep stitch spacing more consistent",
    "Review the needle positioning step before recording again",
  ],

  notifications: [
    "Your instructor has not reviewed the latest report yet.",
    "New suturing task assigned.",
    "One report is ready to view.",
  ],

  history: [
    {
      date: "Apr 25",
      task: "Simple Suturing",
      score: 78,
      reliability: "Medium",
      instructorStatus: "Pending",
      reportId: "report-default",
    },
    {
      date: "Apr 21",
      task: "Knot Tying",
      score: 72,
      reliability: "High",
      instructorStatus: "Confirmed",
      reportId: "report-alt",
    },
    {
      date: "Apr 18",
      task: "Needle Handling",
      score: 69,
      reliability: "Medium",
      instructorStatus: "Commented",
      reportId: "report-video-demo",
    },
  ],

  trainingActivityCalendar: {
    years: [2026, 2025],
    defaultYear: 2026,
    activityByDate: {
      ...buildDenseDemoDays(2026, activityExplicit2026),
      ...buildDenseDemoDays(2025, activity2025Sparse),
    },
  },
};

const jordanActivity2026 = {
  "2026-05-03": {
    sessions: 1,
    tasks: ["Knot Tying"],
    totalMinutes: 14,
    reportsReady: 1,
    records: [
      {
        taskName: "Knot Tying",
        score: 66,
        reliability: "Medium",
        instructorStatus: "Pending",
        reportId: "report-default",
      },
    ],
  },
  "2026-03-18": {
    sessions: 2,
    tasks: ["Simple Suturing", "Warm-up"],
    totalMinutes: 22,
    reportsReady: 1,
    records: [
      {
        taskName: "Simple Suturing",
        score: 70,
        reliability: "Medium",
        instructorStatus: "Confirmed",
        reportId: "report-alt",
      },
      {
        taskName: "Warm-up",
        score: 62,
        reliability: "Medium",
        instructorStatus: "Confirmed",
        reportId: "report-default",
      },
    ],
  },
};

const jordanActivity2025 = {
  "2025-10-05": {
    sessions: 1,
    tasks: ["Introduction drill"],
    totalMinutes: 11,
    reportsReady: 1,
    records: [
      {
        taskName: "Introduction drill",
        score: 63,
        reliability: "Medium",
        instructorStatus: "Confirmed",
        reportId: "report-default",
      },
    ],
  },
};

/** Sparse second-account demo (smaller history / calendar). */
const jordanDashboard = {
  profile: {
    avatarSrc: AVATAR_SRC,
  },
  studentName: "Jordan Kim",
  courseName: "Introductory Simulated Suturing Lab",
  trainingFocus: "Knot security and steady needle orientation",

  currentTask: {
    name: "Knot Tying Basics",
    status: "Not started",
    dueDate: "May 20, 2026",
    estimatedDuration: "12–18 min",
    dimensions: ["Accuracy", "Procedural Flow", "Safety"],
  },

  lastReportLinkReportId: "report-alt",

  lastReport: {
    taskName: "Simple Suturing",
    score: 70,
    reliability: "Medium Confidence",
    mainStrength: "Consistent pacing",
    mainIssue: "Needle angle variability",
    instructorStatus: "Not yet reviewed",
  },

  trends: {
    sessionsCount: 3,
    scoreChange: "+4 pts this month",
    completionTime: "148s → 135s",
    errorCount: "4 → 3",
    weakestDimension: "Accuracy",
  },

  nextSteps: [
    "Practice square knots before recording",
    "Watch the demo clip on needle entry angle",
  ],

  notifications: ["Welcome back — one practice session is scheduled this week."],

  history: [
    {
      date: "Mar 18",
      task: "Simple Suturing",
      score: 70,
      reliability: "Medium",
      instructorStatus: "Confirmed",
      reportId: "report-alt",
    },
    {
      date: "May 3",
      task: "Knot Tying",
      score: 66,
      reliability: "Medium",
      instructorStatus: "Pending",
      reportId: "report-default",
    },
  ],

  trainingActivityCalendar: {
    years: [2026, 2025],
    defaultYear: 2026,
    activityByDate: {
      ...jordanActivity2026,
      ...jordanActivity2025,
    },
  },
};

const studentsById = {
  alex: alexDashboard,
  jordan: jordanDashboard,
};

export const STUDENT_IDS = ["alex", "jordan"];

/**
 * Resolve dashboard mock for a student. Swap implementation for `fetch('/api/me/dashboard')` later.
 * @param {string} userId
 */
export function getStudentDashboard(userId) {
  const payload = studentsById[userId];
  if (payload) return payload;
  if (import.meta.env.DEV) {
    console.warn(`getStudentDashboard: unknown userId "${userId}", falling back to alex`);
  }
  return alexDashboard;
}

/** @deprecated Prefer getStudentDashboard('alex') */
export const studentDashboardMock = alexDashboard;
