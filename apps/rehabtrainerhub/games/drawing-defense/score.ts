interface DrawingScoreRecord {
  Total_Duration_Seconds: number;
  Enemies_Spawned: number;
  Enemies_Defeated: number;
  HP_Remaining: number;
  Game_Result: string;
  Enemy_Results: {
    Enemy_Number: number;
    Shape: string;
    Reaction_Time_Seconds: number | null;
    Defeated: boolean;
  }[];
}

export function BuildGameScore(record: DrawingScoreRecord) {
  const shapes = ['circle', 'cross', 'square', 'triangle', 'vertical-line', 'horizontal-line'];
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'drawing-defense',
    summary: { durationSeconds: record.Total_Duration_Seconds, spawned: record.Enemies_Spawned,
      defeated: record.Enemies_Defeated, hpRemaining: record.HP_Remaining,
      victory: record.Game_Result === 'Victory' ? 1 : 0 },
    rounds: record.Enemy_Results.map(enemy => ({ enemyNumber: enemy.Enemy_Number,
      shape: shapes.indexOf(enemy.Shape), reactionSeconds: enemy.Reaction_Time_Seconds,
      defeated: enemy.Defeated ? 1 : 0 })),
  };
}
