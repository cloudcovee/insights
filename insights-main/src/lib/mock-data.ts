// Deterministic mock analytics data (Zeroed out for live testing)

export type Kpi = {
  label: string;
  value: string;
  delta: number; // percent
  hint?: string;
};

export const kpis: Kpi[] = [
  { label: "Visitors", value: "0", delta: 0, hint: "vs last 30d" },
  { label: "Events", value: "0", delta: 0, hint: "vs last 30d" },
  { label: "Sessions", value: "0", delta: 0, hint: "vs last 30d" },
  { label: "Active users", value: "0", delta: 0, hint: "vs last 30d" },
  { label: "Returning users", value: "0%", delta: 0, hint: "vs last 30d" },
  { label: "Avg. session", value: "0m 0s", delta: 0, hint: "vs last 30d" },
];

function zeroSeries(days: number) {
  const out: { date: string; visitors: number; events: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      visitors: 0,
      events: 0,
    });
  }
  return out;
}

export const timeSeries30d = zeroSeries(30);
export const timeSeries7d = zeroSeries(7);

export const countries: { name: string; value: number; code: string }[] = [];

export const browsers: { name: string; value: number }[] = [];

export const devices: { name: string; value: number }[] = [];

export const os: { name: string; value: number }[] = [];

export const topEvents: { name: string; count: number }[] = [];

export const topPages: { path: string; views: number }[] = [];

export type EventRow = {
  id: string;
  timestamp: string;
  event: string;
  user: string;
  anonId: string;
  browser: string;
  country: string;
  device: string;
  metadata: string;
};

export const eventRows: EventRow[] = [];

export type UserRow = {
  id: string;
  name: string;
  email: string;
  firstSeen: string;
  lastSeen: string;
  events: number;
  country: string;
  browser: string;
  sessions: number;
};

export const userRows: UserRow[] = [];

export type SessionRow = {
  id: string;
  user: string;
  duration: string;
  pages: number;
  events: number;
  bounce: boolean;
  browser: string;
  country: string;
  startedAt: string;
};

export const sessionRows: SessionRow[] = [];

export const projects: any[] = [];

export const funnelSteps: any[] = [];

export const recentActivity = eventRows;
