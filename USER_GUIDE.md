# BB84 QKD Simulator — User Guide

## Table of Contents

1. [Introduction to BB84](#1-introduction-to-bb84)
2. [System Overview](#2-system-overview)
3. [Installation](#3-installation)
4. [Running the Project](#4-running-the-project)
5. [Using the UI](#5-using-the-ui)
6. [Example Simulation Walkthrough](#6-example-simulation-walkthrough)
7. [Testing Scenarios](#7-testing-scenarios)
8. [Expected Outputs](#8-expected-outputs)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Introduction to BB84

### What is Quantum Key Distribution?

Quantum Key Distribution (QKD) is a method of securely exchanging cryptographic keys between two parties — traditionally called **Alice** (sender) and **Bob** (receiver) — using the principles of quantum mechanics. Unlike classical encryption, whose security relies on mathematical hardness (e.g., difficulty of factoring large numbers), QKD's security is guaranteed by the laws of physics.

The key advantage: **any eavesdropper (Eve) attempting to intercept the key will inevitably disturb the quantum states**, introducing detectable errors. Alice and Bob can then measure these errors and know with certainty whether the channel was compromised.

### What is BB84?

BB84 (Bennett-Brassard 1984) is the first and most widely studied QKD protocol. It works as follows:

1. Alice prepares **qubits** (quantum bits) in one of four possible states using two different **bases**:
   - **Z basis (rectilinear)**: `|0⟩` and `|1⟩` — like vertical/horizontal polarization
   - **X basis (diagonal)**: `|+⟩` and `|−⟩` — like 45°/135° polarization

2. Alice sends these qubits to Bob over a quantum channel.

3. Bob **randomly chooses** a basis for each measurement. If he picks the same basis as Alice, he gets the correct bit. If not, he gets a random result.

4. Alice and Bob publicly compare which **bases** they used (not the bits themselves) and discard all positions where they chose different bases. What remains is the **sifted key**.

5. They check a sample of the sifted key for errors. If the **Quantum Bit Error Rate (QBER)** is below a threshold, no eavesdropping occurred and the key is safe to use.

### Why Can't Eve Simply Listen?

In quantum mechanics, measuring a system disturbs it. Eve cannot:
- **Copy** a qubit (the no-cloning theorem forbids this)
- **Measure** without disturbing (she must guess the basis)

If Eve guesses wrong (50% of the time), she sends Bob a qubit in the wrong state, which causes Bob to get the wrong bit ~50% of those times — introducing approximately **25% errors** in the sifted key. This is far above the 11% detection threshold.

---

## 2. System Overview

The simulator consists of two components:

### Backend (Python / FastAPI)
- Implements the full BB84 protocol in `backend/quantum/bb84.py`
- Exposes a REST API at `http://localhost:8000`
- Persists simulation history to an SQLite database
- Provides QBER sweep analysis for graphing

### Frontend (React)
- Interactive web UI at `http://localhost:3000`
- Control panel for simulation parameters
- Per-qubit data table
- QBER vs qubit-count graphs
- Run history log

### Data Flow
```
User clicks "Run Simulation"
    → React sends POST /api/simulate
    → FastAPI validates request
    → BB84Protocol.run() executes all protocol phases
    → Result logged to SQLite
    → JSON response returned
    → React renders results, table, charts
```

---

## 3. Installation

### Prerequisites

| Requirement | Version | Check command |
|------------|---------|--------------|
| Python | 3.9 or higher | `python --version` |
| pip | latest | `pip --version` |
| Node.js | 16 or higher | `node --version` |
| npm | 7 or higher | `npm --version` |

### Step 1: Clone / Download the Project

```bash
# If using git:
git clone <your-repo-url>
cd bb84_qkd

# Or extract the zip file and navigate to the folder
```

### Step 2: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `fastapi` — web framework
- `uvicorn` — ASGI server
- `numpy` — numerical computation
- `httpx` — async HTTP client
- `python-dotenv` — environment variable support

### Step 3: Install Node.js Dependencies

```bash
cd ../frontend
npm install
```

This installs React, Recharts, Axios, and all frontend dependencies (~300 MB, mostly dev tools).

---

## 4. Running the Project

### Start the Backend

Open a terminal window and run:

```bash
cd backend
python main.py
```

You should see:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**API documentation** is automatically available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Start the Frontend

Open a **second** terminal window:

```bash
cd frontend
npm start
```

The browser will automatically open `http://localhost:3000`. If it doesn't, navigate there manually.

> ⚠️ **Both terminals must be running simultaneously** for the app to work.

### Verify Everything is Working

1. Visit `http://localhost:8000/api/health` — should return `{"status":"ok"}`
2. Visit `http://localhost:3000` — the BB84 simulator UI should load
3. The status indicator in the top-right of the UI should show a green dot and "Ready"

---

## 5. Using the UI

The interface has five tabs:

### ⚛ Simulate Tab

This is where you configure and run simulations.

**Controls:**

| Control | Description | Default |
|---------|-------------|---------|
| Number of Qubits | Drag slider to set how many qubits Alice sends | 100 |
| QBER Threshold | Security threshold — QBER above this triggers attack detection | 11% |
| Eve Toggle | Click to enable/disable the adversary attack | OFF |
| Run BB84 Simulation | Execute the protocol | — |

**Steps:**
1. Set the number of qubits (try 200 for a good balance of speed and statistical reliability)
2. Choose whether Eve should be active
3. Click **▶ Run BB84 Simulation**
4. The app automatically switches to the Results tab

The tab also shows the **Protocol Walkthrough** — a visual 6-step diagram of the BB84 protocol phases, and a text-based data flow diagram.

---

### 📊 Results Tab

Displays the complete results of the last simulation run.

**Security Assessment Banner:**
- 🚨 Red banner: QBER exceeded threshold → attack detected, key rejected
- ✅ Green banner: QBER within threshold → secure, key accepted

**Metric Cards:**
- **QBER** — error rate (green = safe, red = attack)
- **Key Length** — number of bits in the sifted key
- **Qubits Sent** — total qubits transmitted
- **Eve Active** — whether adversary was enabled
- **Sim Time** — milliseconds to run the simulation
- **Attack Detected** — final security verdict

**Final Shared Key:**
- Shown only when no attack was detected
- 32-character hexadecimal string derived via SHA-256
- This is the secret that Alice and Bob would use for subsequent encryption

**Sifted Key Preview:**
- Shows first 64 bits of both Alice's and Bob's sifted keys side by side
- Without Eve: these should be **identical**
- With Eve: some positions will differ (shown as error positions)

**Qubit Protocol Table:**
- Shows per-qubit breakdown: Alice's bit, Alice's basis, qubit state, Bob's basis, Bob's result
- Green rows = matching bases (included in sifted key)
- If Eve is active: Eve's basis and result are also shown
- Large simulations are truncated to first 64 rows; click "Show all N qubits" to expand

---

### 📈 Analysis Tab

Provides deeper statistical analysis.

**QBER vs Qubit Count Graph:**
1. Click **▶ Run Sweep Analysis**
2. Wait ~5–10 seconds (runs 70 simulations: 7 qubit counts × 5 runs × 2 scenarios)
3. Two line series appear:
   - **Blue line**: Without Eve — QBER stays near 0%
   - **Red line**: With Eve — QBER converges to ~25% as qubit count increases
   - **Yellow dashed line**: 11% detection threshold

**Security & Performance Analysis:**
Technical explanations of:
- Time complexity (O(n))
- Sifting efficiency (~50%)
- No-cloning theorem
- Attack surface
- Threshold trade-offs
- Scalability

---

### 🗒 History Tab

Shows the most recent 15 simulation runs stored in the SQLite database.

**Columns:** ID, Qubits, Eve Active, QBER, Key Length, Status (SECURE/DETECTED), Time

Click **Clear history** to wipe all stored runs.

---

### 📘 Protocol Tab

Complete reference documentation for the BB84 protocol, including:
- Qubit encoding formulas
- Measurement rules
- Security proof sketch
- Real-world considerations
- Academic references

---

## 6. Example Simulation Walkthrough

Here is a step-by-step walkthrough of a typical simulation run.

### Setup
- Qubits: **200**
- Eve: **OFF**
- QBER Threshold: **11%**

### What Happens (Internally)

**Step 1 — Alice prepares:**
```
Qubit  0: bit=1, basis=X → state=|−⟩
Qubit  1: bit=0, basis=Z → state=|0⟩
Qubit  2: bit=1, basis=Z → state=|1⟩
Qubit  3: bit=0, basis=X → state=|+⟩
...
```

**Step 2 — Qubits transmitted** (no Eve, no disturbance)

**Step 3 — Bob measures:**
```
Qubit  0: Bob basis=Z  (MISMATCH with Alice's X) → random result: 0
Qubit  1: Bob basis=Z  (MATCH with Alice's Z)    → result: 0 ✓
Qubit  2: Bob basis=X  (MISMATCH with Alice's Z) → random result: 1
Qubit  3: Bob basis=X  (MATCH with Alice's X)    → result: 0 ✓
...
```

**Step 4 — Sifting:**
Alice and Bob publicly compare: "I used Z, X, Z, X..." / "I used Z, Z, X, X..."
They keep only matching positions: qubits 1, 3, ...
~100 qubits survive (50% of 200).

**Step 5 — QBER:**
Alice sifted: `0 0 1 1 0 1 ...`
Bob sifted:   `0 0 1 1 0 1 ...`
Differences: **0** → QBER = **0.0%**

**Step 6 — Key accepted!**
Final key (SHA-256 derived): `a3f7c2d891e4b056...`

### What You See in the UI

- Green ✅ banner: "KEY EXCHANGE SECURE"
- QBER card: **0.0%** (green)
- Key Length: ~100 bits
- Sifted key preview: Alice and Bob lines are identical
- Final key displayed in the indigo box

---

## 7. Testing Scenarios

### Scenario 1: Basic Secure Exchange
```
Qubits: 200
Eve: OFF
Threshold: 11%
Expected: QBER ≈ 0%, green banner, valid key displayed
```

### Scenario 2: Eve Detected
```
Qubits: 200
Eve: ON
Threshold: 11%
Expected: QBER ≈ 25%, red 🚨 banner, "INTRUSION DETECTED", no key shown
```

### Scenario 3: Very Small Sample (Statistical Noise)
```
Qubits: 10
Eve: ON
Threshold: 11%
Expected: QBER may vary widely (5%–50%) due to small sample size
          Sometimes detection fails — demonstrates why large n is important
```

### Scenario 4: High Sensitivity Threshold
```
Qubits: 500
Eve: OFF
Threshold: 2%
Expected: Demonstrates how a very tight threshold protects against partial eavesdropping
          Even without Eve, QBER = 0%, so key accepted
```

### Scenario 5: Large-Scale Simulation
```
Qubits: 1000
Eve: ON
Threshold: 11%
Expected: QBER converges closely to 25%, attack reliably detected
          Demonstrates statistical stability at scale
```

### Scenario 6: Sweep Analysis Comparison
```
Tab: Analysis
Click: "Run Sweep Analysis"
Expected: Two lines — blue near 0%, red near 25%
          Clear visual separation above/below the 11% threshold
```

---

## 8. Expected Outputs

### Without Eve

| Field | Expected Value |
|-------|---------------|
| QBER | 0.0% (ideal noiseless channel) |
| Attack Detected | NO |
| Key Length | ~50% of num_qubits |
| Alice/Bob sifted keys | Identical |
| Final key | 32-char hex string |
| Security banner | ✅ Green "KEY EXCHANGE SECURE" |

### With Eve

| Field | Expected Value |
|-------|---------------|
| QBER | ~25% (±5% statistical variation) |
| Attack Detected | YES |
| Key Length | ~50% of num_qubits (sifting still works) |
| Alice/Bob sifted keys | Differ at ~25% of positions |
| Final key | NOT displayed (key rejected) |
| Security banner | 🚨 Red "INTRUSION DETECTED" |

### QBER Sweep

| Scenario | Expected QBER at 1000 qubits |
|----------|------------------------------|
| No Eve | ~0% |
| With Eve | ~25% |

---

## 9. Troubleshooting

### ❌ "Connection refused" or API errors in the UI

**Cause**: Backend is not running.
**Fix**:
```bash
cd backend
python main.py
```
Verify the backend is accessible: `curl http://localhost:8000/api/health`

---

### ❌ `ModuleNotFoundError: No module named 'fastapi'`

**Fix**:
```bash
cd backend
pip install -r requirements.txt
```
If using multiple Python versions: `pip3 install -r requirements.txt`

---

### ❌ `npm: command not found`

**Fix**: Install Node.js from [https://nodejs.org](https://nodejs.org). Node 16+ includes npm.

---

### ❌ Frontend shows blank page

**Cause**: Usually a JavaScript error. 
**Fix**: Open browser developer tools (F12), check Console tab for errors.
Common fix: `cd frontend && npm install && npm start`

---

### ❌ Port 8000 or 3000 already in use

**Fix (macOS/Linux)**:
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Fix (Windows)**:
```bash
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

---

### ❌ Database errors

**Fix**: Delete the auto-generated database and restart:
```bash
rm backend/logs/simulations.db
python backend/main.py
```

---

### ❌ QBER is unexpectedly high without Eve

**Explanation**: With very few qubits (< 20), statistical variation is high. QBER can fluctuate between 0% and 20% purely by chance.
**Fix**: Increase num_qubits to 100+ for reliable statistics.

---

### ✅ Verifying the Installation Worked

Run this quick test:
```bash
cd backend
python -c "
from quantum.bb84 import BB84Protocol
result = BB84Protocol(num_qubits=100, eve_present=False).run()
print(f'QBER (no Eve): {result.qber:.1%}')
result_eve = BB84Protocol(num_qubits=100, eve_present=True).run()
print(f'QBER (with Eve): {result_eve.qber:.1%}')
print('Installation successful!')
"
```

Expected output:
```
QBER (no Eve): 0.0%
QBER (with Eve): ~25.0%
Installation successful!
```
