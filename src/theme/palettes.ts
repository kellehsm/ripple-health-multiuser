import type { Theme } from "./theme";

// ─── Helper ───────────────────────────────────────────────────────────────────

type CF = Theme["teal"]; // full ColorFamily with bar
type CFn = Theme["coral"]; // ColorFamily without required bar

function cf(solid: string, sub: string, bg: string, fg: string, tint: string, bar?: string): CF {
  return { solid, sub, bg, fg, tint, bar: bar ?? solid };
}
function cfn(solid: string, sub: string, bg: string, fg: string, tint: string): CFn {
  return { solid, sub, bg, fg, tint };
}

// ─── Palettes ─────────────────────────────────────────────────────────────────

const morningMist: Theme = {
  id: "morning-mist", name: "Morning Mist", group: "Calm Wellness", isDark: false,
  ink: "#1A2E2C", cream: "#F5FAF8", page: "#EBF2EF", card: "#FFFFFF", cardBorder: "#C8DCD5",
  textStrong: "#1A2E2C", textSoft: "#5A7A70",
  primary: "#5B9B8A", success: "#3D7A68", warning: "#C4735A", danger: "#C04040",
  glucoseHigh: "#C4735A", glucoseLow: "#4A8AB0",
  teal:   cf("#5B9B8A", "#3D7A68", "#C8E4DC", "#1A4A3A", "#D4EDE6"),
  coral:  cfn("#C4735A", "#A05040", "#F2DACE", "#5A2510", "#F5E4D5"),
  blue:   cfn("#4A8AB0", "#2A6A90", "#C0DAF0", "#0A2E50", "#CCE2F4"),
  amber:  cfn("#8A70C0", "#6040A0", "#DDD0F5", "#3A1870", "#E6DCF8"),
  purple: cfn("#7A5AA0", "#5A3A80", "#E0D0F0", "#3A1870", "#E8DFF5"),
  berry:  cf("#A05070", "#80304A", "#F2C8D8", "#5A0E28", "#F5D5E2"),
  violet: cfn("#9070C8", "#7050B0", "#E0D0F8", "#3A1870", "#E8E0F8"),
  red:    cfn("#C04040", "#A03030", "#FBDADA", "#6A0808", "#FBDADA"),
  pink:   cfn("#A05070", "#80304A", "#F2C8D8", "#5A0E28", "#F5D5E2"),
  green:  cfn("#5B9B8A", "#3D7A68", "#C8E4DC", "#1A4A3A", "#D4EDE6"),
  brown:  { solid: "#8B5E3C", sub: "#6A4018", tint: "#F0E8E0" },
};

const gardenPath: Theme = {
  id: "garden-path", name: "Garden Path", group: "Calm Wellness", isDark: false,
  ink: "#2A2018", cream: "#FAF7F2", page: "#F3EEE5", card: "#FDFCF7", cardBorder: "#DDDAC8",
  textStrong: "#2A2018", textSoft: "#7A6A5A",
  primary: "#6B9E6C", success: "#4CA87D", warning: "#D4850A", danger: "#C04040",
  glucoseHigh: "#C04040", glucoseLow: "#5B82AA",
  teal:   cf("#6B9E6C", "#4A7A4A", "#C8E0C8", "#1A3A1A", "#D5EBD5"),
  coral:  cfn("#C4785A", "#A05840", "#F2D8C8", "#5A2510", "#F5E2D4"),
  blue:   cfn("#5B82AA", "#3A6080", "#C8DCEC", "#0A2A4A", "#D2E6F2"),
  amber:  cfn("#9078C8", "#6858A8", "#DDD5F0", "#3A1870", "#E5DDF5"),
  purple: cfn("#8060A0", "#604080", "#E0D0F0", "#3A1870", "#E8DFF5"),
  berry:  cf("#A06080", "#804060", "#F2C8D8", "#5A0E28", "#F5D5E2"),
  violet: cfn("#9278C0", "#7258A0", "#E0D5F0", "#3A1870", "#E8E0F8"),
  red:    cfn("#B84040", "#983030", "#FAD5D5", "#6A0808", "#FAD5D5"),
  pink:   cfn("#A06080", "#804060", "#F2C8D8", "#5A0E28", "#F5D5E2"),
  green:  cfn("#6B9E6C", "#4A7A4A", "#C8E0C8", "#1A3A1A", "#D5EBD5"),
  brown:  { solid: "#8B5E3C", sub: "#6A4018", tint: "#F0E8E0" },
};

const clinicalTrust: Theme = {
  id: "clinical-trust", name: "Clinical Trust", group: "Medical Professional", isDark: false,
  ink: "#0A1A2E", cream: "#F5F8FC", page: "#EEF3F8", card: "#FFFFFF", cardBorder: "#BAD0E8",
  textStrong: "#0A1A2E", textSoft: "#4A6A8A",
  primary: "#1565C0", success: "#2E7D32", warning: "#E65100", danger: "#C62828",
  glucoseHigh: "#C62828", glucoseLow: "#1565C0",
  teal:   cf("#0077B8", "#005A90", "#C0DCEF", "#002444", "#CCE4F5"),
  coral:  cfn("#D06060", "#A84040", "#F5D8D8", "#5A1010", "#F8E0E0"),
  blue:   cfn("#1565C0", "#0A4A9A", "#C0D4EE", "#001A5A", "#CCDEf5"),
  amber:  cfn("#7B5EA7", "#583D84", "#DDD5F0", "#281048", "#E6DCF8"),
  purple: cfn("#6A3FAD", "#502A8A", "#E0D5F5", "#281048", "#EAE0F8"),
  berry:  cf("#8B2252", "#6A103A", "#F5C8DC", "#4A0018", "#F8D5E5"),
  violet: cfn("#8455CE", "#6438B0", "#E0D5F8", "#281048", "#E8E0F8"),
  red:    cfn("#C62828", "#A01010", "#FBD0D0", "#6A0808", "#FBD0D0"),
  pink:   cfn("#8B2252", "#6A103A", "#F5C8DC", "#4A0018", "#F8D5E5"),
  green:  cfn("#2E7D32", "#1A5A1A", "#C0E0C0", "#0A2A0A", "#CCE8CC"),
  brown:  { solid: "#6D4C41", sub: "#5D3A30", tint: "#F0E4DC" },
};

const precisionSlate: Theme = {
  id: "precision-slate", name: "Precision Slate", group: "Medical Professional", isDark: true,
  ink: "#3A4A5A", cream: "#1A1E24", page: "#161A20", card: "#1E242C", cardBorder: "#2C3640",
  textStrong: "#E0EAF5", textSoft: "#7A8C9A",
  primary: "#5B8DB8", success: "#3DAA7A", warning: "#D4880A", danger: "#C0392B",
  glucoseHigh: "#E05050", glucoseLow: "#3A70B0",
  teal:   cf("#4AB8D0", "#30909A", "#0A2A30", "#90E0F0", "#0A2A30"),
  coral:  cfn("#E07070", "#B84848", "#3A1818", "#FFA080", "#3A1818"),
  blue:   cfn("#5B8DB8", "#3A6A9A", "#0A1E36", "#90C0E8", "#0A1E36"),
  amber:  cfn("#9878D8", "#7055B8", "#1A1030", "#C8B0F0", "#1A1030"),
  purple: cfn("#7A52C8", "#5A38A8", "#180E2E", "#C0A0F0", "#180E2E"),
  berry:  cf("#C05880", "#A03858", "#2E0E1C", "#F0A0C0", "#2E0E1C"),
  violet: cfn("#A880E0", "#8060C0", "#20103A", "#D0B0F8", "#20103A"),
  red:    cfn("#E05050", "#C02828", "#3A0A0A", "#FFA0A0", "#3A0A0A"),
  pink:   cfn("#C05880", "#A03858", "#2E0E1C", "#F0A0C0", "#2E0E1C"),
  green:  cfn("#3DAA7A", "#288858", "#082A1A", "#90E0BC", "#082A1A"),
  brown:  { solid: "#B0856A", sub: "#906848", tint: "#1C1008" },
};

const midnightNeon: Theme = {
  id: "midnight-neon", name: "Midnight Neon", group: "Modern Tech", isDark: true,
  ink: "#20304A", cream: "#080C10", page: "#09090F", card: "#12141A", cardBorder: "#1E2430",
  textStrong: "#E0F0FF", textSoft: "#6070A0",
  primary: "#00D4FF", success: "#00FF88", warning: "#FFB800", danger: "#FF3B4E",
  glucoseHigh: "#FF6B9D", glucoseLow: "#00D4FF",
  teal:   cf("#00D4FF", "#00A0CC", "#001A22", "#80F0FF", "#001A22"),
  coral:  cfn("#FF6B9D", "#CC3068", "#1A0010", "#FFB0CC", "#1A0010"),
  blue:   cfn("#4488FF", "#2260EE", "#0A1030", "#AAC8FF", "#0A1030"),
  amber:  cfn("#B060FF", "#8030EE", "#150A28", "#D8A0FF", "#150A28"),
  purple: cfn("#7C3AED", "#5A20C8", "#100818", "#C090FF", "#100818"),
  berry:  cf("#FF0088", "#CC0060", "#200010", "#FF80C0", "#200010"),
  violet: cfn("#DD44FF", "#AA22CC", "#180822", "#F0A0FF", "#180822"),
  red:    cfn("#FF3B4E", "#CC1828", "#1A0008", "#FF9090", "#1A0008"),
  pink:   cfn("#FF0088", "#CC0060", "#200010", "#FF80C0", "#200010"),
  green:  cfn("#00FF88", "#00CC66", "#002214", "#80FFB8", "#002214"),
  brown:  { solid: "#FF8844", sub: "#CC5522", tint: "#1A0A00" },
};

const carbonArc: Theme = {
  id: "carbon-arc", name: "Carbon Arc", group: "Modern Tech", isDark: true,
  ink: "#2A2420", cream: "#0A0806", page: "#0D0B08", card: "#141210", cardBorder: "#282420",
  textStrong: "#F5EED0", textSoft: "#B0A070",
  primary: "#F0A500", success: "#34C759", warning: "#F0A500", danger: "#E63946",
  glucoseHigh: "#E63946", glucoseLow: "#4CC9F0",
  teal:   cf("#F0A500", "#CC8800", "#1A1200", "#FFE080", "#1A1200"),
  coral:  cfn("#E85D04", "#C04000", "#1A0A00", "#FFA060", "#1A0A00"),
  blue:   cfn("#4CC9F0", "#28A8D8", "#041820", "#A0E8FF", "#041820"),
  amber:  cfn("#9B59B6", "#7A3A98", "#150A1E", "#CC90EE", "#150A1E"),
  purple: cfn("#BB86FC", "#9A5FE0", "#12080E", "#E0B0FF", "#12080E"),
  berry:  cf("#FF6B6B", "#E04040", "#200808", "#FFAAAA", "#200808"),
  violet: cfn("#D070FF", "#A848E8", "#1A0828", "#EDB0FF", "#1A0828"),
  red:    cfn("#E63946", "#C01828", "#1C0608", "#FFAAAA", "#1C0608"),
  pink:   cfn("#FF6B6B", "#E04040", "#200808", "#FFAAAA", "#200808"),
  green:  cfn("#34C759", "#1FA840", "#041410", "#88FFB0", "#041410"),
  brown:  { solid: "#C8956A", sub: "#A07040", tint: "#1C1008" },
};

const onyxGold: Theme = {
  id: "onyx-gold", name: "Onyx & Gold", group: "Luxury Health", isDark: false,
  ink: "#1A1408", cream: "#FBF8F2", page: "#F5F0E5", card: "#FFFEF8", cardBorder: "#E5D8C0",
  textStrong: "#1A1408", textSoft: "#8A7A50",
  primary: "#C8A840", success: "#4A8F5C", warning: "#C87B1A", danger: "#8B2323",
  glucoseHigh: "#9B2020", glucoseLow: "#2A4A8B",
  teal:   cf("#C8A840", "#A08020", "#F5EDD0", "#5A4010", "#F8F2DC"),
  coral:  cfn("#C87868", "#A05848", "#F5DDD0", "#5A2818", "#F8E4D8"),
  blue:   cfn("#6080B0", "#405890", "#D0DCEC", "#1A2A5A", "#D8E4F2"),
  amber:  cfn("#9878C0", "#7858A0", "#E8D8F5", "#3A1870", "#EEE2F8"),
  purple: cfn("#8050A0", "#603080", "#E0D0F0", "#3A1870", "#E8DCF5"),
  berry:  cf("#9B2020", "#7A0808", "#F5C8C8", "#4A0808", "#F8D5D5"),
  violet: cfn("#A07AC0", "#806098", "#E8D8F5", "#3A1870", "#EEE2F8"),
  red:    cfn("#8B2323", "#6A0808", "#F5C8C8", "#4A0808", "#F8D5D5"),
  pink:   cfn("#9B2020", "#7A0808", "#F5C8C8", "#4A0808", "#F8D5D5"),
  green:  cfn("#4A8F5C", "#306840", "#C8E4D0", "#0A2A18", "#D5EDD8"),
  brown:  { solid: "#8B6A40", sub: "#6A5020", tint: "#F0E8D8" },
};

const velvetPlum: Theme = {
  id: "velvet-plum", name: "Velvet Plum", group: "Luxury Health", isDark: false,
  ink: "#2A1830", cream: "#FAF7FC", page: "#F3EEF8", card: "#FFFCFF", cardBorder: "#E0D0E8",
  textStrong: "#2A1830", textSoft: "#8A6A9A",
  primary: "#8B6EAF", success: "#5A9E6F", warning: "#C49A3C", danger: "#9E3A4A",
  glucoseHigh: "#9E3A4A", glucoseLow: "#4A6E8E",
  teal:   cf("#8B6EAF", "#6A4A8A", "#E4D8F5", "#2A1030", "#EEE5FA"),
  coral:  cfn("#C890A0", "#A86878", "#F5E0E8", "#4A1828", "#FAE8EE"),
  blue:   cfn("#4A6E8E", "#2A4A6A", "#D0DCEC", "#0A1A3A", "#D8E6F2"),
  amber:  cfn("#B8986E", "#98784E", "#F0E8D8", "#5A3818", "#F5EEE0"),
  purple: cfn("#8B6EAF", "#6A4A8A", "#E4D8F5", "#2A1030", "#EEE5FA"),
  berry:  cf("#9E3A4A", "#7A1828", "#F5C8D0", "#4A0818", "#FAD5DA"),
  violet: cfn("#A878C8", "#8855A8", "#EAD8F8", "#3A1048", "#F0E2FC"),
  red:    cfn("#9E3A4A", "#7A1828", "#F5C8D0", "#4A0818", "#FAD5DA"),
  pink:   cfn("#9E3A4A", "#7A1828", "#F5C8D0", "#4A0818", "#FAD5DA"),
  green:  cfn("#5A9E6F", "#407848", "#D0EAD8", "#0A2818", "#DCEEE2"),
  brown:  { solid: "#A08060", sub: "#806040", tint: "#F0E8DE" },
};

const forestFloor: Theme = {
  id: "forest-floor", name: "Forest Floor", group: "Nature", isDark: false,
  ink: "#1A2010", cream: "#F8FAF5", page: "#EDF2E8", card: "#FAFEF5", cardBorder: "#CDD8C0",
  textStrong: "#1A2010", textSoft: "#5A6A40",
  primary: "#5A8040", success: "#4A8C3C", warning: "#C88B2A", danger: "#9C3A1C",
  glucoseHigh: "#9C3A1C", glucoseLow: "#3C5C8A",
  teal:   cf("#5A8040", "#3A6020", "#C8DCC0", "#1A3810", "#D5E8CC"),
  coral:  cfn("#8B5030", "#6A3010", "#E8D0C0", "#3A1808", "#F0DACA"),
  blue:   cfn("#3C5C8A", "#2A4068", "#C0CCE0", "#0A1830", "#CCD5E8"),
  amber:  cfn("#8860A8", "#684888", "#E0D0F0", "#2A1048", "#E8DCF5"),
  purple: cfn("#785890", "#584070", "#DCCCED", "#281038", "#E5D8F2"),
  berry:  cf("#8A3050", "#6A1030", "#F0C8D0", "#3A0818", "#F5D5DA"),
  violet: cfn("#9068B8", "#704898", "#E0D0F0", "#2A1048", "#E8DCF5"),
  red:    cfn("#9C3A1C", "#7A2008", "#F5D0C0", "#4A1008", "#F8DACA"),
  pink:   cfn("#8A3050", "#6A1030", "#F0C8D0", "#3A0818", "#F5D5DA"),
  green:  cfn("#5A8040", "#3A6020", "#C8DCC0", "#1A3810", "#D5E8CC"),
  brown:  { solid: "#7A5030", sub: "#5A3010", tint: "#F0E4D8" },
};

const vividMotion: Theme = {
  id: "vivid-motion", name: "Vivid Motion", group: "Energy", isDark: false,
  ink: "#0A0A0A", cream: "#F8F5FF", page: "#F0ECFE", card: "#FFFFFF", cardBorder: "#D8D0F8",
  textStrong: "#0A0A0A", textSoft: "#6060A0",
  primary: "#FF4D6D", success: "#06D6A0", warning: "#FFB800", danger: "#EF233C",
  glucoseHigh: "#EF233C", glucoseLow: "#3A86FF",
  teal:   cf("#FF4D6D", "#D42848", "#FFD8E0", "#5A0018", "#FFE0E8"),
  coral:  cfn("#FF9500", "#D47000", "#FFE8C0", "#5A2800", "#FFF0D0"),
  blue:   cfn("#3A86FF", "#1A60EE", "#C8DCFF", "#001A5A", "#D5E5FF"),
  amber:  cfn("#8338EC", "#6018CC", "#E8D0F8", "#280848", "#F0DCFC"),
  purple: cfn("#6A0DAD", "#4A0088", "#E0C8F5", "#280048", "#ECD5F8"),
  berry:  cf("#FF006E", "#CC0050", "#FFD0E5", "#5A0020", "#FFD8EA"),
  violet: cfn("#AF52DE", "#8838BE", "#EAD0F8", "#3A0848", "#F0DCFC"),
  red:    cfn("#EF233C", "#C80818", "#FFD0D5", "#5A0808", "#FFD5DA"),
  pink:   cfn("#FF006E", "#CC0050", "#FFD0E5", "#5A0020", "#FFD8EA"),
  green:  cfn("#06D6A0", "#04B080", "#C0F0E5", "#003A28", "#CCFAEA"),
  brown:  { solid: "#FF6B35", sub: "#CC4818", tint: "#FFE8D5" },
};

const pureClarity: Theme = {
  id: "pure-clarity", name: "Pure Clarity", group: "Minimal", isDark: false,
  ink: "#C6C6C8", cream: "#F2F2F7", page: "#F2F2F7", card: "#FFFFFF", cardBorder: "#E5E5EA",
  textStrong: "#000000", textSoft: "#8E8E93",
  primary: "#007AFF", success: "#34C759", warning: "#FF9500", danger: "#FF3B30",
  glucoseHigh: "#FF3B30", glucoseLow: "#007AFF",
  teal:   cf("#007AFF", "#005FCC", "#C0D8FF", "#001A5A", "#CCE0FF"),
  coral:  cfn("#FF9500", "#CC7000", "#FFE8C0", "#5A2800", "#FFF0D0"),
  blue:   cfn("#5AC8FA", "#30A0DC", "#C0ECFF", "#001848", "#CCEFFF"),
  amber:  cfn("#AF52DE", "#8038B8", "#E8D0F8", "#280848", "#EFDCFC"),
  purple: cfn("#5856D6", "#3838B8", "#D8D8F8", "#100858", "#E0E0FC"),
  berry:  cf("#FF2D55", "#CC0838", "#FFD0D8", "#5A0018", "#FFD8DF"),
  violet: cfn("#AF52DE", "#8038B8", "#E8D0F8", "#280848", "#EFDCFC"),
  red:    cfn("#FF3B30", "#CC1808", "#FFD5D2", "#5A0808", "#FFD9D6"),
  pink:   cfn("#FF2D55", "#CC0838", "#FFD0D8", "#5A0018", "#FFD8DF"),
  green:  cfn("#34C759", "#1CA840", "#C0F0D0", "#003A18", "#CCFAD8"),
  brown:  { solid: "#A2845E", sub: "#806040", tint: "#F0E8DC" },
};

const stillWater: Theme = {
  id: "still-water", name: "Still Water", group: "Focus Mode", isDark: false,
  ink: "#D0CDC8", cream: "#F8F7F5", page: "#F3F1EE", card: "#FFFFFF", cardBorder: "#E5E2DC",
  textStrong: "#1A1A1A", textSoft: "#888888",
  primary: "#2E6B3A", success: "#2E6B3A", warning: "#7A5A00", danger: "#7A1C1C",
  glucoseHigh: "#7A1C1C", glucoseLow: "#1A3A6A",
  teal:   cf("#2E6B3A", "#1A4A25", "#C8E0CC", "#0A2A12", "#D5E8D8"),
  coral:  cfn("#7A5A4A", "#5A3A2A", "#E8D8D0", "#3A1808", "#EEE0D8"),
  blue:   cfn("#3A5A7A", "#1A3A5A", "#C8D8E5", "#0A1A2A", "#D5E2EC"),
  amber:  cfn("#7A6A9A", "#5A4A7A", "#E0D8EE", "#2A1848", "#E8E2F3"),
  purple: cfn("#6A5A8A", "#4A3A6A", "#DDD8EC", "#281848", "#E5E0F2"),
  berry:  cf("#7A3050", "#5A1030", "#EDD0DA", "#3A0818", "#F2DAE2"),
  violet: cfn("#7A6A9A", "#5A4A7A", "#E0D8EE", "#2A1848", "#E8E2F3"),
  red:    cfn("#7A1C1C", "#5A0808", "#EDD0D0", "#3A0808", "#F2DADA"),
  pink:   cfn("#7A3050", "#5A1030", "#EDD0DA", "#3A0818", "#F2DAE2"),
  green:  cfn("#2E6B3A", "#1A4A25", "#C8E0CC", "#0A2A12", "#D5E8D8"),
  brown:  { solid: "#7A6A5A", sub: "#5A4A38", tint: "#EDE8E2" },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const PALETTES: Record<string, Theme> = {
  "morning-mist":   morningMist,
  "garden-path":    gardenPath,
  "clinical-trust": clinicalTrust,
  "precision-slate":precisionSlate,
  "midnight-neon":  midnightNeon,
  "carbon-arc":     carbonArc,
  "onyx-gold":      onyxGold,
  "velvet-plum":    velvetPlum,
  "forest-floor":   forestFloor,
  "vivid-motion":   vividMotion,
  "pure-clarity":   pureClarity,
  "still-water":    stillWater,
};

export const PALETTE_GROUPS: Record<string, string[]> = {
  "Calm Wellness":        ["morning-mist", "garden-path"],
  "Medical Professional": ["clinical-trust", "precision-slate"],
  "Modern Tech":          ["midnight-neon", "carbon-arc"],
  "Luxury Health":        ["onyx-gold", "velvet-plum"],
  "Nature":               ["forest-floor"],
  "Energy":               ["vivid-motion"],
  "Minimal":              ["pure-clarity"],
  "Focus Mode":           ["still-water"],
};

export const DEFAULT_PALETTE_ID = "morning-mist";

// Backward-compat re-exports (ThemeContext previously imported these)
export const lightTheme = morningMist;
export const darkTheme = carbonArc;
