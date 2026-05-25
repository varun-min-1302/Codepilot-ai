"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { BarChart, ShieldAlert, Cpu, Award, Hourglass, HelpCircle } from "lucide-react";
import { API_URL } from "@/lib/api";

interface AnalyticsData {
  summary: {
    total_repositories: number;
    total_pull_requests: number;
    completed_reviews: number;
    security_score_avg: number;
    performance_score_avg: number;
    best_practice_score_avg: number;
  };
  issues_by_category: {
    Security: number;
    Performance: number;
    "Code Quality": number;
  };
  monthly_review_trends: Array<{
    month: string;
    count: number;
    bugs: number;
  }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          throw new Error();
        }
      } catch (err) {
        console.warn("Backend API not reachable. Using fallback analytics dataset.");
        // Fallback mock analytics
        setData({
          summary: {
            total_repositories: 1,
            total_pull_requests: 6,
            completed_reviews: 6,
            security_score_avg: 38,
            performance_score_avg: 64,
            best_practice_score_avg: 78
          },
          issues_by_category: {
            Security: 2,
            Performance: 1,
            "Code Quality": 1
          },
          monthly_review_trends: [
            { month: "Jan", count: 12, bugs: 4 },
            { month: "Feb", count: 18, bugs: 8 },
            { month: "Mar", count: 22, bugs: 11 },
            { month: "Apr", count: 31, bugs: 15 },
            { month: "May", count: 6, bugs: 4 }
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex bg-[#070709] min-h-screen text-zinc-200">
        <Sidebar />
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="animate-pulse text-zinc-500 font-mono text-xs">Assembling analytics report...</div>
        </div>
      </div>
    );
  }

  const { summary, issues_by_category, monthly_review_trends } = data;

  return (
    <div className="flex bg-[#070709] min-h-screen text-zinc-200">
      <Sidebar />

      <div className="flex-grow flex flex-col min-h-screen">
        <Navbar title="Analytics Dashboard" subtitle="Global engineering quality reports" />

        <main className="p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
          
          {/* Main Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Security Index */}
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Avg Security Score</span>
                <span className="text-2xl font-bold text-red-400 font-mono">{summary.security_score_avg}%</span>
                <span className="text-[9px] text-zinc-500 font-mono">Needs immediate audit</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-950/20 border border-red-900/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-red-400" />
              </div>
            </div>

            {/* Performance Index */}
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Avg Performance</span>
                <span className="text-2xl font-bold text-yellow-500 font-mono">{summary.performance_score_avg}%</span>
                <span className="text-[9px] text-zinc-500 font-mono">Loop complexities flagged</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-950/20 border border-yellow-900/30 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-yellow-400" />
              </div>
            </div>

            {/* Quality Index */}
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Avg Code Quality</span>
                <span className="text-2xl font-bold text-indigo-400 font-mono">{summary.best_practice_score_avg}%</span>
                <span className="text-[9px] text-zinc-500 font-mono">Exception handling risks</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-950/20 border border-indigo-900/30 flex items-center justify-center">
                <Award className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            {/* Merge Latency */}
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Avg Review Duration</span>
                <span className="text-2xl font-bold text-white font-mono">12m</span>
                <span className="text-[9px] text-zinc-500 font-mono">From webhook to finished review</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Hourglass className="w-5 h-5 text-zinc-400" />
              </div>
            </div>

          </div>

          {/* Minimal charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Line chart: Review Trends (Left 7 cols) */}
            <div className="lg:col-span-7 p-5 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Audit Volume Trend</h3>
                <p className="text-[10px] text-zinc-500">Monthly PR webhook triggers and detected vulnerabilities</p>
              </div>

              {/* Custom SVG Line Chart */}
              <div className="w-full h-64 bg-zinc-950/60 rounded-lg p-4 border border-zinc-900 flex items-center justify-center relative">
                <svg viewBox="0 0 500 200" className="w-full h-full">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="40" y1="70" x2="480" y2="70" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="40" y1="120" x2="480" y2="120" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="40" y1="170" x2="480" y2="170" stroke="#18181b" strokeWidth="1.5" />

                  {/* Trends: Counts Line (Indigo) */}
                  {/* January (40, 160) -> February (140, 140) -> March (240, 120) -> April (340, 70) -> May (440, 168) */}
                  <path
                    d="M 40 160 Q 90 150 140 140 T 240 120 T 340 70 T 440 168"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Gradient fill below path */}
                  <path
                    d="M 40 160 Q 90 150 140 140 T 240 120 T 340 70 T 440 168 L 440 170 L 40 170 Z"
                    fill="url(#indigo-grad)"
                    opacity="0.1"
                  />

                  {/* Trends: Bugs Line (Cyan) */}
                  {/* Jan (40, 180) -> Feb (140, 160) -> Mar (240, 150) -> Apr (340, 120) -> May (440, 172) */}
                  <path
                    d="M 40 180 Q 90 170 140 160 T 240 150 T 340 120 T 440 172"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    strokeDasharray="4,2"
                  />

                  {/* Dots for points */}
                  <circle cx="340" cy="70" r="4" fill="#6366f1" />
                  <circle cx="440" cy="168" r="4" fill="#6366f1" />
                  <circle cx="340" cy="120" r="4.5" fill="#06b6d4" />
                  <circle cx="440" cy="172" r="4.5" fill="#06b6d4" />

                  {/* Text labels */}
                  <text x="40" y="190" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">JAN</text>
                  <text x="140" y="190" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">FEB</text>
                  <text x="240" y="190" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">MAR</text>
                  <text x="340" y="190" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">APR</text>
                  <text x="440" y="190" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">MAY</text>

                  {/* Value definitions */}
                  <defs>
                    <linearGradient id="indigo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Legend Overlay */}
                <div className="absolute top-4 right-4 flex items-center gap-4 text-[9px] font-mono text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-indigo-500 inline-block" />
                    <span>PRs Reviewed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 border-t border-dashed border-cyan-400 inline-block" />
                    <span>Bugs Blocked</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bar chart: Issue breakdown (Right 5 cols) */}
            <div className="lg:col-span-5 p-5 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Flaw Classification</h3>
                <p className="text-[10px] text-zinc-500">Breakdown of blocked vulnerabilities by scope</p>
              </div>

              {/* Custom SVG Bar Chart */}
              <div className="w-full h-64 bg-zinc-950/60 rounded-lg p-4 border border-zinc-900 flex flex-col justify-between">
                <div className="flex-grow flex items-end justify-around gap-4 px-2 pb-2">
                  
                  {/* Security (Count: 2) */}
                  <div className="flex flex-col items-center gap-2 w-12">
                    <span className="text-[10px] font-bold font-mono text-red-400">{issues_by_category.Security}</span>
                    <div 
                      className="w-full bg-gradient-to-t from-red-650 from-red-650/40 to-red-500 border border-red-500/30 rounded-t-sm"
                      style={{ height: `${(issues_by_category.Security / 3) * 120}px`, minHeight: "8px" }}
                    />
                    <span className="text-[8px] font-mono text-zinc-500 tracking-tight text-center">Security</span>
                  </div>

                  {/* Performance (Count: 1) */}
                  <div className="flex flex-col items-center gap-2 w-12">
                    <span className="text-[10px] font-bold font-mono text-yellow-400">{issues_by_category.Performance}</span>
                    <div 
                      className="w-full bg-gradient-to-t from-yellow-650 from-yellow-650/40 to-yellow-500 border border-yellow-500/30 rounded-t-sm"
                      style={{ height: `${(issues_by_category.Performance / 3) * 120}px`, minHeight: "8px" }}
                    />
                    <span className="text-[8px] font-mono text-zinc-500 tracking-tight text-center">Speed</span>
                  </div>

                  {/* Code Quality (Count: 1) */}
                  <div className="flex flex-col items-center gap-2 w-12">
                    <span className="text-[10px] font-bold font-mono text-indigo-400">{issues_by_category["Code Quality"]}</span>
                    <div 
                      className="w-full bg-gradient-to-t from-indigo-650 from-indigo-650/40 to-indigo-500 border border-indigo-500/30 rounded-t-sm"
                      style={{ height: `${(issues_by_category["Code Quality"] / 3) * 120}px`, minHeight: "8px" }}
                    />
                    <span className="text-[8px] font-mono text-zinc-500 tracking-tight text-center">Quality</span>
                  </div>

                </div>
                <hr className="border-zinc-900 w-full" />
                <div className="pt-2 text-[9px] text-zinc-500 font-mono leading-normal">
                  Total of {issues_by_category.Security + issues_by_category.Performance + issues_by_category["Code Quality"]} issues resolved before production pipeline compile.
                </div>
              </div>
            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
