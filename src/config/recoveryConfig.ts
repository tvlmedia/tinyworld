export const RECOVERY = {
  evaluationInterval: 8,
  criticalFoodPerResident: 1.8,
  stressedFoodPerResident: 4,
  damagedHealthRatio: 0.72,
  damagedBuildingEmergencyShare: 0.28,
  stuckResidentTimeout: 42,
  rubbleWorkRequired: 12,
  repairWorkRequired: 18,
  repairMaterialShare: 0.12,
  emergencyMaterialShare: 0.42,
  emergencyWorkShare: 0.48,
  recentCrisisDuration: 96,
  stableEvaluationsToExit: 3,
  taskHistoryLimit: 32,
  taskRetryDays: 1,
  recoveryStabilityGain: 2.2,
  eventCooldownMinutes: 240
} as const;
