export function coloredShadow(color: string, intensity: number = 1) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 * intensity },
    shadowOpacity: 0.18 * intensity,
    shadowRadius: 12 * intensity,
    elevation: Math.round(6 * intensity),
  };
}
