export function extractLegacyCardIds(rawCollectionValue) {
  if (typeof rawCollectionValue !== "string" || !rawCollectionValue.trim()) {
    return [];
  }

  let parsed = [];
  try {
    const data = JSON.parse(rawCollectionValue);
    parsed = Array.isArray(data) ? data : [];
  } catch {
    return [];
  }

  return parsed.map((entry) => `${entry?.id || ""}`.trim()).filter(Boolean);
}
