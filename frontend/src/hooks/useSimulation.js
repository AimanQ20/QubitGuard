/**
 * useSimulation.js — React hook for BB84 simulation API calls.
 *
 * Wraps all backend communication with loading/error state management.
 */

import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export function useSimulation() {
  const [loading, setLoading]           = useState(false);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [result, setResult]             = useState(null);
  const [history, setHistory]           = useState([]);
  const [sweepData, setSweepData]       = useState(null);
  const [error, setError]               = useState(null);

  const runSimulation = useCallback(async ({
    numQubits,
    evePresent,
    qberThreshold,
    channelNoiseRate = 0,
  }) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.post(`${API_BASE}/api/simulate`, {
        num_qubits:           numQubits,
        eve_present:          evePresent,
        qber_threshold:       qberThreshold,
        channel_noise_rate: channelNoiseRate,
      });
      setResult(resp.data.data);
      return resp.data.data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Unknown error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const resp = await axios.get(`${API_BASE}/api/results?limit=15`);
      setHistory(resp.data.data || []);
    } catch (err) {
      console.error("History fetch failed:", err.message);
    }
  }, []);

  const runSweep = useCallback(async ({
    evePresent,
    qubitCounts = [10, 25, 50, 100, 200, 500, 1000],
    runsPerCount = 5,
    qberThreshold = 0.11,
    channelNoiseRate = 0,
  }) => {
    setSweepLoading(true);
    try {
      const resp = await axios.post(`${API_BASE}/api/sweep`, {
        qubit_counts: qubitCounts,
        eve_present: evePresent,
        runs_per_count: runsPerCount,
        qber_threshold: qberThreshold,
        channel_noise_rate: channelNoiseRate,
      });
      setSweepData(resp.data.data);
      return resp.data.data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Sweep request failed";
      setError(msg);
      return null;
    } finally {
      setSweepLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await axios.delete(`${API_BASE}/api/results`);
      setHistory([]);
    } catch (err) {
      console.error("Clear failed:", err.message);
    }
  }, []);

  return {
    loading, sweepLoading,
    result, history, sweepData, error,
    runSimulation, fetchHistory, runSweep, clearHistory,
  };
}
