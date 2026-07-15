import React, { useState } from "react";
import { ShieldAlert, AlertTriangle, CheckCircle, Activity, Thermometer, Database, Gauge } from "lucide-react";

export default function SafetyDashboard() {
  // Input fields for the Live Safety Limit Validator simulation
  const [primaryPressure, setPrimaryPressure] = useState<number>(15.7);
  const [primaryOutletTemp, setPrimaryOutletTemp] = useState<number>(321);
  const [przWaterLevel, setPrzWaterLevel] = useState<number>(7100);
  const [sgWaterLevel, setSgWaterLevel] = useState<number>(1950);

  // Function to evaluate status of parameters based on the Technical Specification
  const evaluatePrimaryPressure = (p: number) => {
    if (p >= 17.6) {
      return {
        status: "CRITICAL",
        text: "Safety Limit Exceeded! Immediate Reactor Trip (EP) required.",
        badgeColor: "bg-red-500/25 text-red-300 border-red-500/30",
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />
      };
    }
    if (p >= 16.5 || p <= 14.5) {
      return {
        status: "ALERT",
        text: "Normal Limit Exceeded. Unscheduled power reduction to 50% Nnom required. If not restored in 10 minutes, shutdown reactor.",
        badgeColor: "bg-amber-500/25 text-amber-300 border-amber-500/30",
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
      };
    }
    return {
      status: "NORMAL",
      text: "Normal operating range (15.7 ± 0.3 MPa). Parameters are stable.",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25",
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />
    };
  };

  const evaluatePrimaryTemp = (t: number) => {
    if (t >= 332) {
      return {
        status: "CRITICAL",
        text: "Safety Limit Exceeded! Immediate Reactor Trip (EP) trigger at 332 °C.",
        badgeColor: "bg-red-500/25 text-red-300 border-red-500/30",
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />
      };
    }
    if (t >= 326) {
      return {
        status: "ALERT",
        text: "Normal Limit Exceeded (321 ± 2 °C). Unscheduled power reduction to 50% Nnom required.",
        badgeColor: "bg-amber-500/25 text-amber-300 border-amber-500/30",
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
      };
    }
    return {
      status: "NORMAL",
      text: "Normal operating range (321 ± 2 °C). Coolant temperatures are nominal.",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25",
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />
    };
  };

  const evaluatePrzLevel = (lvl: number) => {
    if (lvl <= 3000 || lvl >= 12400) {
      return {
        status: "CRITICAL",
        text: "Safety Limit Exceeded! Emergency Reactor Trip (EP) trigger (<=3000mm or >=12400mm).",
        badgeColor: "bg-red-500/25 text-red-300 border-red-500/30",
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />
      };
    }
    if (lvl <= 4500 || lvl >= 9500) {
      return {
        status: "ALERT",
        text: "Normal Limit Exceeded. Unscheduled power reduction to 50% Nnom required (Normal is 7100 ± 200mm).",
        badgeColor: "bg-amber-500/25 text-amber-300 border-amber-500/30",
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
      };
    }
    return {
      status: "NORMAL",
      text: "Normal operating range. Pressurizer levels are within safe boundaries.",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25",
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />
    };
  };

  const evaluateSgLevel = (lvl: number) => {
    if (lvl <= 1250 || lvl >= 2400) {
      return {
        status: "CRITICAL",
        text: "Safety Limit Exceeded! Emergency Reactor Trip (EP) trigger (<=1250mm or >=2400mm).",
        badgeColor: "bg-red-500/25 text-red-300 border-red-500/30",
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />
      };
    }
    if (lvl <= 1650 || lvl >= 2250) {
      return {
        status: "ALERT",
        text: "Normal Limit Exceeded. Unscheduled power reduction to 50% Nnom required (Normal is 1950 ± 100mm).",
        badgeColor: "bg-amber-500/25 text-amber-300 border-amber-500/30",
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
      };
    }
    return {
      status: "NORMAL",
      text: "Normal operating range. Steam generator levels are nominal.",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25",
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />
    };
  };

  const pressStatus = evaluatePrimaryPressure(primaryPressure);
  const tempStatus = evaluatePrimaryTemp(primaryOutletTemp);
  const przStatus = evaluatePrzLevel(przWaterLevel);
  const sgStatus = evaluateSgLevel(sgWaterLevel);

  return (
    <div className="flex flex-col gap-6 text-slate-100" id="safety-dashboard">
      {/* Simulation Validator Panel */}
      <div className="p-5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">
            Operations Parameter Validator
          </h2>
          <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase ml-auto">
            Live Spec Checker
          </span>
        </div>
        
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Input actual or simulated sensor readings below. The validator runs the values directly against the limits and conditions of safe operation specified in Chapter 4 of the Technical Specification.
        </p>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1.5 shadow-md">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-slate-400" /> Primary Pressure
            </label>
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="number"
                step="0.1"
                value={primaryPressure}
                onChange={(e) => setPrimaryPressure(parseFloat(e.target.value) || 0)}
                className="w-full text-sm font-semibold font-mono border-b border-white/15 focus:border-indigo-500 focus:outline-none bg-transparent text-white py-1"
                id="pressure-sim-input"
              />
              <span className="text-xs font-mono text-slate-400">MPa</span>
            </div>
            <div className={`mt-2 py-1 px-2 rounded text-[10px] border font-sans flex items-center gap-1.5 ${pressStatus.badgeColor}`}>
              {pressStatus.icon}
              <span className="font-bold">{pressStatus.status}</span>
            </div>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1.5 shadow-md">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-slate-400" /> Core Outlet Temp
            </label>
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="number"
                step="1"
                value={primaryOutletTemp}
                onChange={(e) => setPrimaryOutletTemp(parseInt(e.target.value, 10) || 0)}
                className="w-full text-sm font-semibold font-mono border-b border-white/15 focus:border-indigo-500 focus:outline-none bg-transparent text-white py-1"
                id="temp-sim-input"
              />
              <span className="text-xs font-mono text-slate-400">°C</span>
            </div>
            <div className={`mt-2 py-1 px-2 rounded text-[10px] border font-sans flex items-center gap-1.5 ${tempStatus.badgeColor}`}>
              {tempStatus.icon}
              <span className="font-bold">{tempStatus.status}</span>
            </div>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1.5 shadow-md">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-slate-400" /> Pressurizer Level
            </label>
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="number"
                step="50"
                value={przWaterLevel}
                onChange={(e) => setPrzWaterLevel(parseInt(e.target.value, 10) || 0)}
                className="w-full text-sm font-semibold font-mono border-b border-white/15 focus:border-indigo-500 focus:outline-none bg-transparent text-white py-1"
                id="prz-sim-input"
              />
              <span className="text-xs font-mono text-slate-400">mm</span>
            </div>
            <div className={`mt-2 py-1 px-2 rounded text-[10px] border font-sans flex items-center gap-1.5 ${przStatus.badgeColor}`}>
              {przStatus.icon}
              <span className="font-bold">{przStatus.status}</span>
            </div>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1.5 shadow-md">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-slate-400" /> Steam Gen Level
            </label>
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="number"
                step="50"
                value={sgWaterLevel}
                onChange={(e) => setSgWaterLevel(parseInt(e.target.value, 10) || 0)}
                className="w-full text-sm font-semibold font-mono border-b border-white/15 focus:border-indigo-500 focus:outline-none bg-transparent text-white py-1"
                id="sg-sim-input"
              />
              <span className="text-xs font-mono text-slate-400">mm</span>
            </div>
            <div className={`mt-2 py-1 px-2 rounded text-[10px] border font-sans flex items-center gap-1.5 ${sgStatus.badgeColor}`}>
              {sgStatus.icon}
              <span className="font-bold">{sgStatus.status}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Operational Directives based on simulation inputs */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            Real-Time Operations Directives
          </h4>
          <div className="space-y-2">
            {[
              { label: "Reactor Coolant Pressure", ...pressStatus },
              { label: "Core Coolant Outlet Temperature", ...tempStatus },
              { label: "Pressurizer Liquid Inventory", ...przStatus },
              { label: "Secondary Loop SG Inventory", ...sgStatus }
            ].map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs border-b border-white/5 last:border-0 pb-2 last:pb-0">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 bg-indigo-400 shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold text-slate-200">{d.label}: </span>
                  <span className={`px-1 rounded-sm text-[10px] font-mono border ${d.badgeColor}`}>{d.status}</span>
                  <p className="text-slate-400 mt-0.5 leading-relaxed text-[11px]">{d.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Structured Technical Specifications Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-tables-grid">
        {/* Table 4.1: Safety Limits */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
          <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-white/10">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Reactor Safety Limits (Table 4.1)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/5 text-slate-400 border-b border-white/10">
                  <th className="py-2 px-3 font-semibold uppercase tracking-wider">Parameter</th>
                  <th className="py-2 px-3 font-semibold uppercase tracking-wider text-right">Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                <tr>
                  <td className="py-2 px-3 font-sans">Core Fuel Element (FE) Cladding Temp</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-400">≤ 1200 °C</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Fuel Pellet Center Temperature (Fresh)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-400">≤ 2800 °C</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Fuel Pellet Center Temperature (Burned-up)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-400">≤ 2500 °C</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Primary circuit pressure (coolant &gt; 140°C)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-400">≤ 17.6 MPa</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Primary circuit pressure (coolant &lt; 140°C)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-400">≤ 4.4 MPa</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Secondary Steam Line Pressure Limit</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-400">≤ 8.6 MPa</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
            Note: Safe operating values from Technical Specification of Safe Operation of Rooppur NPP Unit 1, Rev 2.
          </p>
        </div>

        {/* Table 4.4: Normal Operation Parameters */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
          <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-white/10">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Normal Operation parameters (Table 4.4)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/5 text-slate-400 border-b border-white/10">
                  <th className="py-2 px-3 font-semibold uppercase tracking-wider">Parameter</th>
                  <th className="py-2 px-3 font-semibold uppercase tracking-wider text-right">Nominal Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                <tr>
                  <td className="py-2 px-3 font-sans">Thermal Power of the Reactor (Nnom)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">1200 MW</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Primary pressure (at reactor outlet)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">15.7 ± 0.3 MPa</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Coolant temp at reactor inlet (at 100% Nnom)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">291 ± 2 °C</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Coolant temp at reactor outlet (at 100% Nnom)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">321 ± 2 °C</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Primary Coolant Flow Rate (2 RCPS operating)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">≥ 45,000 t/h</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Water Level in the Pressurizer (at 100% Nnom)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">7100 ± 200 mm</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Main Steam Secondary pressure (at 100% Nnom)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">4.6 ± 0.2 MPa</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans">Water level in the Steam Generator (Normal)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">1950 ± 100 mm</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
            Note: Continuous water chemistry metrics (such as chloride and sodium limits &lt;0.1 mg/kg) must be strictly sustained.
          </p>
        </div>
      </div>
    </div>
  );
}
