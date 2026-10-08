export function MergeHubGames(catalogGames, publishedGames) {
  const games = new Map(catalogGames.map(game => [game.id, game]));
  for (const game of publishedGames) {
    // Existing entries own their launch contract; old publications may use an incompatible shell.
    if (!games.has(game.id)) games.set(game.id, game);
  }
  return [...games.values()];
}
