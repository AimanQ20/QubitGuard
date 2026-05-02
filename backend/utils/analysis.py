"""
utils/analysis.py — Statistical analysis utilities for BB84 simulation results.

Provides:
    - QBER vs qubit-count analysis
    - Summary statistics formatter
    - Multi-run aggregation
"""

from __future__ import annotations
import statistics
from typing import List, Dict, Any, Optional
from dataclasses import asdict

from quantum.bb84 import BB84Protocol, BB84Result


def result_to_dict(result: BB84Result) -> Dict[str, Any]:
    """
    Serialize a BB84Result to a JSON-serializable dictionary.
    Truncates large arrays for API responses to prevent payload bloat.
    """
    MAX_DISPLAY = 64  # max entries for per-qubit arrays in API response

    d = asdict(result)

    # Truncate large arrays — client only needs first N for table display
    for key in ["alice_bits", "alice_bases", "qubit_states",
                "bob_bases", "bob_results", "eve_bases", "eve_results"]:
        if len(d[key]) > MAX_DISPLAY:
            d[key] = d[key][:MAX_DISPLAY]
            d[f"{key}_truncated"] = True

    # Truncate matching_indices
    if len(d["matching_indices"]) > MAX_DISPLAY:
        d["matching_indices"] = d["matching_indices"][:MAX_DISPLAY]

    # Convert sifted keys to bit strings for display
    d["alice_sifted_key_str"] = "".join(str(b) for b in result.alice_sifted_key[:MAX_DISPLAY])
    d["bob_sifted_key_str"]   = "".join(str(b) for b in result.bob_sifted_key[:MAX_DISPLAY])

    # Basis labels
    d["alice_bases_labels"] = [
        "Z" if b == 0 else "X" for b in result.alice_bases[:MAX_DISPLAY]
    ]
    d["bob_bases_labels"] = [
        "Z" if b == 0 else "X" for b in result.bob_bases[:MAX_DISPLAY]
    ]
    if result.eve_present:
        d["eve_bases_labels"] = [
            "Z" if b == 0 else "X" for b in result.eve_bases[:MAX_DISPLAY]
        ]

    return d


def run_qber_sweep(
    qubit_counts: Optional[List[int]] = None,
    eve_present: bool = False,
    runs_per_count: int = 5,
    seed_base: int = 42,
    qber_threshold: float = BB84Protocol.DEFAULT_QBER_THRESHOLD,
    channel_noise_rate: float = 0.0,
) -> List[Dict[str, Any]]:
    """
    Run simulations across a range of qubit counts and aggregate QBER statistics.

    Used for the "Error Rate vs Qubits" graph in the frontend.

    Args:
        qubit_counts    : List of qubit counts to test
        eve_present     : Whether to simulate Eve
        runs_per_count  : Number of runs per qubit count for averaging
        seed_base       : Base seed for reproducibility
        qber_threshold  : Same as SimulateRequest.qber_threshold
        channel_noise_rate : Same as SimulateRequest.channel_noise_rate

    Returns:
        List of dicts with keys: num_qubits, mean_qber, min_qber, max_qber, std_qber
    """
    if qubit_counts is None:
        qubit_counts = [10, 20, 50, 100, 200, 500]

    sweep_results = []

    for n in qubit_counts:
        qbers = []
        for run_i in range(runs_per_count):
            proto = BB84Protocol(
                num_qubits=n,
                eve_present=eve_present,
                qber_threshold=qber_threshold,
                channel_noise_rate=channel_noise_rate,
                seed=seed_base + run_i * 1000,
            )
            result = proto.run()
            qbers.append(result.qber)

        sweep_results.append({
            "num_qubits" : n,
            "mean_qber"  : round(statistics.mean(qbers), 4),
            "min_qber"   : round(min(qbers), 4),
            "max_qber"   : round(max(qbers), 4),
            "std_qber"   : round(statistics.stdev(qbers) if len(qbers) > 1 else 0.0, 4),
            "eve_present": eve_present,
            "channel_noise_rate": channel_noise_rate,
            "qber_threshold": qber_threshold,
        })

    return sweep_results


def generate_summary_report(result: BB84Result) -> str:
    """
    Generate a human-readable plain-text summary of a simulation run.
    Used for the downloadable report in the frontend.
    """
    sep = "─" * 60
    lines = [
        sep,
        "  BB84 Quantum Key Distribution — Simulation Report",
        sep,
        f"  Qubits transmitted      : {result.num_qubits}",
        f"  Eve present             : {'YES ⚠' if result.eve_present else 'NO ✓'}",
        f"  Channel noise rate      : {result.channel_noise_rate:.2%}",
        f"  Sifted key length       : {result.key_length} bits",
        f"  Sifting efficiency      : {result.sifting_efficiency:.1%}",
        f"  QBER                    : {result.qber:.2%}",
        f"  QBER threshold          : {result.qber_threshold:.2%}",
        f"  Attack detected         : {'YES — KEY REJECTED ⚠' if result.attack_detected else 'NO — KEY ACCEPTED ✓'}",
        f"  Final key (SHA-256 hex) : {result.final_key}",
        f"  Simulation time         : {result.simulation_time_ms:.2f} ms",
        sep,
        "  Security Analysis",
        sep,
    ]

    if result.eve_present:
        lines += [
            f"  Eve intercepted and re-sent all {result.num_qubits} qubits.",
            f"  She guessed the correct basis approximately 50% of the time.",
            f"  Her interference introduced ~{result.qber:.1%} errors in the sifted key.",
            f"  Theoretical expected QBER with intercept-resend: ~25%.",
        ]
    else:
        if result.channel_noise_rate > 0:
            lines += [
                "  No eavesdropper detected.",
                f"  Simulated channel imperfections (noise rate ≈ {result.channel_noise_rate:.2%}).",
                f"  QBER {result.qber:.2%} remains below intrusion threshold ({result.qber_threshold:.2%}).",
                "  Alice and Bob may proceed with error correction/privacy amplification in a full system.",
            ]
        else:
            lines += [
                "  No eavesdropper detected.",
                "  Ideal noiseless channel — QBER ~0%.",
                "  Alice and Bob may proceed to use the shared key.",
            ]

    lines += [
        sep,
        "  Protocol Phases Completed",
        sep,
        "  [1] Alice: random bits + bases → qubit encoding",
        "  [2] Quantum channel: qubit transmission" + (" (intercepted by Eve)" if result.eve_present else ""),
        "  [3] Bob: random basis selection + measurement",
        "  [4] Classical channel: basis reconciliation (sifting)",
        "  [5] QBER estimation (error detection)",
        "  [6] Key acceptance / rejection",
        sep,
    ]

    return "\n".join(lines)
