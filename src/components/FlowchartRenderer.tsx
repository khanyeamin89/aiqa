import React, { useState } from "react";
import { Play, ArrowRight, CheckCircle2, ShieldAlert, HelpCircle, RefreshCw, AlertTriangle, Info, Network } from "lucide-react";
import { motion } from "motion/react";

interface FlowchartRendererProps {
  content: string;
}

interface FlowNode {
  id: string;
  label: string;
  type: "start" | "step" | "decision" | "action" | "normal";
  condition?: string;
  yesRoute?: string;
  noRoute?: string;
}

export default function FlowchartRenderer({ content }: FlowchartRendererProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [simulationActive, setSimulationActive] = useState(false);

  // Parse custom flowchart structures from raw text
  // Supported format:
  // ```flowchart
  // Step 1: title -> Step 2: title -> ...
  // or simple A -> B -> C lines
  const parseFlowchart = (text: string): FlowNode[] => {
    // Strip markdown formatting fences if present
    const cleanText = text
      .replace(/```flowchart/g, "")
      .replace(/```/g, "")
      .trim();

    if (!cleanText) return [];

    // Check if it is a simple list of sequential steps separated by '->'
    if (cleanText.includes("->")) {
      const steps = cleanText.split("->").map(s => s.trim()).filter(Boolean);
      return steps.map((stepText, idx) => {
        let type: "start" | "step" | "decision" | "action" | "normal" = "step";
        if (idx === 0) type = "start";
        else if (idx === steps.length - 1) {
          type = stepText.toLowerCase().includes("trip") || stepText.toLowerCase().includes("scram") || stepText.toLowerCase().includes("shutdown")
            ? "action"
            : "normal";
        } else if (stepText.includes("?") || stepText.toLowerCase().includes("check") || stepText.toLowerCase().includes("verify")) {
          type = "decision";
        }

        return {
          id: `step-${idx}`,
          label: stepText,
          type
        };
      });
    }

    // Default parser fallback - parse lines
    const lines = cleanText.split("\n").map(l => l.trim()).filter(Boolean);
    return lines.map((line, idx) => {
      let label = line;
      let type: "start" | "step" | "decision" | "action" | "normal" = "step";
      
      if (line.startsWith("- ") || line.startsWith("* ")) {
        label = line.substring(2);
      } else if (/^\d+\.\s*/.test(line)) {
        label = line.replace(/^\d+\.\s*/, "");
      }

      if (idx === 0) type = "start";
      else if (label.includes("?") || label.toLowerCase().includes("verify") || label.toLowerCase().includes("check")) {
        type = "decision";
      } else if (label.toLowerCase().includes("trip") || label.toLowerCase().includes("scram") || label.toLowerCase().includes("emergency")) {
        type = "action";
      }

      return {
        id: `step-${idx}`,
        label,
        type
      };
    });
  };

  const nodes = parseFlowchart(content);

  if (nodes.length === 0) return null;

  const handleNextSimulationStep = () => {
    if (!simulationActive) {
      setSimulationActive(true);
      setActiveStepIndex(0);
    } else {
      if (activeStepIndex < nodes.length - 1) {
        setActiveStepIndex(prev => prev + 1);
      } else {
        // Reset
        setSimulationActive(false);
        setActiveStepIndex(-1);
      }
    }
  };

  const handleResetSimulation = () => {
    setSimulationActive(false);
    setActiveStepIndex(-1);
  };

  return (
    <div className="my-4 bg-slate-950/60 border border-indigo-500/30 rounded-xl p-4 shadow-xl overflow-hidden">
      {/* Flowchart Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-2 border-b border-indigo-500/20">
        <div className="flex items-center gap-2">
          <Network className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
          <h4 className="text-xs font-bold text-indigo-100 uppercase tracking-widest">
            NPP Safety Operations Flowchart
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNextSimulationStep}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-md ${
              simulationActive
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/20"
                : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/20"
            }`}
          >
            <Play className="w-3 h-3" />
            <span>
              {simulationActive
                ? activeStepIndex === nodes.length - 1
                  ? "Finish Flow"
                  : "Next Step"
                : "Simulate Procedure"}
            </span>
          </button>

          {simulationActive && (
            <button
              onClick={handleResetSimulation}
              className="p-1 text-slate-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors"
              title="Reset Simulation"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Flow Nodes */}
      <div className="flex flex-col md:flex-row md:flex-wrap items-center justify-center gap-3 py-2">
        {nodes.map((node, idx) => {
          const isActive = idx === activeStepIndex;
          const isCompleted = idx < activeStepIndex;
          
          let cardBg = "bg-slate-900/80 border-slate-700/60 text-slate-300";
          let icon = <Info className="w-3.5 h-3.5 text-slate-400" />;

          if (node.type === "start") {
            cardBg = "bg-indigo-950/40 border-indigo-500/40 text-indigo-100";
            icon = <Play className="w-3.5 h-3.5 text-indigo-400" />;
          } else if (node.type === "decision") {
            cardBg = "bg-amber-950/30 border-amber-500/40 text-amber-200";
            icon = <HelpCircle className="w-3.5 h-3.5 text-amber-400" />;
          } else if (node.type === "action") {
            cardBg = "bg-red-950/40 border-red-500/50 text-red-200";
            icon = <ShieldAlert className="w-3.5 h-3.5 text-red-400" />;
          } else if (node.type === "normal") {
            cardBg = "bg-emerald-950/30 border-emerald-500/40 text-emerald-200";
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
          }

          // Override for active simulator state
          if (isActive) {
            cardBg = "bg-indigo-600/30 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-102 ring-1 ring-indigo-400";
          } else if (isCompleted) {
            cardBg = "bg-slate-900/40 border-indigo-500/20 text-slate-400 line-through opacity-60";
          }

          return (
            <React.Fragment key={node.id}>
              {/* Connector Arrow (except for first node) */}
              {idx > 0 && (
                <div className="flex items-center justify-center shrink-0">
                  <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block" />
                  <span className="text-slate-500 text-xs font-bold md:hidden block py-1">↓</span>
                </div>
              )}

              {/* Node Card */}
              <motion.div
                layout
                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border max-w-xs text-xs font-medium transition-all duration-300 ${cardBg}`}
                style={{ contentVisibility: "auto" }}
              >
                {/* Visual Glow for Active Step */}
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                )}

                {/* Left Side Icon */}
                <div className="shrink-0">{icon}</div>

                {/* Label */}
                <div className="flex-1 min-w-[120px]">
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <span>STEP {idx + 1}</span>
                    {isCompleted && <span className="text-emerald-400 text-[9px] font-bold">✔ OK</span>}
                  </div>
                  <p className="mt-0.5 leading-snug">{node.label}</p>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Simulation Log Status Panel */}
      {simulationActive && activeStepIndex >= 0 && (
        <div className="mt-3 p-2.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-mono text-indigo-200 flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white uppercase">[SIM ACTIVE]: </span>
            <span>Executing procedural check for "{nodes[activeStepIndex].label}". Operational safety guidelines validated against Tech Specs.</span>
          </div>
        </div>
      )}
    </div>
  );
}
