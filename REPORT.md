# BB84 QKD Simulator — Technical Report

**Course**: Quantum Cryptography / Cybersecurity  
**Project**: Quantum Key Distribution Simulation (BB84 Protocol)  
**Stack**: Python (FastAPI) · NumPy · React · Recharts · SQLite

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Protocol Background](#2-protocol-background)
3. [System Architecture](#3-system-architecture)
4. [Cryptographic Core Design](#4-cryptographic-core-design)
5. [Threat Model & Security Analysis](#5-threat-model--security-analysis)
6. [Implementation Details](#6-implementation-details)
7. [API Design](#7-api-design)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Performance & Scalability](#9-performance--scalability)
10. [Testing Scenarios](#10-testing-scenarios)
11. [Conclusions](#11-conclusions)
12. [References](#12-references)

---

## 1. Introduction

Quantum Key Distribution (QKD) represents a fundamentally new approach to secure communication, exploiting the laws of quantum mechanics rather than computational hardness assumptions to achieve information-theoretic security. Unlike classical public-key cryptosystems (RSA, ECC), whose security rests on the presumed difficulty of factoring or discrete logarithms — both problems solvable in polynomial time on a quantum computer — QKD's security is guaranteed by the laws of physics themselves.

This project implements a complete software simulation of the BB84 protocol, providing an interactive educational and research tool for studying quantum key distribution, eavesdropping scenarios, and security threshold analysis.

---

## 2. Protocol Background

### 2.1 BB84 Overview

BB84, published by Charles Bennett and Gilles Brassard in 1984 at the CRYPTO conference, was the first practical quantum key distribution protocol. Its core insight is that quantum measurements are inherently disturbing: an eavesdropper cannot passively observe a quantum channel without leaving a detectable trace.

### 2.2 Qubit States Used

BB84 uses **two non-orthogonal bases**:

```
Rectilinear (Z) basis:
  bit 0 → |0⟩   (spin-up / horizontal polarization)
  bit 1 → |1⟩   (spin-down / vertical polarization)

Diagonal (X) basis:
  bit 0 → |+⟩ = (|0⟩ + |1⟩)/√2   (45° polarization)
  bit 1 → |−⟩ = (|0⟩ − |1⟩)/√2   (135° polarization)
```

The security arises from the fact that these two bases are **mutually unbiased**: measuring a Z-basis state in the X basis yields a random result (50/50), and vice versa.

### 2.3 Protocol Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | Alice | Generates n random bits, n random bases; encodes each bit in chosen basis |
| 2 | Channel | Alice sends qubits over quantum channel to Bob |
| 3 | (Eve) | If present, Eve intercepts, measures, re-sends |
| 4 | Bob | Chooses n random measurement bases; measures each qubit |
| 5 | Both | Via classical channel: announce bases (not bits); discard mismatches |
| 6 | Both | Compare small sample of sifted key to estimate QBER |
| 7 | Both | If QBER < threshold: accept key; else: abort |

### 2.4 Key Sifting

After transmission, Alice and Bob publicly announce their chosen bases for each qubit. They retain only those positions where they chose the **same** basis — on average, 50% of all qubits. This retained subset is the **sifted key**.

Expected sifted key length: `n × P(same basis) = n × 0.5`

### 2.5 QBER Estimation

A random sample of sifted key bits is publicly compared to estimate the error rate:

```
QBER = (number of differing bits) / (total compared bits)
```

**Expected QBER values:**
- No eavesdropper, ideal channel: **0%**
- Standard channel noise (fiber optics): **1–3%**
- Eve: intercept-resend attack: **~25%**
- Security threshold (this implementation): **11%**

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│                     React SPA (port 3000)                        │
│    SimulateTab │ ResultsTab │ AnalysisTab │ HistoryTab │ DocsTab  │
└─────────────────────────────┬────────────────────────────────────┘
                              │ REST/JSON (axios)
┌─────────────────────────────▼────────────────────────────────────┐
│                         API LAYER                                │
│                   FastAPI (port 8000)                            │
│        /api/simulate │ /api/results │ /api/sweep                 │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
┌──────────────▼──────────┐   ┌─────────────▼────────────────────┐
│   QUANTUM CRYPTO LAYER  │   │         DATA LAYER               │
│   quantum/bb84.py       │   │   utils/logger.py (SQLite)       │
│   BB84Protocol          │   │   simulations.db                 │
│   BB84Result            │   │                                  │
└─────────────────────────┘   └──────────────────────────────────┘
               │
┌──────────────▼──────────┐
│    ANALYSIS LAYER       │
│   utils/analysis.py     │
│   QBER sweep, reports   │
└─────────────────────────┘
```

### 3.2 Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `quantum/bb84.py` | Pure protocol logic; no I/O dependencies |
| `utils/analysis.py` | Serialization, sweep analysis, report generation |
| `utils/logger.py` | SQLite persistence; completely decoupled from protocol |
| `backend/main.py` | HTTP routing, request validation, response assembly |
| `frontend/src/App.jsx` | UI state management, tab routing, layout |
| `frontend/src/hooks/useSimulation.js` | All API calls, loading/error state |
| `frontend/src/components/` | Pure display components, no business logic |

---

## 4. Cryptographic Core Design

### 4.1 Alice's Qubit Preparation

```python
alice_bits  = rng.integers(0, 2, size=n)   # Random {0,1}^n
alice_bases = rng.integers(0, 2, size=n)   # Random {Z,X}^n

# Encoding:
# (basis=Z, bit=0) → |0⟩
# (basis=Z, bit=1) → |1⟩
# (basis=X, bit=0) → |+⟩ = (|0⟩+|1⟩)/√2
# (basis=X, bit=1) → |−⟩ = (|0⟩−|1⟩)/√2
```

This is simulated classically — in a real QKD system, these would be physical photon polarization states.

### 4.2 Eve's Intercept-Resend Attack

```python
for i in range(n):
    if eve_bases[i] == alice_bases[i]:
        # Correct guess (prob 0.5): perfect measurement
        eve_results[i] = alice_bits[i]
    else:
        # Wrong guess (prob 0.5): random collapse
        eve_results[i] = rng.integers(0, 2)
        disturbed_bits[i] = eve_results[i]  # Re-sent in wrong state
```

Each qubit intercepted by Eve has a 50% chance of being measured in the wrong basis, causing a random re-send. When Bob later measures with Alice's original basis, there is a 50% chance of error — giving:

```
P(error per sifted bit | Eve) = P(Eve wrong basis) × P(Bob gets wrong bit)
                               = 0.5 × 0.5 = 0.25
```

**Expected QBER with full intercept-resend: 25%**

### 4.3 Bob's Measurement

```python
for i in range(n):
    if bob_bases[i] == alice_bases[i]:
        bob_results[i] = transmitted_bits[i]  # Deterministic
    else:
        bob_results[i] = rng.integers(0, 2)   # Random collapse
```

### 4.4 Key Sifting

```python
matching = [i for i in range(n) if alice_bases[i] == bob_bases[i]]
alice_sifted = [alice_bits[i] for i in matching]
bob_sifted   = [bob_results[i] for i in matching]
```

### 4.5 Final Key Derivation

In production QKD, privacy amplification (using universal hash functions) would be applied to eliminate any partial information Eve may have obtained. For this simulation, we derive the final key as:

```python
key_bytes = pack sifted bits into bytes (MSB first, 8 bits per byte)
final_key = SHA-256(key_bytes)[:32 hex chars]
```

This is structurally similar to privacy amplification and produces a fixed-length cryptographic secret.

---

## 5. Threat Model & Security Analysis

### 5.1 Adversary Model

**Eve's capabilities:**
- Full control of the quantum channel
- Can intercept, measure, and re-send any qubit
- Cannot clone qubits (no-cloning theorem)
- Cannot measure in multiple bases simultaneously (uncertainty principle)
- Has access to the classical channel (but it is public and authenticated)

**Eve's limitations:**
- Every measurement disturbs the quantum state with probability proportional to her interception rate
- Cannot extract information without leaving a statistical trace
- Cannot delay the protocol indefinitely (authentication prevents man-in-the-middle on classical channel)

### 5.2 Attack: Intercept-Resend

| Scenario | Expected QBER | Detection (11% threshold) |
|----------|--------------|--------------------------|
| No Eve, ideal channel | 0% | No (secure) |
| No Eve, noisy channel (~2% noise) | ~2% | No (secure) |
| Eve intercepts 100% | ~25% | Yes (attack detected) |
| Eve intercepts 30% | ~7.5% | Borderline |
| Eve intercepts 50% | ~12.5% | Yes (attack detected) |

### 5.3 Detection Probability

For n sifted bits with QBER = q, the probability of not detecting Eve after sampling k check bits:

```
P(undetected) = (1 - q)^k
```

For q = 0.25, k = 100:
```
P(undetected) = (0.75)^100 ≈ 3.2 × 10^{-13}
```

This is negligibly small — Eve is virtually certain to be detected.

### 5.4 Attack Surface (Classical System)

| Threat | Mitigation |
|--------|-----------|
| Eve on quantum channel | QBER detection |
| MITM on classical channel | Authentication (out of scope for simulation) |
| Replay attack | Session nonces (out of scope for simulation) |
| Denial of service | Rate limiting on API |
| Backend injection | Pydantic input validation |

---

## 6. Implementation Details

### 6.1 Simulation Engine

The simulation is implemented in pure Python using NumPy for vectorized random number generation. No quantum computing library (Qiskit, Cirq) is required — the BB84 protocol can be simulated classically since it operates on classical information (with the quantum mechanics expressed as conditional probability rules).

**Key design decisions:**
- `numpy.random.default_rng()` — modern, reproducible, thread-safe RNG
- `dataclass` for `BB84Result` — type-safe, easily serializable
- Separation of protocol logic from I/O — `bb84.py` has zero external dependencies
- Optional `seed` parameter for reproducible demos

### 6.2 Database Schema

```sql
CREATE TABLE simulations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       REAL,       -- Unix epoch
    num_qubits      INTEGER,
    eve_present     INTEGER,    -- Boolean (0/1)
    qber            REAL,
    key_length      INTEGER,
    attack_detected INTEGER,    -- Boolean (0/1)
    final_key       TEXT,
    payload         TEXT        -- Full JSON result
);
```

### 6.3 API Validation

All API inputs are validated via Pydantic v2 models:
- `num_qubits`: integer in [10, 10000]
- `eve_present`: boolean
- `qber_threshold`: float in [0.0, 1.0]
- `seed`: optional integer

Invalid inputs return HTTP 400 with a descriptive error message.

---

## 7. API Design

### 7.1 POST /api/simulate

**Request:**
```json
{
  "num_qubits": 100,
  "eve_present": false,
  "qber_threshold": 0.11,
  "seed": null
}
```

**Response (truncated):**
```json
{
  "success": true,
  "data": {
    "sim_id": 42,
    "num_qubits": 100,
    "alice_bits": [0, 1, 1, 0, ...],
    "alice_bases_labels": ["Z", "X", "Z", ...],
    "qubit_states": ["|0⟩", "|−⟩", "|1⟩", ...],
    "bob_bases_labels": ["X", "X", "Z", ...],
    "bob_results": [1, 1, 1, 0, ...],
    "matching_indices": [1, 2, 5, ...],
    "alice_sifted_key_str": "01101...",
    "bob_sifted_key_str": "01101...",
    "final_key": "a3f7c2d891e4b056...",
    "key_length": 51,
    "qber": 0.0,
    "eve_present": false,
    "attack_detected": false,
    "qber_threshold": 0.11,
    "sifting_efficiency": 0.51,
    "simulation_time_ms": 1.234
  }
}
```

---

## 8. Frontend Architecture

### 8.1 Component Hierarchy

```
App.jsx
├── [Tab Navigation]
├── Simulate Tab
│   ├── SliderInput (numQubits, qberThreshold)
│   ├── Eve Toggle Button
│   ├── Run Button
│   └── ProtocolStep × 6
├── Results Tab
│   ├── ResultsPanel (security assessment, key display)
│   └── QubitTable (per-qubit data)
├── Analysis Tab
│   └── QBERChart (Recharts LineChart)
├── History Tab
│   └── HistoryTable
└── Protocol Tab
    └── [Reference documentation]
```

### 8.2 State Management

All API state is managed by the `useSimulation` custom hook:
- `loading` — true during API call
- `result` — latest simulation result
- `history` — recent run list
- `sweepData` — QBER sweep for chart
- `error` — API error message

No global state library (Redux, Zustand) is needed — the simulation state is simple enough for React's built-in `useState`.

---

## 9. Performance & Scalability

| Qubits | Simulation Time | Response Size |
|--------|----------------|---------------|
| 10     | <1 ms          | ~2 KB         |
| 100    | ~1 ms          | ~8 KB         |
| 1,000  | ~5 ms          | ~15 KB (truncated) |
| 10,000 | ~30 ms         | ~15 KB (truncated) |

**Time complexity:** O(n) for all protocol phases  
**Space complexity:** O(n) for full result arrays  

The API truncates per-qubit arrays to 64 entries for the response payload, preventing large JSON responses for high qubit counts while still returning complete summary statistics.

---

## 10. Testing Scenarios

### Scenario A: Secure Communication (No Eve)
```
Input:  num_qubits=200, eve_present=false
Output: QBER ≈ 0%, attack_detected=false, valid shared key
```

### Scenario B: Eavesdropper Detected (Eve Active)
```
Input:  num_qubits=200, eve_present=true
Output: QBER ≈ 25%, attack_detected=true, key rejected
```

### Scenario C: Low Threshold (High Sensitivity)
```
Input:  num_qubits=500, eve_present=false, qber_threshold=0.02
Output: Tests that genuine channel noise doesn't trigger false alarms
```

### Scenario D: Minimum Qubits
```
Input:  num_qubits=10, eve_present=true
Output: Small samples may underestimate QBER — tests statistical robustness
```

---

## 11. Conclusions

This simulation demonstrates the core principles of BB84 quantum key distribution:

1. **Quantum security is physical**: The protocol's security derives from the no-cloning theorem and measurement disturbance — not from computational assumptions.

2. **Eve is always detectable** (for full intercept-resend): With 25% QBER, exceeding the 11% threshold, Eve's presence is reliably detected. The probability of her going undetected after sampling 100 bits is ~3×10⁻¹³.

3. **Threshold selection is critical**: Too low → false alarms from channel noise. Too high → Eve can intercept a fraction of qubits undetected. The 11% threshold reflects the standard literature value for practical fiber-optic QKD.

4. **Sifting efficiency (~50%)**: Only half of transmitted qubits contribute to the final key. This is an inherent cost of the BB84 protocol, addressed by protocols like E91 (entanglement-based) and BBM92.

---

## 12. References

1. Bennett, C.H., & Brassard, G. (1984). Quantum cryptography: Public key distribution and coin tossing. *Proceedings of IEEE International Conference on Computers, Systems and Signal Processing*, 175–179.

2. Shor, P.W., & Preskill, J. (2000). Simple proof of security of the BB84 quantum key distribution protocol. *Physical Review Letters*, 85(2), 441–444.

3. Gisin, N., Ribordy, G., Tittel, W., & Zbinden, H. (2002). Quantum cryptography. *Reviews of Modern Physics*, 74(1), 145.

4. Lo, H.K., Ma, X., & Chen, K. (2005). Decoy state quantum key distribution. *Physical Review Letters*, 94(23), 230504.

5. Nielsen, M.A., & Chuang, I.L. (2010). *Quantum Computation and Quantum Information*. Cambridge University Press.
