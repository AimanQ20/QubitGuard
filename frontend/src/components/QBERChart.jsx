/**
 * QBERChart.jsx — Error rate visualization using Recharts.
 *
 * Renders two line series: without Eve (blue) and with Eve (red),
 * showing how QBER scales with qubit count.
 */

import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-300 font-bold mb-1">{label} qubits</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {(p.value * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  );
};

export default function QBERChart({ sweepData, sweepWithEve }) {
  if (!sweepData && !sweepWithEve) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm border border-gray-700/40 rounded-lg bg-gray-800/20">
        Run a sweep analysis to see the QBER vs Qubits graph
      </div>
    );
  }

  // Merge the two datasets into a single series keyed by num_qubits
  const mergedMap = {};
  if (sweepData) {
    sweepData.forEach(d => {
      mergedMap[d.num_qubits] = { ...mergedMap[d.num_qubits], num_qubits: d.num_qubits, no_eve: d.mean_qber };
    });
  }
  if (sweepWithEve) {
    sweepWithEve.forEach(d => {
      mergedMap[d.num_qubits] = { ...mergedMap[d.num_qubits], num_qubits: d.num_qubits, with_eve: d.mean_qber };
    });
  }
  const chartData = Object.values(mergedMap).sort((a, b) => a.num_qubits - b.num_qubits);

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.5} />
          <XAxis
            dataKey="num_qubits"
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            label={{ value: "Qubits", position: "insideBottomRight", offset: -5, fill: "#6b7280", fontSize: 11 }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            domain={[0, 0.35]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span style={{ color: "#9ca3af", fontSize: 11 }}>
                {value === "no_eve" ? "Without Eve" : "With Eve (Intercept-Resend)"}
              </span>
            )}
          />
          {/* Security threshold line */}
          <ReferenceLine
            y={0.11}
            stroke="#f59e0b"
            strokeDasharray="5 3"
            label={{ value: "11% threshold", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }}
          />
          {sweepData && (
            <Line
              type="monotone"
              dataKey="no_eve"
              name="no_eve"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ fill: "#38bdf8", r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
          {sweepWithEve && (
            <Line
              type="monotone"
              dataKey="with_eve"
              name="with_eve"
              stroke="#f87171"
              strokeWidth={2}
              dot={{ fill: "#f87171", r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-500 text-center mt-1">
        Yellow dashed line = 11% QBER security threshold. Above → attack detected.
      </p>
    </div>
  );
}
