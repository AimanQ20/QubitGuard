"""
main.py — FastAPI backend for the BB84 Quantum Key Distribution Simulator.

Architecture:
    POST /api/simulate      → Run a single BB84 simulation
    GET  /api/results       → List recent simulation runs
    GET  /api/results/{id}  → Retrieve a specific run by ID
    POST /api/sweep         → Run QBER vs qubit-count sweep for graphing
    DELETE /api/results     → Clear simulation history
    GET  /api/health        → Health check

CORS is enabled for local React dev server (http://localhost:3000).
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
import sys
import os

# Ensure the backend directory is in the Python path
sys.path.insert(0, os.path.dirname(__file__))

from quantum.bb84 import BB84Protocol
from utils.analysis import result_to_dict, run_qber_sweep, generate_summary_report
from utils.logger import init_db, log_simulation, get_recent_simulations, get_simulation_by_id, clear_simulations

# ── App setup ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="BB84 QKD Simulator API",
    description=(
        "REST API for simulating Quantum Key Distribution using the BB84 protocol. "
        "Supports Alice/Bob key generation, Eve intercept-resend attacks, and QBER analysis."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise the SQLite database on startup
@app.on_event("startup")
def on_startup():
    init_db()


# ── Request / Response Models ──────────────────────────────────────────────

class SimulateRequest(BaseModel):
    """Request body for POST /api/simulate."""
    num_qubits: int = Field(
        default=100,
        ge=10,
        le=10000,
        description="Number of qubits to transmit (10–10,000).",
    )
    eve_present: bool = Field(
        default=False,
        description="If True, Eve performs an intercept-resend attack.",
    )
    qber_threshold: float = Field(
        default=0.11,
        ge=0.0,
        le=1.0,
        description="QBER threshold above which an attack is flagged (default 11%).",
    )
    seed: Optional[int] = Field(
        default=None,
        description="Optional random seed for reproducible results.",
    )
    channel_noise_rate: float = Field(
        default=0.0,
        ge=0.0,
        lt=1.0,
        description=(
            "Simulated imperfect channel/detectors: without Eve QBER stays ≤ rate and < threshold; "
            "with Eve, extra random flips on the sifted key."
        ),
    )

    @field_validator("num_qubits")
    @classmethod
    def validate_qubits(cls, v):
        if v < 10:
            raise ValueError("num_qubits must be at least 10")
        return v

    @model_validator(mode="after")
    def noise_below_qber_threshold(self):
        if self.channel_noise_rate >= self.qber_threshold:
            raise ValueError(
                "channel_noise_rate must be strictly less than qber_threshold."
            )
        return self


class SweepRequest(BaseModel):
    """Request body for POST /api/sweep."""
    qubit_counts: Optional[List[int]] = Field(
        default=None,
        description="List of qubit counts to sweep. Defaults to [10, 20, 50, 100, 200, 500].",
    )
    eve_present: bool = Field(default=False)
    runs_per_count: int = Field(default=5, ge=1, le=20)
    qber_threshold: float = Field(default=0.11, ge=0.0, le=1.0)
    channel_noise_rate: float = Field(
        default=0.0,
        ge=0.0,
        lt=1.0,
        description="Same semantics as SimulateRequest.channel_noise_rate.",
    )

    @model_validator(mode="after")
    def sweep_noise_below_threshold(self):
        if self.channel_noise_rate >= self.qber_threshold:
            raise ValueError(
                "channel_noise_rate must be strictly less than qber_threshold."
            )
        return self


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["System"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "BB84 QKD Simulator"}


@app.post("/api/simulate", tags=["Simulation"])
def simulate(req: SimulateRequest):
    """
    Run a full BB84 protocol simulation.

    Executes all protocol phases:
    1. Alice prepares random qubits
    2. (Optional) Eve intercepts
    3. Bob measures
    4. Basis sifting
    5. QBER computation
    6. Attack detection
    7. Key derivation

    Returns full simulation data including per-qubit tables,
    sifted keys, QBER, and attack status.
    """
    try:
        protocol = BB84Protocol(
            num_qubits=req.num_qubits,
            eve_present=req.eve_present,
            qber_threshold=req.qber_threshold,
            seed=req.seed,
            channel_noise_rate=req.channel_noise_rate,
        )
        result = protocol.run()
        result_dict = result_to_dict(result)

        # Persist to DB
        sim_id = log_simulation(result_dict)
        result_dict["sim_id"] = sim_id

        # Attach plain-text report
        result_dict["summary_report"] = generate_summary_report(result)

        return {"success": True, "data": result_dict}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")


@app.get("/api/results", tags=["History"])
def list_results(limit: int = Query(default=20, ge=1, le=100)):
    """
    List recent simulation runs (summary only).

    Returns timestamp, qubit count, Eve status, QBER, and attack detection
    for the most recent runs ordered by newest first.
    """
    rows = get_recent_simulations(limit=limit)
    return {"success": True, "data": rows, "count": len(rows)}


@app.get("/api/results/{sim_id}", tags=["History"])
def get_result(sim_id: int):
    """Retrieve full simulation data for a specific run by its ID."""
    data = get_simulation_by_id(sim_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Simulation ID {sim_id} not found.")
    return {"success": True, "data": data}


@app.post("/api/sweep", tags=["Analysis"])
def qber_sweep(req: SweepRequest):
    """
    Run a QBER vs qubit-count sweep for graph generation.

    Runs multiple simulations across different qubit counts and returns
    aggregate statistics (mean, min, max, std dev of QBER) for plotting.
    """
    try:
        counts = req.qubit_counts or [10, 20, 50, 100, 200, 500]
        # Cap total runs to keep response time reasonable
        if len(counts) * req.runs_per_count > 200:
            raise HTTPException(
                status_code=400,
                detail="Too many total runs. Reduce qubit_counts or runs_per_count.",
            )
        sweep_data = run_qber_sweep(
            qubit_counts=counts,
            eve_present=req.eve_present,
            runs_per_count=req.runs_per_count,
            qber_threshold=req.qber_threshold,
            channel_noise_rate=req.channel_noise_rate,
        )
        return {"success": True, "data": sweep_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/results", tags=["History"])
def delete_results():
    """Clear all simulation history from the database."""
    deleted = clear_simulations()
    return {"success": True, "deleted": deleted}


# ── Entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
