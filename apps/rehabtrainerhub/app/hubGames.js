export function MergeHubGames(catalogGames, publishedGames, retainedCatalogIds = new Set()) {
  const games = new Map(catalogGames.map(game => [game.id, game]));
  for (const game of publishedGames) {
    if (!retainedCatalogIds.has(game.id) || !games.has(game.id)) games.set(game.id, game);
  }
  return [...games.values()];
}
