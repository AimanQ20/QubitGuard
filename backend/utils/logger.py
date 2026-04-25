"""
utils/logger.py — SQLite-backed simulation run logger.

Persists every simulation run to a local database for audit trails,
replay, and longitudinal QBER analysis.
"""

import sqlite3
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(__file__).parent.parent / "logs" / "simulations.db"


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the simulations table if it does not exist."""
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS simulations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       REAL    NOT NULL,
            num_qubits      INTEGER NOT NULL,
            eve_present     INTEGER NOT NULL,
            qber            REAL    NOT NULL,
            key_length      INTEGER NOT NULL,
            attack_detected INTEGER NOT NULL,
            final_key       TEXT    NOT NULL,
            payload         TEXT    NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def log_simulation(result_dict: Dict[str, Any]) -> int:
    """
    Persist a simulation result to the database.

    Args:
        result_dict : Serialized BB84Result from result_to_dict()

    Returns:
        The auto-incremented row ID
    """
    conn = _get_conn()
    cur = conn.execute(
        """
        INSERT INTO simulations
            (timestamp, num_qubits, eve_present, qber, key_length, attack_detected, final_key, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            time.time(),
            result_dict["num_qubits"],
            int(result_dict["eve_present"]),
            result_dict["qber"],
            result_dict["key_length"],
            int(result_dict["attack_detected"]),
            result_dict["final_key"],
            json.dumps(result_dict),
        ),
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return row_id


def get_recent_simulations(limit: int = 20) -> List[Dict[str, Any]]:
    """Return the most recent simulation summaries."""
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT id, timestamp, num_qubits, eve_present, qber, key_length,
               attack_detected, final_key
        FROM simulations
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_simulation_by_id(sim_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve full simulation payload by ID."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT payload FROM simulations WHERE id = ?", (sim_id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return json.loads(row["payload"])


def clear_simulations() -> int:
    """Delete all simulation records. Returns number of deleted rows."""
    conn = _get_conn()
    cur = conn.execute("DELETE FROM simulations")
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return deleted
