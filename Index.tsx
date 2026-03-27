import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronLeft } from "lucide-react";
import MapView from "@/components/MapView";
import ControlPanel from "@/components/ControlPanel";
import Dashboard from "@/components/Dashboard";
import type { PathResult } from "@/lib/pathfinding";
import { fetchAlgorithmComparisonRoutes } from "@/services/roadAlgorithmRouting";
import { toast } from "sonner";

/** Pathfinding algorithms (road corridor) → map line colors. */
const ALGO_COLORS: Record<string, string> = {
  Dijkstra: "#06B6D4",
  "A*": "#EC4899",
  BFS: "#A855F7",
};

interface Obstacle {
  lat: number;
  lng: number;
  radius: number;
}

export default function Index() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [mode, setMode] = useState<"start" | "end" | "obstacle">("start");
  const [startPos, setStartPos] = useState<[number, number] | null>(null);
  const [endPos, setEndPos] = useState<[number, number] | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [results, setResults] = useState<PathResult[]>([]);
  const [bestAlgorithm, setBestAlgorithm] = useState("");
  const [paths, setPaths] = useState<{ path: [number, number][]; color: string; best: boolean }[]>([]);
  const [robotPos, setRobotPos] = useState<[number, number] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<{ algorithm: string; distance: number; computeMs: number }[]>([]);
  const [robotCount, setRobotCount] = useState(1);
  const [isRouting, setIsRouting] = useState(false);

  const simRef = useRef<{ cancel: boolean; paused: boolean }>({ cancel: false, paused: false });
  const bestPathRef = useRef<[number, number][]>([]);

  // Geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(loc);
          toast.success("Location detected!");
        },
        () => toast.info("Enable location for better experience")
      );
    }
  }, []);

  const updatePathsFromResults = (allResults: PathResult[], errors: string[]) => {
    if (errors.length) {
      toast.warning(errors.join(" · "));
    }
    const valid = allResults.filter((r) => r.path.length > 0);
    if (valid.length === 0) {
      setPaths([]);
      setResults([]);
      setBestAlgorithm("");
      bestPathRef.current = [];
      return;
    }

    const best = valid.reduce((a, b) => (a.distance <= b.distance ? a : b));
    setBestAlgorithm(best.algorithm);
    setResults(allResults);

    const newPaths = allResults
      .filter((r) => r.path.length > 0)
      .map((r) => ({
        path: r.path,
        color: ALGO_COLORS[r.algorithm] || "#fff",
        best: r.algorithm === best.algorithm,
      }));
    setPaths(newPaths);
    bestPathRef.current = newPaths.find((p) => p.best)?.path || [];
  };

  /** Recompute OSRM corridor + Dijkstra / A* / BFS. */
  const refreshRoadRoutes = useCallback(
    async (showToast: boolean) => {
      if (!startPos || !endPos) return;
      setIsRouting(true);
      try {
        const { results, errors } = await fetchAlgorithmComparisonRoutes(startPos, endPos, obstacles);
        updatePathsFromResults(results, errors);
        if (results.length && showToast) {
          toast.info("Routes refreshed (road corridor + algorithms).");
        }
        if (results.length === 0 && errors.length) {
          toast.error(errors.join(" "));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Routing failed");
        setPaths([]);
        setResults([]);
      } finally {
        setIsRouting(false);
      }
    },
    [startPos, endPos, obstacles]
  );

  /** Re-run OSRM with obstacle detours when start, end, or obstacles change (debounced). */
  useEffect(() => {
    if (!startPos || !endPos) return;
    const id = window.setTimeout(() => {
      void refreshRoadRoutes(false);
    }, 420);
    return () => window.clearTimeout(id);
  }, [obstacles, startPos, endPos, refreshRoadRoutes]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (mode === "start") {
        setStartPos([lat, lng]);
        toast.success("Start point set");
      } else if (mode === "end") {
        setEndPos([lat, lng]);
        toast.success("Destination set");
      } else {
        setObstacles((prev) => [...prev, { lat, lng, radius: 0.002 }]);
        toast("Obstacle added — routes will recompute around it", { icon: "🚧" });
      }
    },
    [mode]
  );

  const handleRun = async () => {
    if (!startPos || !endPos) {
      toast.error("Set both start and destination points!");
      return;
    }
    setIsRouting(true);
    try {
      const { results, errors } = await fetchAlgorithmComparisonRoutes(startPos, endPos, obstacles);
      updatePathsFromResults(results, errors);

      const valid = results.filter((r) => r.path.length > 0);
      if (valid.length === 0) {
        if (!errors.length) {
          toast.error("No routes found.");
        }
        return;
      }

      const best = valid.reduce((a, b) => (a.distance <= b.distance ? a : b));
      setHistory((prev) => [
        ...prev,
        {
          algorithm: best.algorithm,
          distance: best.distance,
          computeMs: best.executionTime,
        },
      ]);
      toast.success(`Shortest path: ${best.algorithm} (${formatDistanceLabel(best.distance)})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Routing failed");
      setPaths([]);
      setResults([]);
    } finally {
      setIsRouting(false);
    }
  };

  function formatDistanceLabel(meters: number) {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
  }

  const handleStartSim = async () => {
    let path = bestPathRef.current;
    if (path.length === 0) {
      toast.error("Compare algorithms first (compute routes).");
      return;
    }
    const MAX_SIM_STEPS = 400;
    if (path.length > MAX_SIM_STEPS) {
      const stride = Math.ceil(path.length / MAX_SIM_STEPS);
      path = path.filter((_, i) => i % stride === 0 || i === path.length - 1);
    }
    setIsRunning(true);
    setIsPaused(false);
    simRef.current = { cancel: false, paused: false };

    for (let i = 0; i < path.length; i++) {
      if (simRef.current.cancel) break;
      while (simRef.current.paused) {
        await new Promise((r) => setTimeout(r, 100));
        if (simRef.current.cancel) break;
      }
      if (simRef.current.cancel) break;
      setRobotPos(path[i]);
      await new Promise((r) => setTimeout(r, speed));
    }

    if (!simRef.current.cancel) {
      toast.success("Robot reached destination! 🎉");
    }
    setIsRunning(false);
  };

  const handlePauseSim = () => {
    simRef.current.paused = !simRef.current.paused;
    setIsPaused(!isPaused);
  };

  const handleResetSim = () => {
    simRef.current.cancel = true;
    setRobotPos(null);
    setIsRunning(false);
    setIsPaused(false);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const pos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        if (mode === "start") {
          setStartPos(pos);
          toast.success(`Start: ${data[0].display_name.split(",")[0]}`);
        } else {
          setEndPos(pos);
          toast.success(`Dest: ${data[0].display_name.split(",")[0]}`);
        }
        setUserLocation(pos); // fly to searched location
      } else {
        toast.error("Location not found");
      }
    } catch {
      toast.error("Search failed");
    }
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        setStartPos(loc);
        toast.success("Using your location as start");
      });
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      {/* Sidebar */}
      <motion.div
        animate={{ width: sidebarOpen ? 320 : 0 }}
        transition={{ duration: 0.3 }}
        className="h-full overflow-hidden flex-shrink-0 border-r border-border bg-card/40 backdrop-blur-xl"
      >
        <div className="w-[320px] h-full">
          <ControlPanel
            mode={mode}
            setMode={setMode}
            onSearch={handleSearch}
            onRun={handleRun}
            isRouting={isRouting}
            onStartSim={handleStartSim}
            onPauseSim={handlePauseSim}
            onResetSim={handleResetSim}
            speed={speed}
            setSpeed={setSpeed}
            isRunning={isRunning}
            isPaused={isPaused}
            onAddRobot={() => setRobotCount((c) => c + 1)}
            robotCount={robotCount}
            onUseMyLocation={handleUseMyLocation}
          />
        </div>
      </motion.div>

      {/* Toggle Sidebar */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-2 z-[1000] bg-card/80 backdrop-blur-sm border border-border rounded-md p-1.5 hover:bg-muted transition-colors"
        style={sidebarOpen ? { left: 322 } : {}}
      >
        {sidebarOpen ? <PanelLeftClose className="w-4 h-4 text-primary" /> : <PanelLeftOpen className="w-4 h-4 text-primary" />}
      </button>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          startPos={startPos}
          endPos={endPos}
          obstacles={obstacles}
          paths={paths}
          robotPos={robotPos}
          mode={mode}
          onMapClick={handleMapClick}
          userLocation={userLocation}
        />

        {/* Status Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-4 py-2 flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">Mode:</span>
          <span className={`font-semibold ${mode === "start" ? "text-primary" : mode === "end" ? "text-secondary" : "text-destructive"}`}>
            {mode === "start" ? "📍 Set Start" : mode === "end" ? "🎯 Set Destination" : "🚧 Add Obstacle"}
          </span>
          {isRunning && (
            <span className="text-primary animate-pulse-glow flex items-center gap-1">
              ● Robot Moving
            </span>
          )}
        </div>
      </div>

      {/* Dashboard Toggle */}
      <button
        onClick={() => setDashboardOpen(!dashboardOpen)}
        className="absolute top-4 right-2 z-[1000] bg-card/80 backdrop-blur-sm border border-border rounded-md p-1.5 hover:bg-muted transition-colors"
        style={dashboardOpen ? { right: 322 } : {}}
      >
        {dashboardOpen ? <ChevronRight className="w-4 h-4 text-primary" /> : <ChevronLeft className="w-4 h-4 text-primary" />}
      </button>

      {/* Dashboard */}
      <motion.div
        animate={{ width: dashboardOpen ? 320 : 0 }}
        transition={{ duration: 0.3 }}
        className="h-full overflow-hidden flex-shrink-0 border-l border-border bg-card/40 backdrop-blur-xl"
      >
        <div className="w-[320px] h-full">
          <Dashboard results={results} bestAlgorithm={bestAlgorithm} history={history} />
        </div>
      </motion.div>
    </div>
  );
}
