import json
import os
from typing import Dict

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Hospital-profile presets (module 15 - "configurable hospital profile")
#
# Numbers below are illustrative deltas for a hackathon prototype, NOT
# validated operational targets for any real hospital. They exist to make
# the "this scales across hospital types" claim demonstrable in running
# code (see GET /api/config) rather than just asserted in prose.
# ---------------------------------------------------------------------------
ED_PROFILES: Dict[str, dict] = {
    "urban": {
        # Default profile: moderate throughput pressure.
        "safeWaitThresholdMinutes": {1: 0, 2: 10, 3: 30, 4: 60, 5: 120},
        "bedCapacity": {"critical": 3, "urgent": 6, "nonUrgent": 10},
    },
    "rural": {
        # Fewer beds, longer baseline wait tolerances (less throughput
        # pressure, but also less capacity to absorb a surge).
        "safeWaitThresholdMinutes": {1: 0, 2: 15, 3: 45, 4: 90, 5: 180},
        "bedCapacity": {"critical": 1, "urgent": 2, "nonUrgent": 4},
    },
    "large_trauma": {
        # More beds, tighter thresholds - higher expected throughput and
        # staffing, so lower tolerance for delay at every level.
        "safeWaitThresholdMinutes": {1: 0, 2: 5, 3: 20, 4: 40, 5: 90},
        "bedCapacity": {"critical": 6, "urgent": 12, "nonUrgent": 20},
    },
}

LEVEL_LABELS = {
    1: "Critical",
    2: "Emergent",
    3: "Urgent",
    4: "Less Urgent",
    5: "Non-Urgent",
}


def _bool_env(name: str, default: bool) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        self.frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
        self.port = int(os.environ.get("PORT", "5000"))

        self.gemini_api_key = os.environ.get("GEMINI_API_KEY") or None
        self.gemini_model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")

        self.integration_mode = os.environ.get("INTEGRATION_MODE", "standalone")

        self.surge_mode_duration_minutes = int(os.environ.get("SURGE_MODE_DURATION_MINUTES", "30"))
        self.surge_threshold_multiplier = float(os.environ.get("SURGE_THRESHOLD_MULTIPLIER", "1.5"))

        ed_profile = os.environ.get("ED_PROFILE", "urban")
        if ed_profile not in ED_PROFILES:
            ed_profile = "urban"
        self.ed_profile = ed_profile

        profile = ED_PROFILES[self.ed_profile]
        self.safe_wait_threshold_minutes: Dict[int, float] = dict(profile["safeWaitThresholdMinutes"])
        self.bed_capacity: Dict[str, int] = dict(profile["bedCapacity"])

        # Optional explicit override of bed capacity via env (JSON object),
        # e.g. BED_CAPACITY='{"critical":4,"urgent":8,"nonUrgent":12}'
        raw_bed_capacity = os.environ.get("BED_CAPACITY")
        if raw_bed_capacity:
            try:
                override = json.loads(raw_bed_capacity)
                self.bed_capacity.update({k: int(v) for k, v in override.items()})
            except (json.JSONDecodeError, ValueError, TypeError):
                # Malformed override -> silently ignore, keep profile default.
                pass

        raw_tokens = os.environ.get("CLINICIAN_TOKENS", "demo-token")
        self.clinician_tokens = {t.strip() for t in raw_tokens.split(",") if t.strip()}


settings = Settings()
