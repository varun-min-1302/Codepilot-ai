"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { 
  Terminal, 
  GitPullRequest, 
  Shield, 
  BarChart2, 
  Settings, 
  Play, 
  Plus, 
  Search,
  BookOpen
} from "lucide-react";
import { useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSimulating, setIsSimulating] = useState(false);

  const menuItems = [
    { label: "Dashboard", href: "/dashboard", icon: <Terminal className="w-4 h-4" /> },
    { label: "Pull Requests", href: "/dashboard?tab=prs", icon: <GitPullRequest className="w-4 h-4" /> },
    { label: "Security score", href: "/dashboard?tab=security", icon: <Shield className="w-4 h-4" /> },
    { label: "Analytics", href: "/analytics", icon: <BarChart2 className="w-4 h-4" /> },
  ];

  const handleSimulateWebhook = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`${API_URL}/api/webhooks/simulate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.pr_id) {
        router.push(`/pr/${data.pr_id}`);
      }
    } catch (err) {
      console.error("Simulation failed, falling back to mock routing:", err);
      // Fallback
      router.push("/pr/42");
    } finally {
      setIsSimulating(false);
    }
  };

  const isTabActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-md flex flex-col justify-between h-screen sticky top-0 flex-shrink-0 z-20">
      {/* Top Section */}
      <div className="flex flex-col gap-6 p-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-zinc-950 stroke-[2.5]" />
          </div>
          <span className="font-mono font-bold tracking-tight text-white text-sm">CodePilot <span className="text-indigo-400">AI</span></span>
        </Link>

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-1">
          <div className="text-[10px] font-mono font-semibold tracking-wider text-zinc-500 uppercase px-2 mb-2 select-none">
            Review Platform
          </div>
          {menuItems.map((item) => {
            const active = isTabActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-zinc-900 text-white font-semibold border-l-2 border-indigo-500 rounded-l-none"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Simulator Panel */}
        <div className="mt-4 p-3 rounded-lg border border-zinc-900 bg-zinc-950/40 flex flex-col gap-2.5">
          <p className="text-[10px] text-zinc-500 leading-normal">
            Simulate a realistic GitHub pull request webhook trigger for the Authentication Service repo.
          </p>
          <button
            onClick={handleSimulateWebhook}
            disabled={isSimulating}
            className="w-full h-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-[10px] font-semibold font-mono rounded flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-indigo-600/10"
          >
            <Play className="w-3 h-3 fill-white" />
            {isSimulating ? "Simulating..." : "Trigger PR Webhook"}
          </button>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-zinc-900/60 flex flex-col gap-3">
        {/* Ctrl + K Indicator */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-zinc-900/50 border border-zinc-900 text-[10px] text-zinc-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Search className="w-3 h-3 text-zinc-500" />
            <span>Search console</span>
          </div>
          <span className="text-[9px] bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded">Ctrl+K</span>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
            AD
          </div>
          <div className="flex flex-col text-[10px]">
            <span className="text-zinc-300 font-medium leading-none">alex-dev</span>
            <span className="text-zinc-500 font-mono mt-0.5">developer</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
