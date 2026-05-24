"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Terminal, BarChart2, Shield, Settings, Play, Home, CornerDownLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface CommandItem {
  icon: React.ReactNode;
  label: string;
  category: string;
  action: () => void;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  // Toggle palette on Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const triggerSimulation = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/webhooks/simulate", {
        method: "POST",
      });
      const data = await res.json();
      if (data.pr_id) {
        router.push(`/pr/${data.pr_id}`);
      }
    } catch (err) {
      // If backend is not running, go to a mock page
      router.push("/pr/42");
    }
  };

  const commands: CommandItem[] = [
    {
      category: "Navigation",
      label: "Go to Landing Page",
      icon: <Home className="w-4 h-4 text-zinc-400" />,
      action: () => router.push("/"),
    },
    {
      category: "Navigation",
      label: "Go to Dashboard",
      icon: <Terminal className="w-4 h-4 text-zinc-400" />,
      action: () => router.push("/dashboard"),
    },
    {
      category: "Navigation",
      label: "View Security Center",
      icon: <Shield className="w-4 h-4 text-zinc-400" />,
      action: () => router.push("/dashboard?tab=security"),
    },
    {
      category: "Navigation",
      label: "View Analytics",
      icon: <BarChart2 className="w-4 h-4 text-zinc-400" />,
      action: () => router.push("/analytics"),
    },
    {
      category: "Actions",
      label: "Simulate GitHub PR Webhook (Authentication Service)",
      icon: <Play className="w-4 h-4 text-indigo-400" />,
      action: () => triggerSimulation(),
    },
    {
      category: "Settings",
      label: "Configure Project Settings",
      icon: <Settings className="w-4 h-4 text-zinc-400" />,
      action: () => router.push("/dashboard?tab=settings"),
    },
  ];

  // Filter commands by search string
  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  // Keyboard navigation inside list
  useEffect(() => {
    if (!isOpen) return;
    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          setIsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [isOpen, selectedIndex, filtered]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            ref={modalRef}
            className="w-full max-w-xl overflow-hidden glass-panel rounded-xl border border-zinc-800 shadow-2xl bg-zinc-950/95"
          >
            {/* Input box */}
            <div className="flex items-center gap-3 px-4 border-b border-zinc-800/80">
              <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Type a command or search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full h-12 bg-transparent text-sm text-zinc-200 outline-none placeholder-zinc-500"
                autoFocus
              />
              <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-500 rounded px-1.5 py-0.5 select-none font-mono">
                ESC
              </span>
            </div>

            {/* List */}
            <div className="max-h-[340px] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                  No commands found matching &quot;{search}&quot;
                </div>
              ) : (
                Object.entries(
                  filtered.reduce((groups, item) => {
                    const group = item.category;
                    if (!groups[group]) groups[group] = [];
                    groups[group].push(item);
                    return groups;
                  }, {} as Record<string, CommandItem[]>)
                ).map(([groupName, groupItems]) => (
                  <div key={groupName} className="mb-2">
                    {/* Header */}
                    <div className="px-4 py-1 text-[10px] font-medium tracking-wider text-zinc-500 uppercase font-mono select-none">
                      {groupName}
                    </div>
                    {/* Items */}
                    {groupItems.map((item) => {
                      const absoluteIndex = filtered.indexOf(item);
                      const isSelected = absoluteIndex === selectedIndex;
                      return (
                        <div
                          key={item.label}
                          onClick={() => {
                            item.action();
                            setIsOpen(false);
                          }}
                          className={`flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-zinc-850 bg-zinc-900 text-zinc-100 border border-zinc-850"
                              : "text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900/40 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {item.icon}
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                              Select <CornerDownLeft className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/30 border-t border-zinc-800/80 text-[10px] text-zinc-500 font-mono select-none">
              <span>Use ↑↓ to navigate</span>
              <span>Press enter to execute</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
