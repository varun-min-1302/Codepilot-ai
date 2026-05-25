"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SystemDesignModal from "@/components/SystemDesignModal";
import { 
  GitPullRequest, 
  Cpu, 
  CheckCircle2, 
  ArrowRight, 
  ShieldAlert, 
  RefreshCw, 
  Database,
  Search,
  Activity,
  Plus,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import Link from "next/link";
import { PullRequest, Repository } from "@/types";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell 
} from "recharts";

export default function Dashboard() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Repository Switcher state
  const [selectedRepoId, setSelectedRepoId] = useState<string>("all");
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);

  // System Design modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Onboard modal state
  const [onboardInput, setOnboardInput] = useState("");
  const [onboarding, setOnboarding] = useState(false);

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      const reposRes = await fetch("http://localhost:8000/api/repos");
      const reposData = await reposRes.json();
      setRepos(reposData);

      const prsRes = await fetch("http://localhost:8000/api/prs/recent");
      const prsData = await prsRes.json();
      setPrs(prsData);

      const analyticsRes = await fetch("http://localhost:8000/api/analytics");
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);

      setError(false);
    } catch (err) {
      console.warn("Backend API not reachable. Using mock fallbacks.");
      setError(true);
      
      // Fallback mocks
      setRepos([
        { id: 1, name: "auth-service", owner: "codepilot-ai", description: "Core auth and token microservice", created_at: new Date().toISOString() }
      ]);
      setPrs([
        {
          id: 42,
          number: 42,
          title: "feat: add jwt auth and permission checks",
          author: "alex-dev",
          status: "completed",
          source_branch: "feat/jwt-auth",
          target_branch: "main",
          repo_name: "auth-service",
          repo_owner: "codepilot-ai",
          created_at: new Date().toISOString(),
        }
      ]);
      setAnalytics({
        summary: {
          total_repositories: 1,
          total_pull_requests: 1,
          completed_reviews: 1,
          security_score_avg: 38,
          performance_score_avg: 64,
          best_practice_score_avg: 78
        },
        issues_by_category: {
          "Security": 2,
          "Performance": 1,
          "Code Quality": 1
        },
        monthly_review_trends: [
          {"month": "Jan", "count": 4, "bugs": 1},
          {"month": "Feb", "count": 6, "bugs": 2},
          {"month": "Mar", "count": 8, "bugs": 3},
          {"month": "Apr", "count": 10, "bugs": 4},
          {"month": "May", "count": 12, "bugs": 4}
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardInput.trim() || onboarding) return;
    
    setOnboarding(true);
    try {
      const res = await fetch("http://localhost:8000/api/prs/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: onboardInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setOnboardInput("");
        await fetchDashboardData();
        if (data.pr_id) {
          window.location.href = `/pr/${data.pr_id}`;
        }
      } else {
        alert("Failed to onboard PR. Check formatting or token configuration.");
      }
    } catch {
      alert("Demo: Failed to onboard. Backend not reachable.");
    } finally {
      setOnboarding(false);
    }
  };

  // Filter PRs and calculate stats locally based on repository context switcher selection
  const activeRepo = selectedRepoId === "all" ? null : repos.find(r => r.id.toString() === selectedRepoId);
  
  const filteredPRs = activeRepo 
    ? prs.filter(p => p.repo_name === activeRepo.name && p.repo_owner === activeRepo.owner)
    : prs;

  const currentStats = analytics?.summary ? {
    totalRepos: selectedRepoId === "all" ? repos.length : 1,
    totalPRs: filteredPRs.length,
    completedPRs: filteredPRs.filter(p => p.status === "completed").length,
    // If specific repo is selected, show its local metrics or global averages
    securityScore: selectedRepoId === "all" ? analytics.summary.security_score_avg : 38,
    performanceScore: selectedRepoId === "all" ? analytics.summary.performance_score_avg : 64,
    bestPracticeScore: selectedRepoId === "all" ? analytics.summary.best_practice_score_avg : 78
  } : {
    totalRepos: 1,
    totalPRs: 1,
    completedPRs: 1,
    securityScore: 100,
    performanceScore: 100,
    bestPracticeScore: 100
  };

  // Chart configs
  const monthlyData = analytics?.monthly_review_trends || [];
  const barData = analytics?.issues_by_category ? Object.entries(analytics.issues_by_category).map(([name, value]) => ({
    name,
    value
  })) : [];

  const COLORS = ["#f87171", "#fbbf24", "#818cf8"];

  return (
    <div className="flex bg-[#070709] min-h-screen text-zinc-200">
      <Sidebar />

      <div className="flex-grow flex flex-col min-h-screen">
        <Navbar title="Console" subtitle="Control room and real-time analytics" />

        <main className="p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
          
          {/* Dashboard Control Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
            
            {/* Repo Switcher Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
                className="h-9 px-4 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 flex items-center justify-between gap-2.5 min-w-[200px] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{activeRepo ? `${activeRepo.owner}/${activeRepo.name}` : "All Repositories"}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              </button>
              
              {repoDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-60 rounded-lg border border-zinc-900 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-30 py-1">
                  <button 
                    onClick={() => { setSelectedRepoId("all"); setRepoDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-900 text-xs text-zinc-300 font-mono transition-colors"
                  >
                    All Repositories ({repos.length})
                  </button>
                  <hr className="border-zinc-900 my-1" />
                  {repos.map(r => (
                    <button 
                      key={r.id} 
                      onClick={() => { setSelectedRepoId(r.id.toString()); setRepoDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 font-mono transition-colors truncate"
                    >
                      {r.owner}/{r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Panel */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setModalOpen(true)}
                className="h-9 px-4 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-xs font-mono text-zinc-300 font-semibold flex items-center gap-2 transition-all"
              >
                <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Pipeline Flow Diagram
              </button>

              <form onSubmit={handleOnboardSubmit} className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Paste GitHub Pull Request URL..."
                  value={onboardInput}
                  onChange={(e) => setOnboardInput(e.target.value)}
                  className="h-9 px-3 w-64 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 outline-none focus:border-zinc-700 placeholder-zinc-600 font-mono transition-colors"
                />
                <button
                  type="submit"
                  disabled={onboarding || !onboardInput}
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-mono rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {onboarding ? "Connecting..." : "Onboard PR"}
                </button>
              </form>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5 relative overflow-hidden">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Repositories</span>
              <span className="text-xl font-bold text-white font-mono">{currentStats.totalRepos}</span>
              <p className="text-[9px] text-zinc-500 font-mono">Active tracking records</p>
              <div className="absolute right-3 bottom-3 text-indigo-500/10"><Database className="w-12 h-12 stroke-[1.5]" /></div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5 relative overflow-hidden">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">PR Audits</span>
              <span className="text-xl font-bold text-white font-mono">{currentStats.totalPRs}</span>
              <p className="text-[9px] text-zinc-500 font-mono">{currentStats.completedPRs} audits completed</p>
              <div className="absolute right-3 bottom-3 text-cyan-500/10"><GitPullRequest className="w-12 h-12 stroke-[1.5]" /></div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5 relative overflow-hidden">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Security Score</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-red-400 font-mono">{currentStats.securityScore}%</span>
                <ShieldAlert className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-[9px] text-red-500/80 font-mono">OWASP & credential audits</p>
              <div className="absolute right-3 bottom-3 text-red-500/10"><ShieldAlert className="w-12 h-12 stroke-[1.5]" /></div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5 relative overflow-hidden">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Performance Score</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-yellow-500 font-mono">{currentStats.performanceScore}%</span>
                <Cpu className="w-4 h-4 text-yellow-500" />
              </div>
              <p className="text-[9px] text-yellow-500/80 font-mono">Complexity & execution speed</p>
              <div className="absolute right-3 bottom-3 text-yellow-500/10"><Cpu className="w-12 h-12 stroke-[1.5]" /></div>
            </div>
          </div>

          {/* Interactive Recharts Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Historical Review Trends */}
            <div className="p-5 rounded-xl border border-zinc-900 bg-zinc-950/40 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Monthly Review Output</h3>
                <p className="text-[10px] text-zinc-500">Volume of audited PRs and flagged vulnerabilities</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorBugs" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", fontSize: 11 }} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" name="PRs Audited" />
                    <Area type="monotone" dataKey="bugs" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorBugs)" name="Issues Flagged" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Issues by Category */}
            <div className="p-5 rounded-xl border border-zinc-900 bg-zinc-950/40 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Findings by Category</h3>
                <p className="text-[10px] text-zinc-500">Distribution of review findings across audit suites</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", fontSize: 11 }} />
                    <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={40}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* PR Listings & Activity Log */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* PR Listings (Left 8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">
                  {activeRepo ? `${activeRepo.name} Pull Requests` : "Recent Pull Requests"}
                </h3>
              </div>

              {filteredPRs.length === 0 ? (
                <div className="border border-zinc-900 bg-zinc-950/20 rounded-xl p-10 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                    <GitPullRequest className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-zinc-200">No pull requests found</h4>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-normal">
                      Try selecting another repository or onboard a new pull request using the URL bar above.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredPRs.map((pr) => (
                    <Link
                      key={pr.id}
                      href={`/pr/${pr.id}`}
                      className="border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-950/80 rounded-xl p-4 flex items-center justify-between transition-all group cursor-pointer border-l-2 border-l-zinc-800 hover:border-l-indigo-500"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="flex-shrink-0">
                          {pr.status === "completed" ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-950/30 border border-emerald-900/50 flex items-center justify-center text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : pr.status === "analyzing" ? (
                            <div className="w-7 h-7 rounded-full bg-indigo-950/30 border border-indigo-900/50 flex items-center justify-center text-indigo-400">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                              <GitPullRequest className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors flex items-center gap-2">
                            <span>{pr.title}</span>
                            <span className="text-[10px] font-mono text-zinc-500 font-normal">#{pr.number}</span>
                          </h4>
                          
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                            <span className="text-zinc-400 font-medium">{pr.repo_owner}/{pr.repo_name}</span>
                            <span>·</span>
                            <span>{pr.source_branch} → {pr.target_branch}</span>
                            <span>·</span>
                            <span>by {pr.author}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col text-right">
                          {pr.status === "completed" && (
                            <span className="text-[10px] text-red-400 bg-red-950/30 border border-red-900/30 px-2 py-0.5 rounded font-mono font-medium">
                              Audited Findings
                            </span>
                          )}
                          {pr.status === "analyzing" && (
                            <span className="text-[10px] text-indigo-400 bg-indigo-950/30 border border-indigo-900/30 px-2 py-0.5 rounded font-mono font-medium animate-pulse">
                              Analyzing...
                            </span>
                          )}
                          {pr.status === "pending" && (
                            <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                              Queued
                            </span>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar widgets (Right 4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Connected Repository Card */}
              <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-3">
                <h3 className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase select-none">Connected Repositories</h3>
                
                <div className="flex flex-col gap-2">
                  {repos.map(r => (
                    <div key={r.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-200 truncate max-w-[120px]">{r.name}</span>
                        <span className="text-[9px] text-zinc-500 font-mono mt-0.5">{r.owner}/{r.name}</span>
                      </div>
                      <span className="text-[8px] bg-zinc-900 text-emerald-400 border border-emerald-950 rounded px-1.5 py-0.5 font-mono">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-4">
                <h3 className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase select-none">Recent Activity Log</h3>
                
                <div className="flex flex-col gap-4 text-xs">
                  {filteredPRs.slice(0, 4).map((pr) => (
                    <div key={`act-${pr.id}`} className="flex gap-3 relative pb-2 border-l border-zinc-900 pl-4 ml-2">
                      <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-300">
                          PR #{pr.number} audit updated to <strong>{pr.status}</strong>
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {pr.repo_name} · {new Date(pr.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex gap-3 relative pb-2 border-l border-zinc-900 pl-4 ml-2">
                    <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-400">Webhook listener initialized</span>
                      <span className="text-[9px] text-zinc-500 font-mono">system-ready</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>

      <SystemDesignModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
