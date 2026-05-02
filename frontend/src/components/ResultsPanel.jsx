/**
 * ResultsPanel.jsx — Displays key metrics and summary after simulation.
 */

import React from "react";

function MetricCard({ label, value, sub, color = "text-white", highlight = false }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight
      ? "border-amber-500/40 bg-amber-950/20"
      : "border-gray-700/40 bg-gray-800/30"}`}>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ResultsPanel({ data }) {
  if (!data) return null;

  const qberPct = (data.qber * 100).toFixed(1);
  const detected = data.attack_detected;
  const eveActive = data.eve_present;

  const securityBanner = detected ? (
    <div className="flex items-center gap-3 bg-red-950/40 border border-red-500/50 rounded-xl p-4">
      <span className="text-3xl">🚨</span>
      <div>
        <p className="text-red-400 font-bold text-sm">INTRUSION DETECTED</p>
        <p className="text-red-300/70 text-xs">
          QBER of {qberPct}% exceeds {(data.qber_threshold * 100).toFixed(0)}% threshold.
          Key exchange aborted. Eve's intercept-resend attack detected.
        </p>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-3 bg-green-950/40 border border-green-500/50 rounded-xl p-4">
      <span className="text-3xl">✅</span>
      <div>
        <p className="text-green-400 font-bold text-sm">KEY EXCHANGE SECURE</p>
        <p className="text-green-300/70 text-xs">
          QBER of {qberPct}% is within the {(data.qber_threshold * 100).toFixed(0)}% threshold.
          No eavesdropping detected. Shared key established.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {securityBanner}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
        <MetricCard
          label="QBER"
          value={`${qberPct}%`}
          sub={`Threshold: ${(data.qber_threshold * 100).toFixed(0)}%`}
          color={detected ? "text-red-400" : "text-green-400"}
          highlight={detected}
        />
        <MetricCard
          label="Key Length"
          value={`${data.key_length} bits`}
          sub={`Sifting eff: ${(data.sifting_efficiency * 100).toFixed(0)}%`}
          color="text-cyan-300"
        />
        <MetricCard
          label="Qubits Sent"
          value={data.num_qubits}
          sub={`${data.matching_indices.length} bases matched`}
          color="text-purple-300"
        />
        <MetricCard
          label="Channel noise"
          value={
            typeof data.channel_noise_rate === "number" && data.channel_noise_rate > 0
              ? `${(data.channel_noise_rate * 100).toFixed(2)}%`
              : "OFF"
          }
          color={typeof data.channel_noise_rate === "number" && data.channel_noise_rate > 0 ? "text-amber-300" : "text-gray-500"}
          sub={
            eveActive ? "Adds random sift errors on Eve runs" : "Honest noisy channel (bounded QBER)"
          }
        />
        <MetricCard
          label="Eve Active"
          value={eveActive ? "YES" : "NO"}
          color={eveActive ? "text-red-400" : "text-gray-400"}
        />
        <MetricCard
          label="Sim Time"
          value={`${data.simulation_time_ms.toFixed(1)} ms`}
          color="text-gray-300"
        />
        <MetricCard
          label="Attack Detected"
          value={detected ? "YES" : "NO"}
          color={detected ? "text-red-400" : "text-green-400"}
          highlight={detected}
        />
      </div>

      {/* Final shared key */}
      {!detected && data.final_key !== "NO_KEY_GENERATED" && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
          <p className="text-[11px] uppercase tracking-wider text-indigo-400 mb-2">
            Final Shared Secret Key (SHA-256 Derived)
          </p>
          <code className="text-sm font-mono text-indigo-200 break-all">
            {data.final_key}
          </code>
          <p className="text-[10px] text-indigo-400/50 mt-1">
            Derived from sifted key via SHA-256. In production, privacy amplification would be applied.
          </p>
        </div>
      )}

      {/* Sifted key display */}
      {data.key_length > 0 && (
        <div className="rounded-xl border border-gray-700/40 bg-gray-800/20 p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Sifted Key Preview (first 64 bits)</p>
          <div>
            <span className="text-[10px] text-cyan-500 mr-2">Alice:</span>
            <code className="text-xs font-mono text-cyan-300">{data.alice_sifted_key_str}</code>
          </div>
          <div>
            <span className="text-[10px] text-purple-500 mr-2">Bob: </span>
            <code className="text-xs font-mono text-purple-300">{data.bob_sifted_key_str}</code>
          </div>
          {data.error_positions?.length > 0 && (
            <p className="text-[10px] text-red-400">
              {data.error_positions.length} errors in sifted key at positions: {data.error_positions.slice(0, 10).join(", ")}{data.error_positions.length > 10 ? "..." : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
