export interface AsteroidSettings {
  difficulty: 'easy' | 'medium' | 'hard';
  durationSec: number;
  sensitivity: number;
  soundEnabled: boolean;
}

export const defaultSettings: AsteroidSettings = {
  difficulty: 'medium', durationSec: 90, sensitivity: 5, soundEnabled: true,
};

export function BuildRuntimeConfig(settings: AsteroidSettings) {
  const difficulties = { easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const;
  if (!Object.hasOwn(difficulties, settings.difficulty)
    || !Number.isInteger(settings.durationSec) || settings.durationSec < 30 || settings.durationSec > 300
    || (settings.durationSec - 30) % 15 !== 0
    || !Number.isInteger(settings.sensitivity) || settings.sensitivity < 1 || settings.sensitivity > 10
    || typeof settings.soundEnabled !== 'boolean') throw new Error('Invalid asteroid settings');
  return { difficulty: difficulties[settings.difficulty], durationSec: settings.durationSec,
    maxHp: 10, shieldSizePercent: 70 + settings.sensitivity * 5, controlMode: 'mouse' as const };
}

interface ScoreRecord {
  Total_Duration_Seconds: number;
  Objects_Spawned: number;
  Objects_Blocked: number;
  Ship_Hits: number;
  Energy_Collected: number;
  Final_HP: number;
  Score: number;
  Final_Speed_Level: number;
  Game_Result: string;
  Object_Records: {
    Object_Number: number;
    Type: 'normal' | 'heavy' | 'lethal' | 'energy';
    Outcome: 'shielded' | 'hit' | 'collected' | 'missed';
    Spawn_Time_Seconds: number;
    Response_Time_Seconds: number | null;
    Damage: number;
    HP_After: number;
    Score_After: number;
    Speed_Level: number;
    Control_Source: string;
  }[];
}

export function BuildGameScore(record: ScoreRecord) {
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'asteroid-shield',
    summary: { duration: record.Total_Duration_Seconds, spawned: record.Objects_Spawned,
      blocked: record.Objects_Blocked, hits: record.Ship_Hits, energy: record.Energy_Collected,
      hp: record.Final_HP, score: record.Score, speedLevel: record.Final_Speed_Level,
      victory: record.Game_Result === 'Victory' ? 1 : 0 },
    rounds: record.Object_Records.map(item => ({ object: item.Object_Number,
      type: { normal: 0, heavy: 1, lethal: 2, energy: 3 }[item.Type],
      outcome: { shielded: 0, hit: 1, collected: 2, missed: 3 }[item.Outcome],
      spawnedAt: item.Spawn_Time_Seconds, elapsed: item.Response_Time_Seconds,
      damage: item.Damage, hp: item.HP_After, score: item.Score_After,
      speedLevel: item.Speed_Level, controlSource: 0 })),
  };
}
