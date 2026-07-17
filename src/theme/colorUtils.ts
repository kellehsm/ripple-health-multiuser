/** Returns "#ffffff" or "#1A1A1A" — whichever has better contrast against hex background. */
export function onSolid(hex: string): "#ffffff" | "#1A1A1A" {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? "#1A1A1A" : "#ffffff";
}
