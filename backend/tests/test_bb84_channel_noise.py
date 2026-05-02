"""Tests for optional channel noise (honest noisy channel)."""

import sys
from pathlib import Path

import numpy as np

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from quantum.bb84 import BB84Protocol


def test_no_eve_channel_noise_bounded_qber_and_deterministic_flip_count():
    thresh = 0.11
    p = 0.08
    proto = BB84Protocol(
        num_qubits=500,
        eve_present=False,
        qber_threshold=thresh,
        channel_noise_rate=p,
        seed=12345,
    )
    r = proto.run()

    assert r.qber < thresh
    assert not r.attack_detected

    L = len(r.alice_sifted_key)
    k = sum(
        1 for a, b in zip(r.alice_sifted_key, r.bob_sifted_key)
        if a != b
    )
    expected_k = int(np.floor(p * L))

    assert k == expected_k
    assert r.qber == round(k / L if L else 0.0, 4)


def test_constructor_rejects_noise_gte_threshold():
    try:
        BB84Protocol(
            num_qubits=100,
            qber_threshold=0.08,
            channel_noise_rate=0.08,
        )
        assert False, "expected ValueError"
    except ValueError as e:
        assert "threshold" in str(e).lower() or "strictly" in str(e).lower()
