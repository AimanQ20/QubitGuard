/**
 * HistoryTable.jsx — Table of recent simulation runs.
 */

import React from "react";

export default function HistoryTable({ history, onClear }) {
  if (!history.length) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        No simulation runs yet. Run a simulation to see history here.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{history.length} recent runs</span>
        <button
          onClick={onClear}
          className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
        >
          Clear history
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-700/40">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-800/60 text-gray-400 text-[10px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Qubits</th>
              <th className="px-3 py-2 text-left">Eve</th>
              <th className="px-3 py-2 text-left">QBER</th>
              <th className="px-3 py-2 text-left">Key Len</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {history.map(row => (
              <tr key={row.id} className="border-t border-gray-700/30 hover:bg-gray-800/20">
                <td className="px-3 py-1.5 text-gray-500 font-mono">#{row.id}</td>
                <td className="px-3 py-1.5 text-gray-300 font-mono">{row.num_qubits}</td>
                <td className="px-3 py-1.5">
                  {row.eve_present
                    ? <span className="text-red-400 font-bold">YES</span>
                    : <span className="text-gray-500">NO</span>}
                </td>
                <td className="px-3 py-1.5 font-mono">
                  <span className={row.qber > 0.11 ? "text-red-400" : "text-green-400"}>
                    {(row.qber * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-1.5 text-cyan-300 font-mono">{row.key_length}b</td>
                <td className="px-3 py-1.5">
                  {row.attack_detected
                    ? <span className="text-red-400 text-[10px] font-bold px-1.5 py-0.5 bg-red-950/40 rounded">DETECTED</span>
                    : <span className="text-green-400 text-[10px] font-bold px-1.5 py-0.5 bg-green-950/40 rounded">SECURE</span>}
                </td>
                <td className="px-3 py-1.5 text-gray-500 font-mono text-[10px]">
                  {new Date(row.timestamp * 1000).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
