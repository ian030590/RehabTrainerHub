ALTER TABLE developer_games
  ADD COLUMN trainer TEXT NOT NULL DEFAULT 'brain'
    CHECK (trainer IN ('motor', 'mouth', 'brain', 'vision'));

ALTER TABLE game_releases
  ADD COLUMN submitted_trainer TEXT NOT NULL DEFAULT 'brain'
    CHECK (submitted_trainer IN ('motor', 'mouth', 'brain', 'vision'));

UPDATE developer_games
SET trainer = CASE
  WHEN category IN ('upper-limb', 'lower-limb', 'movement') THEN 'motor'
  WHEN category = 'oral' THEN 'mouth'
  WHEN category = 'vision' THEN 'vision'
  ELSE 'brain'
END;

UPDATE game_releases
SET submitted_trainer = CASE
  WHEN submitted_category IN ('upper-limb', 'lower-limb', 'movement') THEN 'motor'
  WHEN submitted_category = 'oral' THEN 'mouth'
  WHEN submitted_category = 'vision' THEN 'vision'
  ELSE 'brain'
END;
