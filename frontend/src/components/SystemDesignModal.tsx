"use client";

import { X, Server, Database, Brain, GitPullRequest, ArrowRight, Activity } from "lucide-react";
import { motion } from "framer-motion";

interface SystemDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SystemDesignModal({ isOpen, onClose }: SystemDesignModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl overflow-hidden glass-panel rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-zinc-100 font-mono">CodePilot AI Reviewer Architecture Flow</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl font-sans">
            Here is the complete engineering workflow of the <strong>CodePilot AI</strong> platform. 
            The system acts as a real-time auditor, combining webhooks, dynamic fetching, persistent database caching, LLM reasoning, and server-sent streaming to deliver immediate code analysis.
          </p>

          {/* Interactive SVG Flow Diagram */}
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px] overflow-x-auto relative">
            <svg viewBox="0 0 800 240" className="w-full min-w-[700px] text-zinc-300 font-mono text-[10px]">
              {/* Definitions for Glow/Gradients */}
              <defs>
                <linearGradient id="flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Node 1: GitHub Webhook */}
              <g transform="translate(10, 80)">
                <rect width="120" height="60" rx="8" className="fill-zinc-900 stroke-zinc-800" strokeWidth="1.5" />
                <rect width="120" height="60" rx="8" className="fill-none stroke-indigo-500/30" strokeWidth="3" />
                <text x="60" y="25" textAnchor="middle" fill="#a1a1aa" fontWeight="bold">GitHub</text>
                <text x="60" y="40" textAnchor="middle" fill="#818cf8">Webhook Event</text>
              </g>

              {/* Connector 1 -> 2 */}
              <path d="M 130 110 L 200 110" className="stroke-zinc-800" strokeWidth="2" fill="none" />
              <polygon points="200,110 192,106 192,114" className="fill-zinc-800" />
              <circle cx="165" cy="110" r="3" className="fill-indigo-500" filter="url(#glow)">
                <animate attributeName="cx" from="130" to="200" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Node 2: FastAPI Server */}
              <g transform="translate(210, 80)">
                <rect width="130" height="60" rx="8" className="fill-zinc-900 stroke-zinc-800" strokeWidth="1.5" />
                <rect width="130" height="60" rx="8" className="fill-none stroke-indigo-500/30" strokeWidth="3" />
                <text x="65" y="25" textAnchor="middle" fill="#a1a1aa" fontWeight="bold">FastAPI Server</text>
                <text x="65" y="40" textAnchor="middle" fill="#38bdf8">Endpoint Handler</text>
              </g>

              {/* Connector 2 -> 3 (GitHub REST API Call and Response) */}
              <path d="M 275 80 L 275 40 Q 275 30 295 30 L 415 30 Q 435 30 435 40 L 435 80" className="stroke-zinc-800" strokeDasharray="3,3" strokeWidth="1.5" fill="none" />
              <text x="355" y="20" textAnchor="middle" fill="#52525b" fontSize="8">Dynamic PR/Diff Pull</text>

              {/* Connector 2 -> 4 (DB Save) */}
              <path d="M 340 110 L 410 110" className="stroke-zinc-800" strokeWidth="2" fill="none" />
              <polygon points="410,110 402,106 402,114" className="fill-zinc-800" />
              <circle cx="375" cy="110" r="3" className="fill-cyan-400" filter="url(#glow)">
                <animate attributeName="cx" from="340" to="410" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Node 3: Neon PostgreSQL Database */}
              <g transform="translate(420, 80)">
                <rect width="130" height="60" rx="8" className="fill-zinc-900 stroke-zinc-800" strokeWidth="1.5" />
                <rect width="130" height="60" rx="8" className="fill-none stroke-indigo-500/30" strokeWidth="3" />
                <text x="65" y="25" textAnchor="middle" fill="#a1a1aa" fontWeight="bold">Neon DB</text>
                <text x="65" y="40" textAnchor="middle" fill="#10b981">PostgreSQL Cache</text>
              </g>

              {/* Connector 3 -> 4 */}
              <path d="M 550 110 L 620 110" className="stroke-zinc-800" strokeWidth="2" fill="none" />
              <polygon points="620,110 612,106 612,114" className="fill-zinc-800" />
              <circle cx="585" cy="110" r="3" className="fill-emerald-400" filter="url(#glow)">
                <animate attributeName="cx" from="550" to="620" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Node 4: AI Review Engine */}
              <g transform="translate(630, 80)">
                <rect width="140" height="60" rx="8" className="fill-zinc-900 stroke-zinc-800" strokeWidth="1.5" />
                <rect width="140" height="60" rx="8" className="fill-none stroke-indigo-500/30" strokeWidth="3" />
                <text x="70" y="25" textAnchor="middle" fill="#a1a1aa" fontWeight="bold">AI Engine</text>
                <text x="70" y="40" textAnchor="middle" fill="#ec4899">OpenAI & Heuristics</text>
              </g>

              {/* Feedback Loop: Node 4 back to DB cache */}
              <path d="M 700 140 L 700 180 Q 700 190 680 190 L 505 190 Q 485 190 485 180 L 485 140" className="stroke-pink-500/40" strokeDasharray="4,2" strokeWidth="1.5" fill="none" />
              <text x="592" y="202" textAnchor="middle" fill="#ec4899" fontSize="8">Save Inline Vulnerabilities & Metrics</text>

              {/* SSE Stream Connector (From DB/Server back to Frontend Client) */}
              <path d="M 485 80 L 485 50 Q 485 45 470 45 L 290 45 Q 275 45 275 50 L 275 80" className="stroke-indigo-400" strokeDasharray="2,2" strokeWidth="1.5" fill="none">
                <animate attributeName="strokeDashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
              </path>
              <text x="380" y="55" textAnchor="middle" fill="#818cf8" fontSize="8">SSE Progress Stream</text>
            </svg>
          </div>

          {/* Detailed step analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-900 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 font-mono">
                <Server className="w-4 h-4 text-indigo-400" />
                <span>FastAPI Webhook Listener</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                Listens for PR payloads. When triggered, checks if the repo is connected. If not, onboard it. It downloads actual diffs via the GitHub API.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-900 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 font-mono">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Neon PostgreSQL Caching</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                Maintains transactional records of all repositories, PR files, and review audits. This prevents re-fetching files on every request, ensuring low latency.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-900 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 font-mono">
                <Brain className="w-4 h-4 text-pink-400" />
                <span>OpenAI / Regex Auditing</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                Funnels diff content through a strict structural code quality prompt in JSON mode. If offline or API fails, uses secondary regex scanners to parse for bugs.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-950/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>Version 1.0.0 (Production Architecture)</span>
          <button onClick={onClose} className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded font-semibold transition-colors">
            Close Viewer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
