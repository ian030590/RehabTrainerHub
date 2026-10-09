interface GestureScoreRecord {
  Total_Duration_Seconds: number;
  Successful_Casts: number;
  Interrupted_Holds: number;
  Enemy_Max_HP: number;
  Hold_Duration_Seconds: number;
  Strictness_Threshold: number;
  Gesture_Stats: {
    Gesture: number;
    Attempts: number;
    Successful_Casts: number;
    Interrupted_Holds: number;
    Success_Rate_Percent: number;
    Average_Similarity_Percent: number;
  }[];
  Cast_Records: {
    Cast_Number: number;
    Gesture: number;
    Target_Gesture: number | null;
    Similarity_Percent: number;
    Cast_Time_Seconds: number;
    Enemy_HP_After: number;
  }[];
}

export function BuildGameScore(session: GestureScoreRecord) {
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'gesture-battler',
    summary: { durationSeconds: session.Total_Duration_Seconds, successfulCasts: session.Successful_Casts,
      interruptedHolds: session.Interrupted_Holds, enemyMaxHp: session.Enemy_Max_HP,
      holdDurationSeconds: session.Hold_Duration_Seconds, strictnessThreshold: session.Strictness_Threshold },
    rounds: [ ...session.Gesture_Stats.map(stat => ({ kind: 0, gesture: stat.Gesture, attempts: stat.Attempts,
      successfulCasts: stat.Successful_Casts, interruptedHolds: stat.Interrupted_Holds,
      successRatePercent: stat.Success_Rate_Percent, averageSimilarityPercent: stat.Average_Similarity_Percent })),
    ...session.Cast_Records.map(cast => ({ kind: 1, castNumber: cast.Cast_Number, gesture: cast.Gesture,
      targetGesture: cast.Target_Gesture, similarityPercent: cast.Similarity_Percent,
      castTimeSeconds: cast.Cast_Time_Seconds, enemyHpAfter: cast.Enemy_HP_After })) ],
  };
}
