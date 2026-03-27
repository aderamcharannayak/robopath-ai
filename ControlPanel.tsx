import { useState } from "react";
import { Search, MapPin, Target, Shield, Play, Pause, RotateCcw, Gauge, Bot, Plus } from "lucide-react";
import { motion } from "framer-motion";

interface ControlPanelProps {
  mode: "start" | "end" | "obstacle";
  setMode: (m: "start" | "end" | "obstacle") => void;
  onSearch: (query: string) => void;
  onRun: () => void;
  onStartSim: () => void;
  onPauseSim: () => void;
  onResetSim: () => void;
  speed: number;
  setSpeed: (s: number) => void;
  isRunning: boolean;
  isPaused: boolean;
  onAddRobot: () => void;
  robotCount: number;
  onUseMyLocation: () => void;
  isRouting?: boolean;
}

export default function ControlPanel({
  mode, setMode, onSearch, onRun, onStartSim, onPauseSim, onResetSim,
  speed, setSpeed, isRunning, isPaused, onAddRobot, robotCount, onUseMyLocation,
  isRouting = false,
}: ControlPanelProps) {
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: "linear-gradient(135deg, #06B6D4, #EC4899)" }}>
          🤖
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-gradient">RoboPath AI</h1>
          <p className="text-xs text-muted-foreground">Intelligent Navigation</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-panel p-3">
        <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 block">Search Location</label>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search city or place..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch(query)}
          />
          <button className="cyber-btn px-3" onClick={() => onSearch(query)}>
            <Search className="w-4 h-4" />
          </button>
        </div>
        <button onClick={onUseMyLocation} className="mt-2 w-full text-xs text-primary hover:underline flex items-center gap-1 justify-center">
          <MapPin className="w-3 h-3" /> Use my location
        </button>
      </div>

      {/* Mode Selection */}
      <div className="glass-panel p-3">
        <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 block">Click Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "start" as const, label: "Start", icon: MapPin, active: "glow-cyan" },
            { key: "end" as const, label: "End", icon: Target, active: "glow-magenta" },
            { key: "obstacle" as const, label: "Block", icon: Shield, active: "" },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs font-semibold transition-all ${
                mode === key ? "bg-primary/20 text-primary border border-primary/50" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Calculate */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRun}
        disabled={isRouting}
        className="cyber-btn w-full py-3 text-base font-bold tracking-widest disabled:opacity-50 disabled:pointer-events-none"
      >
        {isRouting ? "⏳ COMPUTING…" : "⚡ COMPARE ALGORITHMS (Dijkstra / A* / BFS)"}
      </motion.button>

      {/* Simulation Controls */}
      <div className="glass-panel p-3">
        <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 block">Robot Simulation</label>
        <div className="flex gap-2 mb-3">
          <button onClick={onStartSim} disabled={isRunning && !isPaused} className="cyber-btn flex-1 flex items-center justify-center gap-1 disabled:opacity-40">
            <Play className="w-4 h-4" /> Start
          </button>
          <button onClick={onPauseSim} disabled={!isRunning} className="cyber-btn cyber-btn-magenta flex-1 flex items-center justify-center gap-1 disabled:opacity-40">
            <Pause className="w-4 h-4" /> Pause
          </button>
          <button onClick={onResetSim} className="bg-muted/50 text-foreground px-3 py-2 rounded-md hover:bg-muted transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Speed</span>
          <div className="flex gap-1 flex-1 justify-end">
            {[{ v: 200, l: "Fast" }, { v: 500, l: "Med" }, { v: 1000, l: "Slow" }].map(({ v, l }) => (
              <button
                key={v}
                onClick={() => setSpeed(v)}
                className={`text-xs px-2 py-1 rounded ${speed === v ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Robot */}
      <div className="glass-panel p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Robots: {robotCount}</span>
          </div>
          <button onClick={onAddRobot} className="cyber-btn px-2 py-1 text-xs flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
