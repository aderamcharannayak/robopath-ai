import { PathResult } from "@/lib/pathfinding";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Route, Clock, BarChart3, History } from "lucide-react";

interface DashboardProps {
  results: PathResult[];
  bestAlgorithm: string;
  history: { algorithm: string; distance: number; time: number }[];
}

const ALGO_COLORS: Record<string, string> = {
  "Dijkstra": "#06B6D4",
  "A*": "#EC4899",
  "BFS": "#A855F7",
};

export default function Dashboard({ results, bestAlgorithm, history }: DashboardProps) {
  if (results.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-muted-foreground">
        <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm text-center">Set start & destination points, then calculate paths to see results here.</p>
      </div>
    );
  }

  const best = results.find((r) => r.algorithm === bestAlgorithm);

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      {/* Best Algorithm */}
      {best && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-4"
          style={{ borderColor: ALGO_COLORS[bestAlgorithm], borderWidth: 1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5" style={{ color: ALGO_COLORS[bestAlgorithm] }} />
            <span className="font-display text-sm font-bold uppercase tracking-wider" style={{ color: ALGO_COLORS[bestAlgorithm] }}>
              Best: {bestAlgorithm}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="stat-value text-lg" style={{ color: ALGO_COLORS[bestAlgorithm] }}>{best.distance.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="stat-value text-lg" style={{ color: ALGO_COLORS[bestAlgorithm] }}>{best.executionTime.toFixed(2)}ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nodes</p>
              <p className="stat-value text-lg" style={{ color: ALGO_COLORS[bestAlgorithm] }}>{best.nodesExplored}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* All Results */}
      <div className="space-y-2">
        <h3 className="font-display text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Route className="w-4 h-4" /> Algorithm Comparison
        </h3>
        <AnimatePresence>
          {results.map((r, i) => (
            <motion.div
              key={r.algorithm}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`glass-panel p-3 ${r.algorithm === bestAlgorithm ? "ring-1" : ""}`}
              style={r.algorithm === bestAlgorithm ? { borderColor: ALGO_COLORS[r.algorithm] } : {}}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: ALGO_COLORS[r.algorithm] }} />
                  <span className="font-semibold text-sm">{r.algorithm}</span>
                </div>
                {r.path.length === 0 && <span className="text-xs text-destructive">No path</span>}
              </div>
              {r.path.length > 0 && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Dist:</span> <span className="font-semibold">{r.distance.toFixed(1)}</span></div>
                  <div><span className="text-muted-foreground">Time:</span> <span className="font-semibold">{r.executionTime.toFixed(2)}ms</span></div>
                  <div><span className="text-muted-foreground">Nodes:</span> <span className="font-semibold">{r.nodesExplored}</span></div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <History className="w-4 h-4" /> Navigation History
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {history.slice(-10).reverse().map((h, i) => (
              <div key={i} className="flex justify-between text-xs bg-muted/20 px-3 py-1.5 rounded">
                <span style={{ color: ALGO_COLORS[h.algorithm] }}>{h.algorithm}</span>
                <span className="text-muted-foreground">{h.distance.toFixed(1)} units • {h.time.toFixed(2)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
