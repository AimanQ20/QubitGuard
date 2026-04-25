# ⚛ BB84 Quantum Key Distribution Simulator

A complete, production-quality simulation of the **BB84 Quantum Key Distribution (QKD) protocol** — the world's first quantum cryptographic protocol, proposed by Charles Bennett and Gilles Brassard in 1984.

This project simulates secure quantum key exchange between two parties (**Alice** and **Bob**) with an optional adversary (**Eve**) performing an intercept-resend attack. It includes a full REST API backend, React frontend, SQLite logging, QBER analysis, and comprehensive documentation.

---

## 📁 Project Structure

```
bb84_qkd/
├── backend/
│   ├── main.py                  # FastAPI application + all endpoints
│   ├── requirements.txt         # Python dependencies
│   ├── quantum/
│   │   ├── __init__.py
│   │   └── bb84.py              # Core BB84 protocol engine
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── analysis.py          # QBER sweep, serialization, reports
│   │   └── logger.py            # SQLite simulation logging
│   └── logs/                    # Auto-created; stores simulations.db
│
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── index.css
│       ├── App.jsx              # Main application UI
│       ├── hooks/
│       │   └── useSimulation.js # API communication hook
│       └── components/
│           ├── QubitTable.jsx   # Per-qubit protocol table
│           ├── QBERChart.jsx    # Recharts QBER visualization
│           ├── ResultsPanel.jsx # Security assessment panel
│           └── HistoryTable.jsx # Run history log
│
├── docs/
│   └── (generated reports go here)
│
├── README.md
├── REPORT.md
├── USER_GUIDE.md
└── .gitignore
```

---

## 🚀 Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm start
# UI available at http://localhost:3000
```

---

## ✨ Features

| Feature | Description |
|---|---|
| **Full BB84 Protocol** | All phases: preparation, transmission, measurement, sifting, QBER, key derivation |
| **Eve (Adversary)** | Toggleable intercept-resend attack simulation |
| **QBER Detection** | Configurable threshold-based intrusion detection |
| **Per-Qubit Table** | Full visibility into Alice/Bob/Eve state at every qubit |
| **Sweep Analysis** | QBER vs qubit count graph comparing both scenarios |
| **Run History** | SQLite-persisted log of all simulation runs |
| **REST API** | Full FastAPI backend with Swagger documentation |

---

## 🔌 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/simulate` | Run BB84 simulation |
| `GET` | `/api/results` | List recent runs |
| `GET` | `/api/results/{id}` | Get run by ID |
| `POST` | `/api/sweep` | QBER vs qubit sweep |
| `DELETE` | `/api/results` | Clear history |
| `GET` | `/api/health` | Health check |

---

## 🛡 Security Properties Simulated

- **No-cloning theorem**: Eve must measure and re-send — cannot silently copy qubits
- **Measurement disturbance**: Wrong basis measurement collapses the quantum state randomly
- **QBER detection**: ~25% error rate introduced by Eve, detected above 11% threshold
- **Key sifting**: Only matching-basis measurements retained — ~50% efficiency

---

## 📚 Documentation

- [`USER_GUIDE.md`](USER_GUIDE.md) — Full installation and usage guide
- [`REPORT.md`](REPORT.md) — Technical design and security analysis
- [`http://localhost:8000/docs`](http://localhost:8000/docs) — Interactive API documentation (when running)

---

## 🎓 Academic Context

This project was developed as a university cybersecurity/quantum cryptography project demonstrating:
- Quantum key distribution fundamentals
- Adversarial threat modeling
- Intrusion detection via error rate analysis
- Full-stack secure systems development
