"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { API_URL } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { 
  GitPullRequest, 
  ShieldAlert, 
  Cpu, 
  AlertTriangle,
  FolderOpen, 
  FileCode,
  Send,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  Clipboard,
  CheckCircle,
  Play,
  RotateCw,
  Plus,
  Minus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PRDetailsResponse, AIReviewIssue, PRFile, ChatMessage } from "@/types";

export default function PRReviewPage() {
  const params = useParams();
  const router = useRouter();
  const prId = params.id as string;

  const [prDetails, setPrDetails] = useState<PRDetailsResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<PRFile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamMessage, setStreamMessage] = useState("Initializing review listener...");
  const [streamProgress, setStreamProgress] = useState(5);
  const [streamStep, setStreamStep] = useState("init");

  // Chat Copilot state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch PR details
  const fetchPRDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/prs/${prId}`);
      if (!res.ok) throw new Error("PR not found");
      const data = await res.json();
      setPrDetails(data);
      
      // If PR is completed, select the first file by default
      if (data.pr.status === "completed") {
        setIsStreaming(false);
        if (data.files && data.files.length > 0) {
          setSelectedFile(data.files[0]);
        }
        
        // Add greeting message to AI chat
        if (chatMessages.length === 0) {
          setChatMessages([
            {
              role: "assistant",
              content: `### CodePilot AI Review Assistant\n\nI have finished reviewing your Pull Request. I found **${data.issues.length} issues** across your code changes:\n- **2 Security Flaws** (SQL injection and hardcoded key)\n- **1 Performance Bottleneck** (O(N^3) nested loop)\n- **1 Bug Risk** (Broad exception handling)\n\nAsk me how to refactor these, or click the **Accept Fix** buttons to inspect unified diffs.`,
              timestamp: new Date().toISOString()
            }
          ]);
        }
      } else if (data.pr.status === "analyzing" || data.pr.status === "pending") {
        startReviewStream();
      }
    } catch (err) {
      console.warn("API error. Falling back to simulated details.");
      simulateOfflineDetails();
    } finally {
      setLoading(false);
    }
  };

  // Start Server-Sent Events (SSE) review stream
  const startReviewStream = () => {
    setIsStreaming(true);
    const eventSource = new EventSource(`${API_URL}/api/prs/${prId}/review/stream`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStreamMessage(data.message);
      setStreamProgress(data.percentage);
      setStreamStep(data.step);
      
      if (data.step === "finished") {
        eventSource.close();
        setIsStreaming(false);
        fetchPRDetails();
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection failed, falling back to simulated browser progress.");
      eventSource.close();
      simulateProgressTimer();
    };
  };

  // Offline simulation fallback for presentation safety
  const simulateOfflineDetails = () => {
    const mockDetails: PRDetailsResponse = {
      pr: {
        id: parseInt(prId),
        number: 42,
        title: "feat: add jwt auth and permission checks",
        author: "alex-dev",
        status: "completed",
        source_branch: "feat/jwt-auth",
        target_branch: "main",
        created_at: new Date().toISOString(),
      },
      repo: {
        id: 1,
        name: "auth-service",
        owner: "codepilot-ai",
        description: "Core authentication and token validation microservice."
      },
      summary: {
        overall_summary: "The Pull Request introduces critical security vulnerabilities (SQL Injection and a hardcoded secret token) and a nested loop with O(N^3) time complexity in permissions parsing. Refactoring recommendations have been attached to each line of code.",
        security_score: 38,
        performance_score: 64,
        best_practice_score: 78
      },
      files: [
        {
          id: 101,
          filename: "auth.py",
          status: "modified",
          additions: 11,
          deletions: 2,
          content: "import os\nimport jwt\nimport logging\n\nlogger = logging.getLogger(__name__)\n\ndef login_user(username, password):\n    db = get_db_connection()\n    cursor = db.cursor()\n    # Directly concatenate input to query\n    query = f\"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'\"\n    cursor.execute(query)\n    user = cursor.fetchone()\n    if user:\n        return {\"status\": \"success\", \"token\": \"JWT_SUPER_SECRET_KEY_12345\"}\n    else:\n        raise Exception(\"Invalid credentials\")"
        },
        {
          id: 102,
          filename: "utils.py",
          status: "modified",
          additions: 9,
          deletions: 2,
          content: "# Helper utilities for roles and permissions\n\ndef find_matching_permissions(user_roles, system_permissions):\n    matches = []\n    for role in user_roles:\n        for perm in system_permissions:\n            if role.id == perm.role_id:\n                # Nested lookup inside nested loop\n                for user_perm in role.permissions:\n                    if user_perm.code == perm.code:\n                        matches.append(user_perm)\n    return matches"
        }
      ],
      issues: [
        {
          id: 1,
          filename: "auth.py",
          line_number: 11,
          severity: "critical",
          category: "security",
          title: "SQL Injection Vulnerability",
          description: "User input username and password are directly concatenated into the SQL query string. This allows an attacker to bypass authentication by injecting malicious SQL statements.",
          suggestion_diff: "@@ -10,3 +10,3 @@\n-    query = f\"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'\"\n-    cursor.execute(query)\n+    query = \"SELECT * FROM users WHERE username = ? AND password = ?\"\n+    cursor.execute(query, (username, password))"
        },
        {
          id: 2,
          filename: "auth.py",
          line_number: 15,
          severity: "high",
          category: "security",
          title: "Hardcoded JWT Secret Key",
          description: "A sensitive cryptographic key is hardcoded directly in the source code. Attackers can forge valid JWT tokens and hijack sessions.",
          suggestion_diff: "@@ -14,3 +14,3 @@\n-        return {\"status\": \"success\", \"token\": \"JWT_SUPER_SECRET_KEY_12345\"}\n+        jwt_secret = os.getenv(\"JWT_SECRET_KEY\")\n+        return {\"status\": \"success\", \"token\": generate_token(user, jwt_secret)}"
        },
        {
          id: 3,
          filename: "utils.py",
          line_number: 6,
          severity: "medium",
          category: "performance",
          title: "Quadratic Time Complexity in Permission Lookup",
          description: "Nested loops result in O(N^3) time complexity. For large lists of user roles and system permissions, this will degrade API response times significantly.",
          suggestion_diff: "@@ -5,8 +5,7 @@\n-    for role in user_roles:\n-        for perm in system_permissions:\n-            if role.id == perm.role_id:\n-                for user_perm in role.permissions:\n-                    if user_perm.code == perm.code:\n-                        matches.append(user_perm)\n+    perm_map = {perm.code: perm.role_id for perm in system_permissions}\n+    for role in user_roles:\n+        for user_perm in role.permissions:\n+            if perm_map.get(user_perm.code) == role.id:\n+                matches.append(user_perm)"
        },
        {
          id: 4,
          filename: "auth.py",
          line_number: 17,
          severity: "low",
          category: "bug_risk",
          title: "Broad Exception and Leaked Error Info",
          description: "Raising a raw Exception is a code smell. It makes it hard for callers to catch specific error classes.",
          suggestion_diff: "@@ -16,2 +16,3 @@\n-        raise Exception(\"Invalid credentials\")\n+        logger.warning(f\"Failed login attempt for user: {username}\")\n+        raise AuthenticationError(\"Invalid username or password\")"
        }
      ]
    };
    
    setPrDetails(mockDetails);
    setIsStreaming(false);
    if (mockDetails.files.length > 0) {
      setSelectedFile(mockDetails.files[0]);
    }
    setChatMessages([
      {
        role: "assistant",
        content: "### CodePilot AI Review Assistant (Offline Mode)\n\nI have finished reviewing your Pull Request. I found **4 issues** across your code changes:\n- **2 Security Flaws** (SQL injection and hardcoded key)\n- **1 Performance Bottleneck** (O(N^3) nested loop)\n- **1 Bug Risk** (Broad exception handling)\n\nAsk me how to refactor these, or click the **Accept Fix** buttons to inspect unified diffs.",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const simulateProgressTimer = () => {
    setIsStreaming(true);
    const stages = [
      { p: 20, m: "Cloning repository environment and mapping dependencies...", s: "cloning" },
      { p: 45, m: "Parsing code diffs and identifying modified functions...", s: "diff" },
      { p: 70, m: "Auditing authentication logic for SQL injection, XSS, and secrets...", s: "security" },
      { p: 90, m: "Evaluating runtime complexity and nested loops...", s: "perf" },
      { p: 100, m: "Review generated. Publishing inline feedback to dashboard...", s: "complete" }
    ];
    
    let currentStageIdx = 0;
    const timer = setInterval(() => {
      if (currentStageIdx < stages.length) {
        setStreamProgress(stages[currentStageIdx].p);
        setStreamMessage(stages[currentStageIdx].m);
        setStreamStep(stages[currentStageIdx].s);
        currentStageIdx++;
      } else {
        clearInterval(timer);
        setIsStreaming(false);
        simulateOfflineDetails();
      }
    }, 1500);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPRDetails(); }, [prId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const newMsg: ChatMessage = {
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/prs/${prId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message, timestamp: data.created_at }
        ]);
      } else {
        throw new Error();
      }
    } catch {
      setTimeout(() => {
        let answer = "I am a local simulation. Ask me about **SQL Injection** or **O(N^3) loops** and I will explain!";
        const q = textToSend.toLowerCase();
        if (q.includes("sql") || q.includes("vulnerab") || q.includes("secur")) {
          answer = "### SQL Injection Explanation\n\nDirectly inserting strings into query scripts allows input variables to disrupt standard syntax. An attacker could enter `username = 'admin' --` to hijack logs.\n\n**Fix:** Use placeholder parameters `?` or `%s` so database interpreters treat values strictly as strings, not executable code statements.";
        } else if (q.includes("optimize") || q.includes("loop") || q.includes("slow")) {
          answer = "### O(N^3) Nested Loop Explanation\n\nNested iterations create multiplication scaling factors. A code structure iterating list items inside list items loops `N * M * K` times.\n\n**Solution:** Flatten the complexity using key-value hashes to map permissions O(1) inside one simple index loop.";
        }
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: answer, timestamp: new Date().toISOString() }
        ]);
      }, 1000);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAcceptFix = async (issueId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/issues/${issueId}/accept-fix`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchPRDetails();
      } else {
        alert("Failed to apply the fix suggestion to the database cached file.");
      }
    } catch (err) {
      console.error("Accept fix error:", err);
      // Fallback local simulation for offline presentation
      setPrDetails((prev: any) => {
        if (!prev) return null;
        const remainingIssues = prev.issues.filter((i: any) => i.id !== issueId);
        
        // Find the issue and patch its file content in state
        const targetIssue = prev.issues.find((i: any) => i.id === issueId);
        let updatedFiles = prev.files;
        if (targetIssue) {
          updatedFiles = prev.files.map((f: any) => {
            if (f.filename === targetIssue.filename && f.content && targetIssue.suggestion_diff) {
              const patchedContent = applySuggestionPatchLocal(f.content, targetIssue.suggestion_diff);
              
              // If we are currently viewing this file, update selectedFile too
              if (selectedFile && selectedFile.filename === f.filename) {
                setTimeout(() => setSelectedFile({ ...selectedFile, content: patchedContent }), 0);
              }
              return { ...f, content: patchedContent };
            }
            return f;
          });
        }

        const sec_count = remainingIssues.filter((i: any) => i.category === "security").length;
        const perf_count = remainingIssues.filter((i: any) => i.category === "performance").length;
        const best_count = remainingIssues.filter((i: any) => i.category !== "security" && i.category !== "performance").length;

        const newSummary = prev.summary ? {
          ...prev.summary,
          security_score: Math.max(38, 100 - sec_count * 30),
          performance_score: Math.max(64, 100 - perf_count * 20),
          best_practice_score: Math.max(78, 100 - best_count * 10),
          overall_summary: remainingIssues.length === 0 
            ? "All code review issues have been successfully resolved and applied!" 
            : prev.summary.overall_summary
        } : null;

        return {
          ...prev,
          issues: remainingIssues,
          files: updatedFiles,
          summary: newSummary
        };
      });
    }
  };

  const applySuggestionPatchLocal = (originalContent: string, patchDiff: string): string => {
    if (!originalContent || !patchDiff) return originalContent || "";
    const lines = originalContent.split("\n");
    const patchLines = patchDiff.split("\n");
    const minusLines: string[] = [];
    const plusLines: string[] = [];
    for (const pl of patchLines) {
      if (pl.startsWith("@@")) continue;
      if (pl.startsWith("-")) {
        minusLines.push(pl.slice(1));
      } else if (pl.startsWith("+")) {
        plusLines.push(pl.slice(1));
      }
    }
    const oldText = minusLines.join("\n").trim();
    const newText = plusLines.join("\n").trim();
    if (originalContent.includes(oldText)) {
      return originalContent.replace(oldText, newText);
    }
    return originalContent;
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      default: return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  const getSeverityBadge = (sev: string) => {
    return (
      <span className={`text-[9px] font-bold font-mono tracking-wide uppercase px-1.5 py-0.5 rounded border ${getSeverityColor(sev)}`}>
        {sev}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex bg-[#070709] min-h-screen text-zinc-200">
        <Sidebar />
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RotateCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-xs font-mono text-zinc-500">Loading code editor workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isStreaming) {
    return (
      <div className="flex bg-[#070709] min-h-screen text-zinc-200">
        <Sidebar />
        <div className="flex-grow flex flex-col min-h-screen">
          <Navbar title="Realtime Code Audit" subtitle="AI review pipeline running" />
          <div className="flex-grow flex items-center justify-center p-6 relative">
            <div className="absolute w-[450px] h-[450px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="w-full max-w-lg p-8 rounded-xl border border-zinc-900 bg-zinc-950/80 shadow-2xl glass-panel relative overflow-hidden flex flex-col items-center gap-6 scan-line-animation">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/10" />
                <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 border-r-indigo-400 animate-spin" style={{ animationDuration: "1.5s" }} />
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex flex-col gap-1.5 text-center w-full">
                <h3 className="text-sm font-semibold text-white">Running AI Reviews</h3>
                <p className="text-xs text-indigo-400 font-mono h-5 text-stream-cursor select-none">{streamMessage}</p>
              </div>
              <div className="w-full flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Pipeline audit: {streamStep.toUpperCase()}</span>
                  <span>{streamProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-900">
                  <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400" animate={{ width: `${streamProgress}%` }} transition={{ ease: "easeInOut" }} />
                </div>
              </div>
              <div className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-3 text-[10px] font-mono text-zinc-500 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span>LOGGING OUTPUT</span>
                  <span className="text-emerald-400 animate-pulse">● online</span>
                </div>
                <hr className="border-zinc-900" />
                <div className="flex flex-col gap-1 text-left">
                  <div>[sys] Connecting webhook socket: OK</div>
                  {streamProgress > 15 && <div>[git] Fetching PR diff changes: 2 files, +20/-4 lines</div>}
                  {streamProgress > 45 && <div>[ai] Model endpoint handshaking... Done</div>}
                  {streamProgress > 70 && <div className="text-red-400/90">[warn] High threat category flagged in auth.py</div>}
                  {streamProgress > 90 && <div>[ai] Formatting suggested fixes diff patch.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pr = prDetails?.pr;
  const repo = prDetails?.repo;
  const summary = prDetails?.summary;
  const files = prDetails?.files || [];
  const issues = prDetails?.issues || [];
  const selectedFileIssues = selectedFile ? issues.filter(i => i.filename === selectedFile.filename) : [];

  return (
    <div className="flex bg-[#070709] min-h-screen text-zinc-200">
      <Sidebar />
      <div className="flex-grow flex flex-col min-h-screen">
        <Navbar 
          title={pr ? `PR #${pr.number}: ${pr.title}` : "Pull Request Review"} 
          subtitle={repo ? `${repo.owner}/${repo.name}` : ""}
        />
        <div className="flex-grow grid grid-cols-12 overflow-hidden h-[calc(100vh-3.5rem)]">
          
          {/* Left Panel: File Tree & Scores */}
          <div className="col-span-3 border-r border-zinc-900 bg-zinc-950/20 p-4 flex flex-col gap-6 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Link href="/dashboard" className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 font-mono transition-colors mb-2">
                <ArrowLeft className="w-3 h-3" /> Back to Dashboard
              </Link>
              <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-500 uppercase select-none">Review Scores</h3>
            </div>

            {summary && (
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-lg border border-zinc-900 bg-zinc-950/60">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-12 h-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" className="stroke-zinc-900 fill-none" strokeWidth="3" />
                      <circle cx="24" cy="24" r="20" className="stroke-red-500 fill-none" strokeWidth="3.5"
                        strokeDasharray={2 * Math.PI * 20}
                        strokeDashoffset={2 * Math.PI * 20 * (1 - summary.security_score / 100)}
                      />
                    </svg>
                    <span className="absolute text-[10px] font-bold font-mono text-red-400">{summary.security_score}</span>
                  </div>
                  <span className="text-[9px] font-medium text-zinc-400 font-mono">Security</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-12 h-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" className="stroke-zinc-900 fill-none" strokeWidth="3" />
                      <circle cx="24" cy="24" r="20" className="stroke-yellow-500 fill-none" strokeWidth="3.5"
                        strokeDasharray={2 * Math.PI * 20}
                        strokeDashoffset={2 * Math.PI * 20 * (1 - summary.performance_score / 100)}
                      />
                    </svg>
                    <span className="absolute text-[10px] font-bold font-mono text-yellow-400">{summary.performance_score}</span>
                  </div>
                  <span className="text-[9px] font-medium text-zinc-400 font-mono">Speed</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-12 h-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" className="stroke-zinc-900 fill-none" strokeWidth="3" />
                      <circle cx="24" cy="24" r="20" className="stroke-indigo-500 fill-none" strokeWidth="3.5"
                        strokeDasharray={2 * Math.PI * 20}
                        strokeDashoffset={2 * Math.PI * 20 * (1 - summary.best_practice_score / 100)}
                      />
                    </svg>
                    <span className="absolute text-[10px] font-bold font-mono text-indigo-400">{summary.best_practice_score}</span>
                  </div>
                  <span className="text-[9px] font-medium text-zinc-400 font-mono">Quality</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-500 uppercase select-none">Changed Files</h3>
              <div className="flex flex-col gap-1.5">
                {files.map((file) => {
                  const isActive = selectedFile?.id === file.id;
                  const fileIssueCount = issues.filter(i => i.filename === file.filename).length;
                  return (
                    <div key={file.id} onClick={() => setSelectedFile(file)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                        isActive ? "bg-zinc-900 text-white border-zinc-800" : "text-zinc-400 border-transparent hover:bg-zinc-900/30 hover:text-zinc-200"
                      }`}>
                      <div className="flex items-center gap-2 text-xs">
                        <FileCode className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-zinc-500"}`} />
                        <span className="font-mono truncate max-w-[130px]">{file.filename}</span>
                      </div>
                      {fileIssueCount > 0 && (
                        <span className="text-[9px] font-mono font-bold bg-red-950/60 border border-red-900/30 text-red-400 rounded-full px-1.5 py-0.5">{fileIssueCount}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {summary && (
              <div className="mt-auto p-3.5 rounded-lg border border-zinc-900 bg-zinc-950/40 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 font-semibold mb-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>AI Review Summary</span>
                </div>
                <p className="text-zinc-500 leading-normal font-sans text-[11px]">{summary.overall_summary}</p>
              </div>
            )}
          </div>

          {/* Center Panel: Diff and Code Viewer */}
          <div className="col-span-6 border-r border-zinc-900 bg-zinc-950/40 flex flex-col overflow-hidden">
            <div className="h-10 bg-zinc-950/80 border-b border-zinc-900 flex items-center justify-between px-4">
              <div className="flex items-center gap-2 text-xs">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-zinc-200">{selectedFile?.filename}</span>
                <span className="text-[10px] text-zinc-500 font-mono">({selectedFile?.status})</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                <span className="text-emerald-400">+{selectedFile?.additions} additions</span>
                <span>·</span>
                <span className="text-red-400">-{selectedFile?.deletions} deletions</span>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto p-4 font-mono text-xs text-zinc-400 leading-relaxed bg-[#050507]">
              {selectedFile?.content ? (
                selectedFile.content.split("\n").map((line, idx) => {
                  const lineNum = idx + 1;
                  const lineIssues = selectedFileIssues.filter(i => i.line_number === lineNum);
                  const isVulnerableLine = lineIssues.length > 0;
                  let lineBackground = "";
                  if (isVulnerableLine) {
                    const topSeverity = lineIssues[0].severity;
                    lineBackground = topSeverity === "critical" ? "bg-red-950/15 border-l-2 border-red-500/50" : "bg-orange-950/10 border-l-2 border-orange-500/40";
                  }
                  return (
                    <div key={`line-${lineNum}`} className="flex flex-col">
                      <div className={`flex items-start py-0.5 px-2 hover:bg-zinc-900/30 transition-colors ${lineBackground}`}>
                        <span className="w-8 text-zinc-600 select-none text-right pr-3 border-r border-zinc-900 mr-3 text-[10px]">{lineNum}</span>
                        <pre className={`whitespace-pre-wrap overflow-x-auto text-[11px] font-mono ${isVulnerableLine ? "text-zinc-200 font-semibold" : "text-zinc-400"}`}>{line || " "}</pre>
                      </div>
                      {isVulnerableLine && lineIssues.map(issue => (
                        <div key={`issue-card-${issue.id}`} className="pl-14 pr-4 py-2 select-none">
                          <div className="p-4 border border-zinc-800 bg-zinc-950 rounded-xl flex flex-col gap-3 shadow-lg max-w-2xl">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={`w-3.5 h-3.5 ${issue.severity === "critical" ? "text-red-400" : "text-orange-400"}`} />
                                <span className="text-[11px] font-bold text-zinc-200">{issue.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-mono text-zinc-500 font-semibold uppercase px-1.5 py-0.5 border border-zinc-800 bg-zinc-900 rounded select-none">{issue.category}</span>
                                {getSeverityBadge(issue.severity)}
                              </div>
                            </div>
                            <p className="text-zinc-400 text-xs font-sans leading-normal">{issue.description}</p>
                            {issue.suggestion_diff && (
                              <div className="flex flex-col gap-1.5">
                                <div className="text-[9px] font-mono text-zinc-500 font-semibold">SUGGESTED REFACTOR</div>
                                <div className="border border-zinc-900 bg-zinc-950 rounded-md overflow-hidden font-mono text-[10px]">
                                  {issue.suggestion_diff.split("\n").map((diffLine, dIdx) => {
                                    let diffBg = "px-2 py-0.5 block text-zinc-400";
                                    if (diffLine.startsWith("+")) {
                                      diffBg = "bg-emerald-950/20 text-emerald-300 font-medium px-2 py-0.5 block";
                                    } else if (diffLine.startsWith("-")) {
                                      diffBg = "bg-red-950/20 text-red-300 font-medium line-through px-2 py-0.5 block";
                                    }
                                    return (
                                      <div key={`dl-${dIdx}`} className={diffBg}>
                                        <pre className="whitespace-pre-wrap">{diffLine}</pre>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <button onClick={() => handleAcceptFix(issue.id)}
                                    className="h-7 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center gap-1.5 transition-colors font-sans">
                                    Accept Fix Suggestion
                                  </button>
                                  <button onClick={() => handleSendMessage(`Explain how to implement the fix for: ${issue.title}`)}
                                    className="h-7 px-3 bg-indigo-950/20 border border-indigo-900/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 rounded text-[10px] font-semibold flex items-center gap-1.5 transition-colors font-sans">
                                    Ask Copilot
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500 select-none">
                  Select a file from the explorer tree to view code changes.
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Copilot Chat Assistant */}
          <div className="col-span-3 bg-zinc-950/80 backdrop-blur-md flex flex-col justify-between overflow-hidden">
            <div className="h-10 bg-zinc-950/90 border-b border-zinc-900 flex items-center gap-2 px-4 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-xs font-semibold text-zinc-200">CodePilot Copilot</span>
            </div>
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
              {chatMessages.map((msg, idx) => (
                <div key={`chat-${idx}`} className={`flex flex-col gap-1 max-w-[90%] ${msg.role === "user" ? "ml-auto text-right" : "mr-auto text-left"}`}>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase select-none">
                    {msg.role === "user" ? "Alex (Dev)" : "CodePilot AI"}
                  </span>
                  <div className={`p-3 rounded-lg text-xs leading-relaxed font-sans border ${
                    msg.role === "user" ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-zinc-950/60 border-zinc-900 text-zinc-300"
                  }`}>
                    {msg.content.split("\n\n").map((block, bIdx) => {
                      if (block.startsWith("```")) {
                        const lines = block.split("\n").filter(l => !l.startsWith("```"));
                        return (
                          <div key={`b-${bIdx}`} className="border border-zinc-900 bg-zinc-950/85 p-2 rounded-md font-mono text-[10px] text-zinc-300 my-2 overflow-x-auto text-left leading-normal">
                            <pre>{lines.join("\n")}</pre>
                          </div>
                        );
                      }
                      if (block.startsWith("###")) {
                        return <h4 key={`b-${bIdx}`} className="font-bold text-white font-mono border-b border-zinc-900 pb-1 mb-2 text-left">{block.replace("###", "").trim()}</h4>;
                      }
                      return <p key={`b-${bIdx}`} className="mb-2 text-left">{block}</p>;
                    })}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex flex-col gap-1 mr-auto text-left">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">CodePilot AI</span>
                  <div className="p-3 rounded-lg text-xs bg-zinc-950/60 border border-zinc-900 flex items-center gap-2">
                    <RotateCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                    <span className="text-zinc-500 font-mono">Formulating suggestion...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-zinc-900 flex flex-col gap-2.5 bg-zinc-950/90 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5 select-none">
                <button onClick={() => handleSendMessage("Why is auth.py vulnerable?")}
                  className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-900 rounded text-[9px] text-zinc-400 font-mono transition-colors">
                  Why vulnerable?
                </button>
                <button onClick={() => handleSendMessage("Optimize the loop inside utils.py")}
                  className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-900 rounded text-[9px] text-zinc-400 font-mono transition-colors">
                  Optimize loop
                </button>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-900 rounded-lg px-2 py-1.5 focus-within:border-zinc-800 transition-colors">
                <input type="text" placeholder="Ask a question about code fixes..."
                  value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                  className="w-full bg-transparent text-xs text-zinc-200 outline-none placeholder-zinc-500" />
                <button onClick={() => handleSendMessage()} disabled={chatLoading}
                  className="w-7 h-7 rounded bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center border border-zinc-800 text-zinc-300 hover:text-white transition-all disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
