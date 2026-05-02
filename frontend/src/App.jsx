/**
 * App.jsx — BB84 Quantum Key Distribution Simulator
 *
 * Full single-page application with:
 *   - Simulation control panel
 *   - Protocol walkthrough visualization
 *   - QBER chart (sweep analysis)
 *   - Run history log
 */

import React, { useState, useEffect } from "react";
import QubitTable   from "./components/QubitTable";
import QBERChart    from "./components/QBERChart";
import ResultsPanel from "./components/ResultsPanel";
import HistoryTable from "./components/HistoryTable";
import { useSimulation } from "./hooks/useSimulation";

// ── Tiny helper components ──────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-700/40 bg-gray-900/60 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-gray-200 text-sm tracking-wide">{title}</span>
        </div>
        <span className="text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function SliderInput({ label, value, onChange, min, max, step = 1, format = v => v }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <label className="text-xs text-gray-400">{label}</label>
        <span className="text-xs font-mono text-cyan-300">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-cyan-500 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function ProtocolStep({ num, title, actor, desc, color }) {
  const colors = {
    alice : "border-cyan-500/40 bg-cyan-950/20 text-cyan-400",
    bob   : "border-purple-500/40 bg-purple-950/20 text-purple-400",
    eve   : "border-red-500/40 bg-red-950/20 text-red-400",
    both  : "border-green-500/40 bg-green-950/20 text-green-400",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold border border-current/30">{num}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{actor}</span>
      </div>
      <p className="text-xs font-semibold mb-0.5">{title}</p>
      <p className="text-[10px] opacity-60 leading-relaxed">{desc}</p>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [numQubits,      setNumQubits]      = useState(100);
  const [evePresent,     setEvePresent]     = useState(false);
  const [qberThreshold,  setQberThreshold]  = useState(0.11);
  const [activeTab,      setActiveTab]      = useState("simulate");
  const [sweepCountsInput, setSweepCountsInput] = useState("10, 25, 50, 100, 200, 500, 1000");
  const [sweepRuns, setSweepRuns] = useState(5);
  const [analysisThreshold, setAnalysisThreshold] = useState(0.11);
  const [analysisError, setAnalysisError] = useState(null);

  const {
    loading, sweepLoading,
    result, history, error,
    runSimulation, fetchHistory, runSweep, clearHistory,
  } = useSimulation();

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line
  }, []);

  // Merge sweep data for chart: run without Eve always as baseline
  const [sweepNoEve,   setSweepNoEve]   = useState(null);
  const [sweepWithEve, setSweepWithEve] = useState(null);

  const parseSweepCounts = () => {
    const parsed = sweepCountsInput
      .split(",")
      .map(v => Number(v.trim()))
      .filter(v => Number.isInteger(v) && v >= 10 && v <= 10000);

    return [...new Set(parsed)].sort((a, b) => a - b);
  };

  const handleRunSweep = async () => {
    setAnalysisError(null);
    const counts = parseSweepCounts();
    if (!counts.length) {
      setAnalysisError("Enter valid qubit counts (integers between 10 and 10000).");
      return;
    }

    const noEve = await runSweep({
      evePresent: false,
      qubitCounts: counts,
      runsPerCount: sweepRuns,
    });
    if (!noEve) {
      setAnalysisError("No-Eve sweep failed. Check backend logs and try again.");
      return;
    }

    const withEve = await runSweep({
      evePresent: true,
      qubitCounts: counts,
      runsPerCount: sweepRuns,
    });
    if (!withEve) {
      setAnalysisError("With-Eve sweep failed. Check backend logs and try again.");
      return;
    }

    setSweepNoEve(noEve);
    setSweepWithEve(withEve);
  };

  const exportSweepCsv = () => {
    if (!sweepNoEve || !sweepWithEve) return;

    const withEveMap = new Map(sweepWithEve.map(d => [d.num_qubits, d]));
    const rows = sweepNoEve.map(no => {
      const yes = withEveMap.get(no.num_qubits) || {};
      return [
        no.num_qubits,
        no.mean_qber, no.std_qber, no.min_qber, no.max_qber,
        yes.mean_qber ?? "", yes.std_qber ?? "", yes.min_qber ?? "", yes.max_qber ?? "",
      ].join(",");
    });

    const csv = [
      "num_qubits,no_eve_mean,no_eve_std,no_eve_min,no_eve_max,with_eve_mean,with_eve_std,with_eve_min,with_eve_max",
      ...rows,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qber_sweep_runs${sweepRuns}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const withEveAboveThreshold = sweepWithEve
    ? sweepWithEve.filter(p => p.mean_qber > analysisThreshold).length
    : 0;

  const handleSimulate = async () => {
    const res = await runSimulation({ numQubits, evePresent, qberThreshold });
    if (res) {
      fetchHistory();
      setActiveTab("results");
    }
  };

  const tabs = [
    { id: "simulate",  label: "⚛ Simulate" },
    { id: "results",   label: "📊 Results"  },
    { id: "analysis",  label: "📈 Analysis" },
    { id: "history",   label: "🗒 History"  },
    { id: "protocol",  label: "📘 Protocol" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>

      {/* ── Header ── */}
      <header className="border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-sm font-bold">⚛</div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">BB84 QKD Simulator</h1>
              <p className="text-[10px] text-gray-500">Quantum Key Distribution · Bennett–Brassard 1984</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-green-500"}`}></span>
            <span className="text-[10px] text-gray-500">{loading ? "Running..." : "Ready"}</span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 pb-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-xs rounded-t-lg transition-all ${
                  activeTab === t.id
                    ? "bg-gray-900 text-white border-t border-x border-gray-700/60"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ═══════════════════════════════ SIMULATE TAB ═══════════════════ */}
        {activeTab === "simulate" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Control panel */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-2xl border border-gray-700/40 bg-gray-900/60 p-5 space-y-5">
                <h2 className="text-sm font-bold text-gray-200">Simulation Parameters</h2>

                <SliderInput
                  label="Number of Qubits"
                  value={numQubits}
                  onChange={setNumQubits}
                  min={10} max={1000} step={10}
                />

                <SliderInput
                  label="QBER Threshold"
                  value={qberThreshold}
                  onChange={setQberThreshold}
                  min={0.01} max={0.5} step={0.01}
                  format={v => `${(v * 100).toFixed(0)}%`}
                />

                {/* Eve toggle */}
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Eve (Adversary)</label>
                  <button
                    onClick={() => setEvePresent(v => !v)}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all border ${
                      evePresent
                        ? "bg-red-950/60 border-red-500/60 text-red-300 shadow-lg shadow-red-950/50"
                        : "bg-gray-800/40 border-gray-700/40 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {evePresent ? "🕵 Eve: ACTIVE — Intercept-Resend ON" : "🕵 Eve: INACTIVE — Channel Clear"}
                  </button>
                  {evePresent && (
                    <p className="text-[10px] text-red-400/70 mt-1.5 leading-relaxed">
                      Eve will intercept each qubit, guess a basis, measure, then re-send.
                      This introduces ~25% QBER, triggering the detection threshold.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-950/50 text-white"
                >
                  {loading ? "⚛ Running Protocol…" : "▶ Run BB84 Simulation"}
                </button>

                {error && (
                  <div className="rounded-lg bg-red-950/40 border border-red-700/40 p-3 text-xs text-red-300">
                    ⚠ Error: {error}
                  </div>
                )}
              </div>

              {/* Quick stats if result exists */}
              {result && (
                <div className="rounded-2xl border border-gray-700/40 bg-gray-900/60 p-4 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">Last Run</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">QBER</span>
                    <span className={result.qber > result.qber_threshold ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                      {(result.qber * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Key Length</span>
                    <span className="text-cyan-300 font-bold">{result.key_length} bits</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Attack</span>
                    <span className={result.attack_detected ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                      {result.attack_detected ? "DETECTED" : "NONE"}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("results")}
                    className="w-full mt-1 py-1.5 text-xs rounded-lg border border-indigo-700/40 text-indigo-300 hover:bg-indigo-900/20 transition-colors"
                  >
                    View Full Results →
                  </button>
                </div>
              )}
            </div>

            {/* Protocol diagram */}
            <div className="lg:col-span-2">
              <Section title="Protocol Walkthrough" icon="🔬">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ProtocolStep num="1" actor="Alice" color="alice"
                    title="Qubit Preparation"
                    desc="Alice generates n random bits and n random bases (Z=rectilinear, X=diagonal). Each bit is encoded as a qubit: |0⟩, |1⟩, |+⟩, or |−⟩." />
                  <ProtocolStep num="2" actor="Quantum Channel" color="both"
                    title="Qubit Transmission"
                    desc={evePresent ? "Eve intercepts each qubit, randomly selects a basis, measures (collapsing state), then re-sends. Wrong basis guesses introduce disturbance." : "Qubits travel over the quantum channel. No-cloning theorem: they cannot be copied without measurement disturbance."} />
                  <ProtocolStep num="3" actor="Bob" color="bob"
                    title="Measurement"
                    desc="Bob randomly selects a basis for each qubit. Correct basis → deterministic result. Wrong basis → random (50/50) result, causing potential errors." />
                  <ProtocolStep num="4" actor="Alice + Bob" color="both"
                    title="Basis Sifting"
                    desc="Via public classical channel, Alice and Bob announce (only) their bases. They keep only qubits where bases matched — ~50% of all qubits survive." />
                  <ProtocolStep num="5" actor="Alice + Bob" color="both"
                    title="QBER Estimation"
                    desc="A sample of the sifted key is compared publicly. Error rate (QBER) is computed. Without Eve: ~0%. With Eve intercept-resend: ~25%." />
                  <ProtocolStep num="6" actor="Alice + Bob" color={evePresent ? "eve" : "both"}
                    title={evePresent ? "Key Rejection" : "Key Acceptance"}
                    desc={evePresent ? `QBER exceeds ${(qberThreshold*100).toFixed(0)}% threshold → key is rejected. Communication restarted on a new channel.` : `QBER below ${(qberThreshold*100).toFixed(0)}% threshold → key accepted. Final shared key derived via privacy amplification.`} />
                </div>

                {/* ASCII data flow diagram */}
                <div className="mt-4 rounded-xl bg-gray-950/60 border border-gray-700/30 p-4 overflow-x-auto">
                  <pre className="text-[10px] text-gray-400 leading-5 font-mono">
{`┌─────────────────────────────────────────────────────────────────┐
│                         BB84 DATA FLOW                        │
├──────────────┬───────────────────────┬──────────────────────────┤
│    ALICE     │    QUANTUM CHANNEL   │           BOB           │
│              │                      │                         │
│ gen bits[]   │                      │                         │
│ gen bases[]  │                      │                         │
│ encode       │ ────── qubits ─────▶ │                         │
│ qubits       │${evePresent ? " ◀─────── EVE ───────▶" : "                      "}│ gen bases[]             │
│              │                      │ measure                 │
│              │                      │ qubits                  │
│              │                      │                         │
│◀════════════════════   Classical Channel  ════════════════════▶│     
│              │ (public: bases only) │                         │
│              │                      │                         │
│ sift_key()   │                      │ sift_key()              │
│              │                      │                         │
│ QBER check -> intrusion detection -> key accept/reject        │
└─────────────────────────────────────────────────────────────────┘`}
                  </pre>
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════ RESULTS TAB ════════════════════ */}
        {activeTab === "results" && (
          <div className="space-y-6">
            {!result ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
                <span className="text-5xl">⚛</span>
                <p className="text-sm">No results yet — run a simulation first.</p>
                <button
                  onClick={() => setActiveTab("simulate")}
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  ← Go to Simulate
                </button>
              </div>
            ) : (
              <>
                <Section title="Security Assessment" icon="🛡" defaultOpen={true}>
                  <ResultsPanel data={result} />
                </Section>

                <Section title="Qubit Protocol Table" icon="🔬" defaultOpen={true}>
                  <p className="text-[11px] text-gray-500 mb-3">
                    Showing per-qubit data. Green rows = matching bases (kept in sifted key).
                    {result.alice_bits_truncated && " (Showing first 64 of " + result.num_qubits + " qubits)"}
                  </p>
                  <QubitTable data={result} />
                </Section>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════ ANALYSIS TAB ═══════════════════ */}
        {activeTab === "analysis" && (
          <div className="space-y-6">
            <Section title="QBER vs Qubit Count Analysis" icon="📈">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Configure your sweep below. For each qubit count, the simulator runs multiple trials and plots
                the mean QBER for both scenarios. Tooltip values include variability stats (std and min/max range).
              </p>
              <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Qubit counts (comma-separated)</label>
                  <input
                    value={sweepCountsInput}
                    onChange={e => setSweepCountsInput(e.target.value)}
                    placeholder="10, 25, 50, 100, 200, 500, 1000"
                    className="w-full rounded-lg bg-gray-900 border border-gray-700/60 px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <SliderInput
                  label="Runs Per Count"
                  value={sweepRuns}
                  onChange={setSweepRuns}
                  min={1}
                  max={20}
                  step={1}
                />
                <SliderInput
                  label="Detection Threshold (Chart)"
                  value={analysisThreshold}
                  onChange={setAnalysisThreshold}
                  min={0.01}
                  max={0.3}
                  step={0.01}
                  format={v => `${(v * 100).toFixed(0)}%`}
                />
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={handleRunSweep}
                  disabled={sweepLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-700/60 hover:bg-indigo-600/60 border border-indigo-500/40 transition-all disabled:opacity-50"
                >
                  {sweepLoading ? "Running sweep..." : "▶ Run Sweep Analysis (Both Scenarios)"}
                </button>
                <button
                  onClick={exportSweepCsv}
                  disabled={!sweepNoEve || !sweepWithEve}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-800/60 hover:bg-gray-700/60 border border-gray-600/40 transition-all disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
              {analysisError && (
                <p className="text-xs text-red-400 mb-2">{analysisError}</p>
              )}
              <QBERChart
                sweepData={sweepNoEve}
                sweepWithEve={sweepWithEve}
                threshold={analysisThreshold}
              />
              {sweepNoEve && sweepWithEve && (
                <div className="mt-3 text-[11px] text-gray-400 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-2">
                    Sweep points: <span className="text-cyan-300 font-bold">{sweepNoEve.length}</span>
                  </div>
                  <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-2">
                    Runs per point: <span className="text-cyan-300 font-bold">{sweepRuns}</span>
                  </div>
                  <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-2">
                    With-Eve points above threshold:{" "}
                    <span className="text-amber-300 font-bold">
                      {withEveAboveThreshold}/{sweepWithEve.length}
                    </span>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Security & Performance Analysis" icon="⚙">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-400 leading-relaxed">
                <div className="space-y-3">
                  <div>
                    <p className="font-bold text-gray-200 mb-1">Time Complexity</p>
                    <p>The BB84 protocol runs in <code className="text-cyan-300">O(n)</code> time where n = number of qubits. Key sifting, QBER calculation, and basis comparison are all linear operations.</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-200 mb-1">Sifting Efficiency</p>
                    <p>Approximately 50% of qubits survive sifting (matching bases). For 1000 qubits, expect ~500 bits in the sifted key. Privacy amplification further reduces this to the final secure key.</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-200 mb-1">No-Cloning Theorem</p>
                    <p>Quantum mechanics forbids copying an unknown qubit state. Eve must measure (collapsing the state) and re-send, introducing disturbance. This is the physical foundation of BB84 security.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-bold text-gray-200 mb-1">Attack Surface</p>
                    <p>In this simulation: intercept-resend attack introduces ~25% QBER. Real attacks also include photon-number-splitting (PNS) and Trojan-horse attacks, addressed by decoy-state QKD.</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-200 mb-1">Threshold Trade-off</p>
                    <p>Lower threshold → more sensitive to Eve but more false positives from channel noise. Standard threshold: 11% (below Eve's theoretical 25% but above typical fiber noise of 1–3%).</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-200 mb-1">Scalability</p>
                    <p>This simulation handles up to 10,000 qubits with sub-second response time. Real QKD systems achieve ~10 kbit/s over 100 km fiber. Satellite QKD extends range globally.</p>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════ HISTORY TAB ════════════════════ */}
        {activeTab === "history" && (
          <Section title="Simulation Run History" icon="🗒" defaultOpen={true}>
            <HistoryTable history={history} onClear={async () => { await clearHistory(); }} />
          </Section>
        )}

        {/* ═══════════════════════════════ PROTOCOL TAB ══════════════════ */}
        {activeTab === "protocol" && (
          <div className="space-y-4">
            <Section title="BB84 Protocol Reference" icon="📘">
              <div className="prose prose-invert prose-sm max-w-none text-gray-400 space-y-4 text-xs leading-relaxed">
                <div>
                  <h3 className="text-gray-200 font-bold text-sm mb-1">Introduction</h3>
                  <p>BB84, proposed by Charles Bennett and Gilles Brassard in 1984, was the world's first quantum key distribution protocol. It leverages fundamental quantum mechanical properties — specifically the Heisenberg uncertainty principle and the no-cloning theorem — to establish a provably secure shared secret key between two parties (Alice and Bob) over an insecure channel, even in the presence of an eavesdropper (Eve).</p>
                </div>
                <div>
                  <h3 className="text-gray-200 font-bold text-sm mb-1">Qubit Encoding</h3>
                  <div className="font-mono bg-gray-950/60 rounded-lg p-3 text-[11px] text-cyan-300">
                    <p>Z basis (rectilinear):  bit 0 → |0⟩ (↑),   bit 1 → |1⟩ (↓)</p>
                    <p>X basis (diagonal):     bit 0 → |+⟩ (↗),   bit 1 → |−⟩ (↘)</p>
                    <p></p>
                    <p>|+⟩ = (|0⟩ + |1⟩) / √2    |−⟩ = (|0⟩ − |1⟩) / √2</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-gray-200 font-bold text-sm mb-1">Measurement Rules</h3>
                  <p>When Bob measures in the <strong className="text-gray-200">same basis as Alice</strong>: he recovers the original bit with 100% certainty.<br/>
                  When Bob measures in a <strong className="text-gray-200">different basis</strong>: the quantum state collapses randomly to 0 or 1 with equal probability — no information is obtained.</p>
                </div>
                <div>
                  <h3 className="text-gray-200 font-bold text-sm mb-1">Security Proof Sketch</h3>
                  <p>If Eve measures a qubit in the wrong basis (probability 50%), she re-sends a qubit in the wrong state. When Bob later measures with the correct basis, there is a 50% chance he gets the wrong result. Each intercepted qubit therefore contributes a 25% probability of error in the sifted key. With n sifted bits sampled, the probability that Eve went undetected falls as (3/4)^n, which becomes negligible for n ≥ 100.</p>
                </div>
                <div>
                  <h3 className="text-gray-200 font-bold text-sm mb-1">Real-World Considerations</h3>
                  <p>This simulation assumes a perfect, noiseless quantum channel. In practice, optical fiber introduces 1–3% QBER from noise. The security threshold (default 11%) is set to be below Eve's ~25% interference but above typical noise floors. Real implementations also require error correction and privacy amplification to eliminate partial information Eve may have obtained.</p>
                </div>
                <div>
                  <h3 className="text-gray-200 font-bold text-sm mb-1">References</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>Bennett & Brassard (1984). "Quantum cryptography: Public key distribution and coin tossing." CRYPTO '84.</li>
                    <li>Shor & Preskill (2000). "Simple proof of security of the BB84 quantum key distribution protocol." PRL 85, 441.</li>
                    <li>Gisin et al. (2002). "Quantum cryptography." Rev. Mod. Phys. 74, 145.</li>
                  </ul>
                </div>
              </div>
            </Section>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-800/40 py-4 text-center text-[10px] text-gray-600">
        BB84 QKD Simulator · University Cybersecurity Project · NumPy-based quantum simulation
      </footer>
    </div>
  );
}
