import sys
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app


client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "ok"
    assert "service" in payload


def test_simulate_without_eve_returns_success():
    response = client.post(
        "/api/simulate",
        json={
            "num_qubits": 200,
            "eve_present": False,
            "qber_threshold": 0.11,
        },
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["eve_present"] is False
    assert "qber" in payload["data"]
    assert "attack_detected" in payload["data"]


def test_simulate_with_eve_returns_success():
    response = client.post(
        "/api/simulate",
        json={
            "num_qubits": 200,
            "eve_present": True,
            "qber_threshold": 0.11,
        },
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["eve_present"] is True
    assert "qber" in payload["data"]
    assert "attack_detected" in payload["data"]


def test_simulate_rejects_num_qubits_below_min():
    response = client.post(
        "/api/simulate",
        json={
            "num_qubits": 9,
            "eve_present": False,
            "qber_threshold": 0.11,
        },
    )
    assert response.status_code == 422


def test_simulate_rejects_channel_noise_not_below_threshold():
    response = client.post(
        "/api/simulate",
        json={
            "num_qubits": 100,
            "eve_present": False,
            "qber_threshold": 0.11,
            "channel_noise_rate": 0.11,
        },
    )
    assert response.status_code == 422


def test_simulate_with_channel_noise_below_threshold_returns_success():
    response = client.post(
        "/api/simulate",
        json={
            "num_qubits": 300,
            "eve_present": False,
            "qber_threshold": 0.11,
            "channel_noise_rate": 0.06,
            "seed": 7,
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["channel_noise_rate"] == 0.06
    assert data["attack_detected"] is False
    assert data["qber"] < data["qber_threshold"]
