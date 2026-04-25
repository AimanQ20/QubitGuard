/**
 * QubitTable.jsx — Renders per-qubit protocol data in a scrollable table.
 *
 * Shows: index, Alice bit, Alice basis, qubit state, Bob basis, Bob result,
 *        basis match status, and (optionally) Eve's data.
 */

import React, { useState } from "react";

const CELL = "px-3 py-1.5 text-xs font-mono whitespace-nowrap";
const MATCH_YES = "bg-green-900/40 text-green-300";
const MATCH_NO  = "bg-gray-800/40 text-gray-500";

function BasisBadge({ basis }) {
  return basis === "Z" ? (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/40">Z</span>
  ) : (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-900/60 text-amber-300 border border-amber-700/40">X</span>
  );
}

export default function QubitTable({ data }) {
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;

  const {
    alice_bits, alice_bases_labels, qubit_states,
    bob_bases_labels, bob_results,
    matching_indices, eve_present,
    eve_bases_labels, eve_results,
  } = data;

  const n = alice_bits.length;
  const matchSet = new Set(matching_indices);
  const displayN = showAll ? n : Math.min(n, 32);
  const rows = Array.from({ length: displayN }, (_, i) => ({
    i,
    aliceBit   : alice_bits[i],
    aliceBasis : alice_bases_labels[i],
    state      : qubit_states[i],
    bobBasis   : bob_bases_labels[i],
    bobResult  : bob_results[i],
    match      : matchSet.has(i),
    eveBasis   : eve_present ? (eve_bases_labels?.[i] ?? "–") : null,
    eveResult  : eve_present ? (eve_results?.[i] ?? "–") : null,
  }));

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-800/80 text-gray-400 text-[11px] uppercase tracking-wider">
              <th className={CELL}>#</th>
              <th className={CELL}>Alice Bit</th>
              <th className={CELL}>Alice Basis</th>
              <th className={CELL}>Qubit State</th>
              {eve_present && <th className={CELL + " text-red-400"}>Eve Basis</th>}
              {eve_present && <th className={CELL + " text-red-400"}>Eve Result</th>}
              <th className={CELL}>Bob Basis</th>
              <th className={CELL}>Bob Result</th>
              <th className={CELL}>Match?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.i}
                className={`border-t border-gray-700/30 transition-colors ${r.match ? "bg-green-950/20" : "bg-transparent"}`}
              >
                <td className={CELL + " text-gray-500"}>{r.i}</td>
                <td className={CELL + " text-cyan-300 font-bold"}>{r.aliceBit}</td>
                <td className={CELL}><BasisBadge basis={r.aliceBasis} /></td>
                <td className={CELL + " text-purple-300"}>{r.state}</td>
                {eve_present && <td className={CELL}><BasisBadge basis={r.eveBasis} /></td>}
                {eve_present && <td className={CELL + " text-red-300 font-bold"}>{r.eveResult}</td>}
                <td className={CELL}><BasisBadge basis={r.bobBasis} /></td>
                <td className={CELL + " text-cyan-300 font-bold"}>{r.bobResult}</td>
                <td className={CELL}>
                  {r.match
                    ? <span className="text-green-400 font-bold">✓</span>
                    : <span className="text-gray-600">✗</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {n > 32 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {showAll ? `▲ Show first 32` : `▼ Show all ${n} qubits`}
        </button>
      )}
    </div>
  );
}
