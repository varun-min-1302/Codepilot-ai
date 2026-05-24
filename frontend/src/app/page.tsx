"use client";

import Link from "next/link";
import { ArrowRight, Terminal, Shield, Cpu, RefreshCw, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function LandingPage() {
  const [animationStep, setAnimationStep] = useState(0);

  // Cycle through the animated code review demonstration
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#070709] overflow-hidden flex flex-col justify-between">
      {/* Background radial gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center">
              <Terminal className="w-3.5 h-3.5 text-zinc-950 stroke-[2.5]" />
            </div>
            <span className="font-mono font-bold tracking-tight text-white text-sm">CodePilot <span className="text-indigo-400">AI</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-white transition-colors">Interactive Demo</a>
            <a href="#integrations" className="hover:text-white transition-colors">Integrations</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="text-xs font-mono text-zinc-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              Console
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-semibold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
            >
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow max-w-7xl mx-auto px-6 pt-16 pb-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text panel */}
          <div className="lg:col-span-5 flex flex-col gap-6 text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-[10px] font-mono w-max">
              <Zap className="w-3 h-3 fill-indigo-400" />
              <span>Next-Gen Realtime Code Review</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
              Senior Engineer reviews, <br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                delivered in seconds.
              </span>
            </h1>
            
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-lg">
              CodePilot AI listens to your GitHub pull requests, runs security audits, flags algorithmic bottlenecks, and posts code-level suggestions before your team even starts code review.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-2">
              <Link
                href="/dashboard"
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-6 h-11 rounded-lg text-sm flex items-center justify-center gap-2 transition-all font-sans"
              >
                Connect Repository <svg className="w-4 h-4 fill-current text-zinc-950" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
              </Link>
              <Link
                href="/dashboard"
                className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold px-6 h-11 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-all font-sans"
              >
                Launch Demo Sandbox <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
              <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">Ctrl + K</span>
              <span>to open command palette anywhere</span>
            </div>
          </div>

          {/* Code Review Sandbox Animation */}
          <div className="lg:col-span-7" id="demo">
            <div className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 shadow-2xl overflow-hidden glass-panel relative">
              {/* Window buttons */}
              <div className="h-10 bg-zinc-950/90 border-b border-zinc-900 px-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  <span className="text-[10px] text-zinc-500 font-mono ml-4">auth_service / auth.py</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>AI Review Active</span>
                </div>
              </div>

              {/* Code layout */}
              <div className="p-5 font-mono text-xs overflow-x-auto min-h-[300px] flex flex-col justify-between">
                
                {/* Visual Code Changes */}
                <div className="flex flex-col gap-1.5 text-zinc-400">
                  <div>1  <span className="text-zinc-600">import os</span></div>
                  <div>2  <span className="text-indigo-400">def login_user(username, password):</span></div>
                  <div>3  <span className="text-zinc-500">    db = get_db_connection()</span></div>
                  <div>4  <span className="text-zinc-500">    cursor = db.cursor()</span></div>
                  
                  {/* Step 0: Initializing scanner */}
                  {animationStep === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2 text-zinc-500 italic">
                      Analyzing authentication logic for OWASP flaws...
                    </motion.div>
                  )}

                  {/* Step 1: SQL Injection found */}
                  {animationStep >= 1 && (
                    <div className="bg-red-950/20 border-l-2 border-red-500/60 px-2 py-0.5 text-red-200">
                      5- <span className="line-through text-red-500/80">query = f&quot;SELECT * FROM users WHERE username = &apos;&#123;username&#125;&apos; AND password = &apos;&#123;password&#125;&apos;&quot;</span>
                    </div>
                  )}

                  {/* Step 2: Displaying AI Comment inline */}
                  {animationStep >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="my-2 p-3 bg-[#11090d] border border-red-900/30 rounded-lg text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-red-400 font-bold text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-red-950/60 border border-red-950">
                          Critical · Security
                        </span>
                        <span className="text-zinc-500 text-[10px]">CodePilot AI</span>
                      </div>
                      <p className="text-zinc-300 mb-2 font-sans leading-normal">
                        SQL Injection detected. Parameterize input variables to prevent authentication bypass.
                      </p>
                      <div className="bg-zinc-950/70 p-2 rounded text-[10px] border border-zinc-900 text-zinc-400 font-mono">
                        Recommendation: Use <code className="text-indigo-400 font-semibold">?</code> binding syntax
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Code Refactored & Replaced */}
                  {animationStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-emerald-950/20 border-l-2 border-emerald-500/60 px-2 py-0.5 text-emerald-300"
                    >
                      5+ <span>query = &quot;SELECT * FROM users WHERE username = ? AND password = ?&quot;</span>
                      <br />
                      6+ <span>cursor.execute(query, (username, password))</span>
                    </motion.div>
                  )}

                  <div>6  <span className="text-zinc-500">    user = cursor.fetchone()</span></div>
                </div>

                {/* Foot indicators */}
                <div className="border-t border-zinc-900 pt-3 mt-4 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Scenario: SQL injection fix loop</span>
                  <div className="flex gap-2">
                    <span className={animationStep === 0 ? "text-indigo-400" : ""}>●</span>
                    <span className={animationStep === 1 ? "text-indigo-400" : ""}>●</span>
                    <span className={animationStep === 2 ? "text-indigo-400" : ""}>●</span>
                    <span className={animationStep === 3 ? "text-indigo-400" : ""}>●</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Feature Section */}
      <section className="bg-zinc-950 border-t border-zinc-900 py-20 px-6" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16 flex flex-col gap-3">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Built for engineering velocity</h2>
            <p className="text-zinc-400 text-xs md:text-sm">We audit code within seconds of a pull request trigger. No context switching needed.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/50 flex flex-col gap-4">
              <div className="w-8 h-8 rounded bg-red-950/40 border border-red-900/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200">Continuous Security Auditing</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Scan changed lines for SQL injection, exposed API credentials, cross-site scripting vulnerabilities, and unsafe dependency usage instantly.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/50 flex flex-col gap-4">
              <div className="w-8 h-8 rounded bg-cyan-950/40 border border-cyan-900/30 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200">Algorithmic Optimizations</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Flag nested loops scaling to cubic complexities, redline N+1 query patterns, and evaluate memory allocation locks.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/50 flex flex-col gap-4">
              <div className="w-8 h-8 rounded bg-indigo-950/40 border border-indigo-900/30 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200">Unified Fix Proposals</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Don&apos;t just complain about bugs. Receive structural unified diff proposals matching standard syntax structures that you can review and accept.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 px-6 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-[11px] uppercase tracking-wide">CodePilot AI</span>
            <span>© 2026 Hackathon Prototype.</span>
          </div>
          <div className="flex gap-4">
            <Link href="/dashboard" className="hover:text-zinc-300">Console</Link>
            <Link href="/analytics" className="hover:text-zinc-300">Analytics</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
