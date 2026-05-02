"""
bb84.py — Core BB84 Quantum Key Distribution Protocol Implementation

This module implements the full BB84 protocol as described in:
    Bennett & Brassard (1984), "Quantum cryptography: Public key distribution and coin tossing"

Protocol Phases:
    1. Alice generates random bits and bases, encodes qubits
    2. Qubits are transmitted over a (simulated) quantum channel
    3. Bob randomly selects measurement bases and measures qubits
    4. Classical channel: basis sifting to extract shared key
    5. QBER estimation to detect eavesdropping

Security Guarantees Simulated:
    - No-cloning theorem: Eve cannot copy a qubit without disturbing it
    - Measurement disturbance: Any measurement on a qubit in a wrong basis collapses the state
"""

import numpy as np
import hashlib
import time
from typing import Optional
from dataclasses import dataclass, field


# --------------------------------------------------------------------------- #
#  Qubit basis and encoding constants                                          #
# --------------------------------------------------------------------------- #
BASIS_Z = 0   # Rectilinear (computational) basis  |0⟩ / |1⟩
BASIS_X = 1   # Diagonal (Hadamard) basis          |+⟩ / |−⟩

BIT_0 = 0
BIT_1 = 1

# Qubit state labels for visualization
QUBIT_STATES = {
    (BASIS_Z, BIT_0): "|0⟩",
    (BASIS_Z, BIT_1): "|1⟩",
    (BASIS_X, BIT_0): "|+⟩",
    (BASIS_X, BIT_1): "|−⟩",
}

BASIS_LABELS = {BASIS_Z: "Z (↕)", BASIS_X: "X (↗)"}


@dataclass
class BB84Result:
    """
    Complete result object returned after a BB84 simulation run.

    Attributes:
        num_qubits          : Number of qubits transmitted
        alice_bits          : Alice's randomly generated raw bit string
        alice_bases         : Alice's randomly chosen encoding bases
        qubit_states        : Human-readable qubit states Alice prepared
        bob_bases           : Bob's randomly chosen measurement bases
        bob_results         : Bob's measurement outcomes
        matching_indices    : Positions where Alice and Bob used the same basis
        alice_sifted_key    : Alice's sifted key (after basis reconciliation)
        bob_sifted_key      : Bob's sifted key
        final_key           : Final shared secret key (hex encoded)
        key_length          : Length of the final sifted key (bits)
        qber                : Quantum Bit Error Rate (0.0 – 1.0)
        eve_present         : Whether Eve was active during simulation
        eve_bases           : Eve's randomly chosen interception bases (if active)
        eve_results         : Eve's measurement results (if active)
        attack_detected     : Whether the QBER threshold triggered an intrusion alert
        qber_threshold      : The threshold used for detection
        sifting_efficiency  : Fraction of qubits that survived sifting
        simulation_time_ms  : Wall-clock time for the simulation in milliseconds
        channel_noise_rate  : Applied channel-noise parameter (honest-case QBER capped below threshold when Eve is off)
    """
    num_qubits: int
    alice_bits: list
    alice_bases: list
    qubit_states: list
    bob_bases: list
    bob_results: list
    matching_indices: list
    alice_sifted_key: list
    bob_sifted_key: list
    final_key: str
    key_length: int
    qber: float
    eve_present: bool
    eve_bases: list
    eve_results: list
    attack_detected: bool
    qber_threshold: float
    sifting_efficiency: float
    simulation_time_ms: float
    error_positions: list = field(default_factory=list)
    channel_noise_rate: float = 0.0


class BB84Protocol:
    """
    Full simulation of the BB84 Quantum Key Distribution protocol.

    Usage:
        proto = BB84Protocol(num_qubits=100, eve_present=True, qber_threshold=0.11)
        result = proto.run()

    Without Eve and with channel_noise_rate < qber_threshold, QBER equals
    floor(channel_noise_rate * L) / L for sifted length L — always strictly below
    the intrusion threshold — modeling a realistic but honest noisy channel.

    """

    # QBER ≈ 25% expected when Eve uses intercept-resend (optimal for Eve).
    # Theoretical security threshold: ~11% (allowing for channel noise).
    DEFAULT_QBER_THRESHOLD = 0.11

    def __init__(
        self,
        num_qubits: int = 100,
        eve_present: bool = False,
        qber_threshold: float = DEFAULT_QBER_THRESHOLD,
        seed: Optional[int] = None,
        channel_noise_rate: float = 0.0,
    ):
        if num_qubits < 10:
            raise ValueError("num_qubits must be at least 10 for meaningful key sifting.")
        if num_qubits > 10_000:
            raise ValueError("num_qubits capped at 10,000 for web demo performance.")

        self.num_qubits = num_qubits
        self.eve_present = eve_present
        self.qber_threshold = qber_threshold
        self.channel_noise_rate = channel_noise_rate
        self.rng = np.random.default_rng(seed)

        if self.channel_noise_rate < 0.0 or self.channel_noise_rate >= 1.0:
            raise ValueError("channel_noise_rate must be in [0.0, 1.0).")
        if self.channel_noise_rate >= self.qber_threshold:
            raise ValueError(
                "channel_noise_rate must be strictly less than qber_threshold "
                "(honest noisy channel stays below intrusion threshold)."
            )

    # ------------------------------------------------------------------ #
    #  Phase 1 – Alice prepares qubits                                    #
    # ------------------------------------------------------------------ #
    def _alice_prepare(self):
        """
        Alice generates random bits and random encoding bases,
        then encodes each bit as a qubit in the chosen basis.

        Z basis encoding:  0 → |0⟩,  1 → |1⟩
        X basis encoding:  0 → |+⟩,  1 → |−⟩

        Returns:
            bits   : np.ndarray of shape (n,) with values in {0, 1}
            bases  : np.ndarray of shape (n,) with values in {0=Z, 1=X}
            states : list of human-readable qubit state labels
        """
        bits  = self.rng.integers(0, 2, size=self.num_qubits)
        bases = self.rng.integers(0, 2, size=self.num_qubits)
        states = [QUBIT_STATES[(bases[i], bits[i])] for i in range(self.num_qubits)]
        return bits, bases, states

    # ------------------------------------------------------------------ #
    #  Phase 2 – Eve intercepts (optional)                               #
    # ------------------------------------------------------------------ #
    def _eve_intercept(self, alice_bits, alice_bases):
        """
        Eve performs an intercept-resend attack.

        Eve randomly guesses a basis for each qubit.
        If she guesses correctly, she measures without disturbance.
        If she guesses wrong (50% of the time), she collapses the
        qubit to a random state — introducing ~25% QBER downstream.

        This models the *no-cloning theorem*: Eve cannot copy the qubit
        and must measure it, necessarily disturbing the quantum state.

        Returns:
            eve_bases   : Eve's chosen measurement bases
            eve_results : Eve's measured bit values
            disturbed_bits : What Alice's bits look like AFTER Eve's interference
        """
        eve_bases   = self.rng.integers(0, 2, size=self.num_qubits)
        eve_results = np.zeros(self.num_qubits, dtype=int)
        disturbed_bits = alice_bits.copy()

        for i in range(self.num_qubits):
            if eve_bases[i] == alice_bases[i]:
                # Eve guessed right — perfect measurement, no disturbance
                eve_results[i] = alice_bits[i]
            else:
                # Wrong basis — qubit collapses to random state (50/50)
                eve_results[i] = self.rng.integers(0, 2)
                # The resent qubit is now in Eve's measured state,
                # which is random from Bob's perspective
                disturbed_bits[i] = eve_results[i]

        return eve_bases, eve_results, disturbed_bits

    # ------------------------------------------------------------------ #
    #  Phase 3 – Bob measures qubits                                      #
    # ------------------------------------------------------------------ #
    def _bob_measure(self, transmitted_bits, alice_bases):
        """
        Bob randomly selects measurement bases and measures each qubit.

        If Bob's basis matches Alice's (or Eve's resent) encoding basis:
            → correct measurement (deterministic result)
        If bases differ:
            → random result (50/50), introduces errors

        Returns:
            bob_bases   : Bob's randomly chosen measurement bases
            bob_results : Bob's measurement outcomes
        """
        bob_bases   = self.rng.integers(0, 2, size=self.num_qubits)
        bob_results = np.zeros(self.num_qubits, dtype=int)

        for i in range(self.num_qubits):
            if bob_bases[i] == alice_bases[i]:
                # Matching basis → deterministic correct result
                bob_results[i] = transmitted_bits[i]
            else:
                # Mismatched basis → quantum measurement collapses to random
                bob_results[i] = self.rng.integers(0, 2)

        return bob_bases, bob_results

    # ------------------------------------------------------------------ #
    #  Phase 4 – Classical channel: sifting                              #
    # ------------------------------------------------------------------ #
    def _sift_key(self, alice_bits, alice_bases, bob_bases, bob_results):
        """
        Alice and Bob publicly announce (only) their chosen bases.
        They keep only positions where bases matched.

        This is the KEY SIFTING step. On average, ~50% of bits survive.

        Returns:
            matching_indices : Positions where bases agreed
            alice_sifted_key : Alice's bits at matching positions
            bob_sifted_key   : Bob's bits at matching positions
        """
        matching_indices = [
            i for i in range(self.num_qubits)
            if alice_bases[i] == bob_bases[i]
        ]
        alice_sifted = [int(alice_bits[i]) for i in matching_indices]
        bob_sifted   = [int(bob_results[i]) for i in matching_indices]

        return matching_indices, alice_sifted, bob_sifted

    # ------------------------------------------------------------------ #
    #  Post-sifting: imperfect channel (optional)                          #
    # ------------------------------------------------------------------ #
    def _apply_channel_noise_to_sifted(self, alice_sifted: list, bob_sifted: list) -> list:
        """
        Flip bits on Bob's sifted string to imitate detector/channel errors.

        When Eve is INACTIVE:
            Exactly k = floor(channel_noise_rate × L) random positions flip, so
            QBER_after = k/L ≤ channel_noise_rate < qber_threshold.

        When Eve is ACTIVE:
            Independent Bernoulli(channel_noise_rate) flips stack on attack errors;
            QBER is not capped (realistic degraded channel plus adversary).

        Requires channel_noise_rate < qber_threshold (enforced at init).
        """
        if self.channel_noise_rate <= 0 or not bob_sifted:
            return list(bob_sifted)

        L = len(bob_sifted)
        bob_out = list(bob_sifted)

        if not self.eve_present:
            k = int(np.floor(self.channel_noise_rate * L))
            if k <= 0:
                return bob_out
            idx = self.rng.choice(L, size=k, replace=False)
            for i in idx:
                bob_out[int(i)] ^= 1
            return bob_out

        for i in range(L):
            if self.rng.random() < self.channel_noise_rate:
                bob_out[i] ^= 1
        return bob_out

    # ------------------------------------------------------------------ #
    #  Phase 5 – QBER estimation                                         #
    # ------------------------------------------------------------------ #
    def _calculate_qber(self, alice_sifted, bob_sifted):
        """
        Estimate the Quantum Bit Error Rate (QBER) by comparing a sample
        of the sifted keys.

        QBER = (number of differing bits) / (total sifted bits)

        Expected values:
            Without Eve, no noise:  QBER ≈ 0%
            Without Eve + channel noise (model): floor(p·L)/L ≤ p < threshold
            With Eve:     QBER ≈ 25% (intercept-resend) plus optional extras

        Returns:
            qber             : Float in [0.0, 1.0]
            error_positions  : List of positions where errors occurred
        """
        if not alice_sifted:
            return 0.0, []

        errors = [
            i for i, (a, b) in enumerate(zip(alice_sifted, bob_sifted))
            if a != b
        ]
        qber = len(errors) / len(alice_sifted)
        return qber, errors

    # ------------------------------------------------------------------ #
    #  Phase 6 – Final key derivation                                    #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _derive_final_key(alice_sifted, bob_sifted):
        """
        In a real QKD system, privacy amplification and error correction
        would occur here. For simulation purposes, we use Alice's sifted
        key (assumed correct after error correction) and derive a
        cryptographic hash as the final shared secret.

        Returns:
            final_key : Hex-encoded SHA-256 digest of the sifted key bits
        """
        if not alice_sifted:
            return "NO_KEY_GENERATED"
        key_bytes = bytes(
            int("".join(str(b) for b in alice_sifted[i:i+8]), 2)
            for i in range(0, len(alice_sifted) - len(alice_sifted) % 8, 8)
        )
        return hashlib.sha256(key_bytes).hexdigest()[:32]

    # ------------------------------------------------------------------ #
    #  Main simulation runner                                            #
    # ------------------------------------------------------------------ #
    def run(self) -> BB84Result:
        """
        Execute the complete BB84 protocol simulation.

        Steps:
            1. Alice prepares qubits
            2. (Optional) Eve intercepts and re-sends
            3. Bob measures
            4. Basis sifting via classical channel
            5. QBER calculation
            6. Attack detection
            7. Final key derivation

        Returns:
            BB84Result dataclass with all simulation data
        """
        t_start = time.perf_counter()

        # ── Step 1: Alice ──────────────────────────────────────────────
        alice_bits, alice_bases, qubit_states = self._alice_prepare()

        # ── Step 2: Eve (optional) ─────────────────────────────────────
        eve_bases   = []
        eve_results = []
        transmitted_bits = alice_bits.copy()

        if self.eve_present:
            eve_bases_arr, eve_results_arr, transmitted_bits = self._eve_intercept(
                alice_bits, alice_bases
            )
            eve_bases   = eve_bases_arr.tolist()
            eve_results = eve_results_arr.tolist()

        # ── Step 3: Bob ────────────────────────────────────────────────
        bob_bases, bob_results = self._bob_measure(transmitted_bits, alice_bases)

        # ── Step 4: Sifting ────────────────────────────────────────────
        matching_indices, alice_sifted, bob_sifted = self._sift_key(
            alice_bits, alice_bases, bob_bases, bob_results
        )

        bob_sifted = self._apply_channel_noise_to_sifted(alice_sifted, bob_sifted)

        # ── Step 5: QBER ──────────────────────────────────────────────
        qber, error_positions = self._calculate_qber(alice_sifted, bob_sifted)

        # ── Step 6: Attack detection ───────────────────────────────────
        attack_detected = qber > self.qber_threshold

        # ── Step 7: Final key ──────────────────────────────────────────
        final_key = self._derive_final_key(alice_sifted, bob_sifted)

        sifting_efficiency = len(matching_indices) / self.num_qubits if self.num_qubits else 0.0
        simulation_time_ms = (time.perf_counter() - t_start) * 1000

        return BB84Result(
            num_qubits         = self.num_qubits,
            alice_bits         = alice_bits.tolist(),
            alice_bases        = alice_bases.tolist(),
            qubit_states       = qubit_states,
            bob_bases          = bob_bases.tolist(),
            bob_results        = bob_results.tolist(),
            matching_indices   = matching_indices,
            alice_sifted_key   = alice_sifted,
            bob_sifted_key     = bob_sifted,
            final_key          = final_key,
            key_length         = len(alice_sifted),
            qber               = round(qber, 4),
            eve_present        = self.eve_present,
            eve_bases          = eve_bases,
            eve_results        = eve_results,
            attack_detected    = attack_detected,
            qber_threshold     = self.qber_threshold,
            sifting_efficiency = round(sifting_efficiency, 4),
            simulation_time_ms = round(simulation_time_ms, 3),
            error_positions    = error_positions,
            channel_noise_rate = round(self.channel_noise_rate, 6),
        )
