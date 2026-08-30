from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class VitalThresholds:
    
    hr_critical_low: float
    hr_critical_high: float
    hr_concern_low: float
    hr_concern_high: float
    
    rr_critical_low: float
    rr_critical_high: float
    rr_concern_low: float
    rr_concern_high: float
    
    spo2_critical: float  
    spo2_concern: float  
    
    sbp_critical_low: float
    sbp_concern_low: float
    
    fever_concern: float  
    fever_redflag: Optional[float] = None  


THRESHOLDS = {

    "infant": VitalThresholds(
        hr_critical_low=80, hr_critical_high=220,
        hr_concern_low=100, hr_concern_high=180,
        rr_critical_low=20, rr_critical_high=70,
        rr_concern_low=30, rr_concern_high=60,
        spo2_critical=90, spo2_concern=95,
        sbp_critical_low=50, sbp_concern_low=60,
        fever_concern=38.0, fever_redflag=38.0,
    ),
    "pediatric": VitalThresholds(
        hr_critical_low=50, hr_critical_high=180,
        hr_concern_low=70, hr_concern_high=140,
        rr_critical_low=10, rr_critical_high=50,
        rr_concern_low=16, rr_concern_high=40,
        spo2_critical=90, spo2_concern=94,
        sbp_critical_low=60, sbp_concern_low=70,
        fever_concern=38.5, fever_redflag=None,
    ),
    "adult": VitalThresholds(
        hr_critical_low=40, hr_critical_high=131,
        hr_concern_low=51, hr_concern_high=90,
        rr_critical_low=8, rr_critical_high=25,
        rr_concern_low=12, rr_concern_high=20,
        spo2_critical=90, spo2_concern=94,
        sbp_critical_low=90, sbp_concern_low=100,
        fever_concern=39.0, fever_redflag=None,
    ),
    "geriatric": VitalThresholds(
        hr_critical_low=40, hr_critical_high=130,
        hr_concern_low=50, hr_concern_high=90,
        rr_critical_low=8, rr_critical_high=24,
        rr_concern_low=12, rr_concern_high=20,
        spo2_critical=90, spo2_concern=94,
        sbp_critical_low=100, sbp_concern_low=110,
        fever_concern=38.0, fever_redflag=None,
    ),
}


def get_age_group(age: float) -> str:
    if age < 0.25:
        return "infant"
    if age < 12:
        return "pediatric"
    if age < 65:
        return "adult"
    return "geriatric"
