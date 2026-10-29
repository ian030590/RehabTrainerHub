export const lobbyPageSize = 12;

export function BuildLobbyFilterChips(selectedPurposes, query, categorySubcategories) {
  const selected = new Set(selectedPurposes);
  const chips = [];
  for (const [id, purposes] of Object.entries(categorySubcategories)) {
    if (purposes.length > 0 && purposes.every(purpose => selected.has(purpose))) {
      chips.push({ key: `category:${id}`, kind: 'category', id, purposeIds: [...purposes] });
    } else {
      for (const purpose of purposes.filter(purpose => selected.has(purpose))) {
        chips.push({ key: `purpose:${purpose}`, kind: 'purpose', id: purpose, purposeIds: [purpose] });
      }
    }
  }
  if (query.trim()) chips.push({ key: 'search', kind: 'search', query: query.trim() });
  return chips;
}

export function PaginateLobbyGames(games, requestedPage) {
  const totalPages = Math.max(1, Math.ceil(games.length / lobbyPageSize));
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const offset = (page - 1) * lobbyPageSize;
  return {
    items: games.slice(offset, offset + lobbyPageSize),
    page,
    totalPages,
    start: games.length === 0 ? 0 : offset + 1,
    end: Math.min(offset + lobbyPageSize, games.length),
  };
}

export function BuildLobbyPageNumbers(page, totalPages) {
  const pages = [];
  for (let number = 1; number <= totalPages; number += 1) {
    if (totalPages <= 5 || number === 1 || number === totalPages || Math.abs(number - page) <= 1) {
      if (typeof pages.at(-1) === 'number' && number - pages.at(-1) > 1) pages.push('ellipsis');
      pages.push(number);
    }
  }
  return pages;
}
