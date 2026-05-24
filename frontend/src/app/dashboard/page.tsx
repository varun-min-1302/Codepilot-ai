"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { GitPullRequest, ShieldAlert, Cpu, CheckCircle2, ArrowRight, ExternalLink, Calendar, GitBranch, ShieldAlert as ShieldIcon, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PullRequest } from "@/types";

export default function Dashboard() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch PRs from API
  useEffect(() => {
    const fetchRecentPRs = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/prs/recent");
        if (res.ok) {
          const data = await res.json();
          setPrs(data);
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        console.warn("Backend API not reachable, falling back to offline mock mode.");
        setError(true);
        // Fallback to mock PRs
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
      } finally {
        setLoading(false);
      }
    };

    fetchRecentPRs();
    // Refresh dashboard list every 5 seconds to capture live simulator events
    const interval = setInterval(fetchRecentPRs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute stats
  const totalPRs = prs.length;
  const completedPRs = prs.filter(p => p.status === "completed").length;
  const pendingPRs = prs.filter(p => p.status === "pending" || p.status === "analyzing").length;

  return (
    <div className="flex bg-[#070709] min-h-screen text-zinc-200">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-h-screen">
        <Navbar title="Overview" subtitle="Metrics & recent pull request feeds" />

        <main className="p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Connected Repositories</span>
              <span className="text-xl font-bold text-white font-mono">1</span>
              <p className="text-[9px] text-zinc-500 font-mono">auth-service (Active)</p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Total PR Audits</span>
              <span className="text-xl font-bold text-white font-mono">{totalPRs}</span>
              <p className="text-[9px] text-zinc-500 font-mono">Webhook triggers captured</p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Average Security Score</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-red-400 font-mono">38%</span>
                <ShieldIcon className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-[9px] text-red-500/80 font-mono">2 Critical security issues</p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Performance Rating</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-yellow-500 font-mono">64%</span>
                <Cpu className="w-4 h-4 text-yellow-500" />
              </div>
              <p className="text-[9px] text-yellow-500/80 font-mono">Cubic time complexity issue</p>
            </div>
          </div>

          {/* Connected repos and live feed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* PR Listings (Left 8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Recent Pull Requests</h3>
                {loading && <span className="text-[10px] text-zinc-500 font-mono animate-pulse">Syncing...</span>}
              </div>

              {prs.length === 0 ? (
                <div className="border border-zinc-900 bg-zinc-950/20 rounded-xl p-10 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                    <GitPullRequest className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-zinc-200">No pull requests analyzed yet</h4>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-normal">
                      Trigger a webhook payload simulation using the sidebar to analyze files and view the live review stream.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {prs.map((pr) => (
                    <Link
                      key={pr.id}
                      href={`/pr/${pr.id}`}
                      className="border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-950/80 rounded-xl p-4 flex items-center justify-between transition-all group cursor-pointer border-l-2 border-l-zinc-800 hover:border-l-indigo-500"
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Status Icon */}
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

                        {/* PR details */}
                        <div className="flex flex-col gap-1">
                          <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors flex items-center gap-2">
                            <span>{pr.title}</span>
                            <span className="text-[10px] font-mono text-zinc-500 font-normal">#{pr.number}</span>
                          </h4>
                          
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                            <span className="text-zinc-400 font-medium">{pr.repo_owner}/{pr.repo_name}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              {pr.source_branch} → {pr.target_branch}
                            </span>
                            <span>·</span>
                            <span>by {pr.author}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Indicator */}
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col text-right">
                          {pr.status === "completed" && (
                            <span className="text-[10px] text-red-400 bg-red-950/30 border border-red-900/30 px-2 py-0.5 rounded font-mono font-medium">
                              Critical Findings
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
                
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200">auth-service</span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">codepilot-ai/auth-service</span>
                  </div>
                  <span className="text-[9px] bg-zinc-900 text-emerald-400 border border-emerald-950 rounded px-1.5 py-0.5 font-mono">
                    Connected
                  </span>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-4">
                <h3 className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase select-none">Recent Activity Log</h3>
                
                <div className="flex flex-col gap-4 text-xs">
                  {prs.map((pr) => (
                    <div key={`act-${pr.id}`} className="flex gap-3 relative pb-2 border-l border-zinc-900 pl-4 ml-2">
                      <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-300">
                          PR #{pr.number} status updated to <strong>{pr.status}</strong>
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
    </div>
  );
}
