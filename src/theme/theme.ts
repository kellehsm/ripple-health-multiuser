// Color tokens for the Ripple Health palette.
// Brand anchor: teal #3FA0A6 (activity), coral #E8654E (food), purple #7B3FBF (finance), berry #A62A50 (glucose/HR).
// Bold Outline + Color Blocks design language: ink #111111 for all borders/shadows.

export const lightTheme = {
  ink: "#111111",
  cream: "#FBFAF7",
  page: "#F5F1E8",
  card: "#ffffff",
  cardBorder: "#e7e3d8",
  textStrong: "#2C2C2A",
  textSoft: "#6b6a63",

  // Activity — steps, books, hobbies — solid: saturated fill for solid-fill tiles; tint: light bg for tint tiles
  teal:   { bg: "#C2E9EB", fg: "#1A5C62", sub: "#2A8490", bar: "#3FA0A6", solid: "#3FA0A6", tint: "#CDEAEB" },
  // Food / meals
  coral:  { bg: "#FFE4C2", fg: "#6A3800", sub: "#C46210", solid: "#E8654E", tint: "#F9D9D0" },
  // Water
  blue:   { bg: "#C0DAF2", fg: "#0D3E70", sub: "#1A5AA0", solid: "#3D7BC4", tint: "#D3E2F4" },
  // Sleep — muted indigo-lavender (key name "amber" kept for backward compat)
  amber:  { bg: "#D0D4F3", fg: "#2E3070", sub: "#4C52A0", solid: "#4A4A8C", tint: "#D8D8EC" },
  // Finance
  purple: { bg: "#E0CEFB", fg: "#3A1870", sub: "#5A2A9C", solid: "#7B3FBF", tint: "#E4D4F5" },
  // Glucose & heart rate (normal/in-range)
  berry:  { bg: "#F2C8D5", fg: "#5A0E24", sub: "#821E3C", bar: "#A62A50", solid: "#A62A50", tint: "#F2CBD8" },
  // Mood — lighter violet
  violet: { bg: "#E6D5FB", fg: "#48186E", sub: "#7040A8", solid: "#9B6BD4", tint: "#E8DCF7" },
  // Glucose alert / danger states
  red:    { bg: "#FBCBC8", fg: "#7A1408", sub: "#C0392B", solid: "#C0392B", tint: "#FBCBC8" },
  // Backward-compat aliases
  pink:   { bg: "#F2C8D5", fg: "#5A0E24", sub: "#821E3C", solid: "#A62A50", tint: "#F2CBD8" },
  green:  { bg: "#E0CEFB", fg: "#3A1870", sub: "#5A2A9C", solid: "#7B3FBF", tint: "#E4D4F5" },
  brown:  { sub: "#6F4518", solid: "#6F4518", tint: "#F0E8E0" },
};

export const darkTheme = {
  ink: "#111111",
  cream: "#1A1814",
  page: "#211F1B",
  card: "#2A2824",
  cardBorder: "#3a372f",
  textStrong: "#F2F0EA",
  textSoft: "#B4B1A8",

  teal:   { bg: "#0E3E44", fg: "#85D9E0", sub: "#5CC0C8", bar: "#4BB5BC", solid: "#3FA0A6", tint: "#0E3E44" },
  coral:  { bg: "#452400", fg: "#FFB870", sub: "#E07A28", solid: "#E8654E", tint: "#452400" },
  blue:   { bg: "#0A2E58", fg: "#8AC4F2", sub: "#5CA0DC", solid: "#3D7BC4", tint: "#0A2E58" },
  amber:  { bg: "#1E224A", fg: "#B0B5F5", sub: "#8085DC", solid: "#4A4A8C", tint: "#1E224A" },
  purple: { bg: "#2A1050", fg: "#C8A8F8", sub: "#A070E0", solid: "#7B3FBF", tint: "#2A1050" },
  berry:  { bg: "#3E0A1A", fg: "#F0A0BC", sub: "#CE5A80", bar: "#C0607A", solid: "#A62A50", tint: "#3E0A1A" },
  violet: { bg: "#280A45", fg: "#CCA8FB", sub: "#A874E8", solid: "#9B6BD4", tint: "#280A45" },
  red:    { bg: "#5A1008", fg: "#F5A09A", sub: "#E04535", solid: "#C0392B", tint: "#5A1008" },
  pink:   { bg: "#3E0A1A", fg: "#F0A0BC", sub: "#CE5A80", solid: "#A62A50", tint: "#3E0A1A" },
  green:  { bg: "#2A1050", fg: "#C8A8F8", sub: "#A070E0", solid: "#7B3FBF", tint: "#2A1050" },
  brown:  { sub: "#C8956A", solid: "#C8956A", tint: "#2A1A08" },
};

export type Theme = typeof lightTheme;
