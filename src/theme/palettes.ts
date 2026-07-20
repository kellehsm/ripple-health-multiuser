import type { Theme } from "./theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CF = Theme["teal"];
type CFn = Theme["coral"];

function cf(solid: string, sub: string, bg: string, fg: string, tint: string, bar?: string): CF {
  return { solid, sub, bg, fg, tint, bar: bar ?? solid };
}
function cfn(solid: string, sub: string, bg: string, fg: string, tint: string): CFn {
  return { solid, sub, bg, fg, tint };
}

// ─── LIGHT THEMES ─────────────────────────────────────────────────────────────

// 1. Warm cream + earthy teal/coral/berry accents — the classic default
const morningMist: Theme = {
  id: "morning-mist", name: "Morning Mist", group: "Light", isDark: false,
  ink: "#1A2E2C", cream: "#F5FAF8", page: "#EBF2EF", card: "#FFFFFF", cardBorder: "#C8DCD5",
  textStrong: "#1A2E2C", textSoft: "#5A7A70",
  primary: "#5B9B8A", success: "#3D7A68", warning: "#C4735A", danger: "#C04040",
  glucoseHigh: "#C4735A", glucoseLow: "#4A8AB0",
  teal:   cf("#4A7A68", "#2A5A48", "#C0DACE", "#0A2A1C", "#CCE5D8"),          // steps — deep teal
  coral:  cfn("#C4735A", "#A05040", "#F2DACE", "#5A2510", "#F5E4D5"),         // meals — earthy coral
  blue:   cfn("#4A8AB0", "#2A6A90", "#C0DAF0", "#0A2E50", "#CCE2F4"),         // water — soft blue
  amber:  cfn("#9B7040", "#7A5020", "#F0DEC0", "#3A2008", "#F5E8CC"),         // sleep — warm ochre
  purple: cfn("#7A5AA0", "#5A3A80", "#E0D0F0", "#3A1870", "#E8DFF5"),         // finance — dusty purple
  berry:  cf("#A05070", "#80304A", "#F2C8D8", "#5A0E28", "#F5D5E2"),          // glucose — rose berry
  violet: cfn("#9070C8", "#7050B0", "#E0D0F8", "#3A1870", "#E8E0F8"),         // mood — soft violet
  red:    cfn("#C04040", "#A03030", "#FBDADA", "#6A0808", "#FBDADA"),
  pink:   cfn("#A05070", "#80304A", "#F2C8D8", "#5A0E28", "#F5D5E2"),
  green:  cfn("#4A7A68", "#2A5A48", "#C0DACE", "#0A2A1C", "#CCE5D8"),
  brown:  { solid: "#8B5E3C", sub: "#6A4018", tint: "#F0E8E0" },
};

// 2. Pale sage + botanical greens, terracotta, ochre
const paleSage: Theme = {
  id: "pale-sage", name: "Pale Sage", group: "Light", isDark: false,
  ink: "#1E2C18", cream: "#F2F7F0", page: "#E8EFE5", card: "#F6FAF4", cardBorder: "#C0D5B8",
  textStrong: "#1E2C18", textSoft: "#4A5E40",
  primary: "#4A7A3A", success: "#3A6A2A", warning: "#A07020", danger: "#8B3020",
  glucoseHigh: "#8B3020", glucoseLow: "#4A6A8A",
  teal:   cf("#4A7A3A", "#2A5A1A", "#BDD5B4", "#1A3A10", "#C8E0BF"),          // steps — forest green
  coral:  cfn("#B86848", "#985038", "#EDD8C8", "#5A2810", "#F0E0D0"),         // meals — terracotta
  blue:   cfn("#4A6A8A", "#2A4A68", "#C8D8E8", "#0A1A30", "#D2E0EC"),         // water — slate blue
  amber:  cfn("#8A7030", "#6A5218", "#E5D8A8", "#3A2808", "#EAE0B8"),         // sleep — warm ochre
  purple: cfn("#6A5890", "#4A3870", "#D8D0EE", "#281848", "#E0D8F2"),         // finance — dusty lavender
  berry:  cf("#925068", "#723050", "#EDD0DA", "#480E28", "#F0D5E0"),           // glucose — rose berry
  violet: cfn("#7858B0", "#5838A0", "#DDD0F0", "#2A1048", "#E5D8F5"),         // mood — muted violet
  red:    cfn("#9B3020", "#7A1808", "#F0CCC0", "#4A0808", "#F5D5C8"),
  pink:   cfn("#925068", "#723050", "#EDD0DA", "#480E28", "#F0D5E0"),
  green:  cfn("#4A7A3A", "#2A5A1A", "#BDD5B4", "#1A3A10", "#C8E0BF"),
  brown:  { solid: "#7A5838", sub: "#5A3818", tint: "#F0E4D8" },
};

// 3. Soft blush + warm pastels: copper, tangerine, amber gold, mauve
const blushHour: Theme = {
  id: "blush-hour", name: "Blush Hour", group: "Light", isDark: false,
  ink: "#2A1810", cream: "#FAF4F2", page: "#F5EDE8", card: "#FFF8F5", cardBorder: "#E5CEC5",
  textStrong: "#2A1810", textSoft: "#7A5040",
  primary: "#C06040", success: "#5A8848", warning: "#C07820", danger: "#9B2828",
  glucoseHigh: "#9B2828", glucoseLow: "#4A7AA8",
  teal:   cf("#A85838", "#884020", "#F0D8C0", "#5A2010", "#F5E0C8"),           // steps — warm copper
  coral:  cfn("#E07840", "#C05020", "#FAE0C8", "#5A2208", "#FDE8D0"),         // meals — tangerine
  blue:   cfn("#6878B0", "#485898", "#D5DCEC", "#182040", "#DBE0F2"),         // water — rose blue
  amber:  cfn("#C09028", "#A07010", "#F5E8B8", "#5A3808", "#FAF0C5"),         // sleep — warm amber gold
  purple: cfn("#906890", "#704870", "#EAD8EA", "#401040", "#F0E0F0"),         // finance — soft mauve
  berry:  cf("#A04060", "#803050", "#F0C8D5", "#500A20", "#F5D0DC"),           // glucose — deep berry
  violet: cfn("#9060C0", "#7040A0", "#EAD8F5", "#3A0E48", "#F0E0F8"),         // mood — warm violet
  red:    cfn("#B03030", "#901818", "#F8D0D0", "#580808", "#FADADA"),
  pink:   cfn("#A04060", "#803050", "#F0C8D5", "#500A20", "#F5D0DC"),
  green:  cfn("#5A8848", "#407030", "#D0E8C8", "#182010", "#D8EDD0"),
  brown:  { solid: "#9A6848", sub: "#784828", tint: "#F5E8DC" },
};

// 4. Cool ivory + jewel tones: sapphire, ruby rose, amethyst, indigo
const jewelLight: Theme = {
  id: "jewel-light", name: "Jewel Light", group: "Light", isDark: false,
  ink: "#12183A", cream: "#F2F4FA", page: "#EEF0F5", card: "#FAFBFF", cardBorder: "#C8D0E0",
  textStrong: "#12183A", textSoft: "#485880",
  primary: "#2A5CC8", success: "#1A7A50", warning: "#D46C00", danger: "#C02040",
  glucoseHigh: "#C02040", glucoseLow: "#1A5CB8",
  teal:   cf("#1A5CB8", "#0A3A90", "#C0D4F0", "#001850", "#CCE0F8"),           // steps — sapphire
  coral:  cfn("#C83060", "#A01040", "#F5C8DC", "#580010", "#FAD5E4"),         // meals — ruby rose
  blue:   cfn("#1890C8", "#0A6898", "#C0E0F0", "#003850", "#CCE8F5"),         // water — ocean blue
  amber:  cfn("#8040C0", "#6020A0", "#E0C8F5", "#300848", "#E8D0FA"),         // sleep — amethyst
  purple: cfn("#6028A0", "#401880", "#DDD0F0", "#200848", "#E5D5F8"),         // finance — deep violet
  berry:  cf("#B02850", "#880830", "#F5C8D5", "#480010", "#FAD0DC"),           // glucose — jewel ruby
  violet: cfn("#6848D0", "#4828B0", "#DDD8F8", "#180850", "#E5E0FA"),         // mood — indigo
  red:    cfn("#C02040", "#A00020", "#FAD0D8", "#580010", "#FAD5DA"),
  pink:   cfn("#B02850", "#880830", "#F5C8D5", "#480010", "#FAD0DC"),
  green:  cfn("#1A7A50", "#0A5830", "#C0E0D0", "#003818", "#CCE8D8"),
  brown:  { solid: "#7A5840", sub: "#5A3820", tint: "#F0E8E0" },
};

// 5. Cool gray + saturated primary accents: teal, burnt orange, strong blue
const cleanSlate: Theme = {
  id: "clean-slate", name: "Clean Slate", group: "Light", isDark: false,
  ink: "#1A1A1A", cream: "#F3F3F3", page: "#EBEBEB", card: "#F7F7F7", cardBorder: "#D2D2D2",
  textStrong: "#1A1A1A", textSoft: "#666666",
  primary: "#2080E0", success: "#20A040", warning: "#E08000", danger: "#D02020",
  glucoseHigh: "#D02020", glucoseLow: "#2080E0",
  teal:   cf("#0080A0", "#006080", "#C0E0EA", "#002840", "#CAEBF2"),           // steps — teal blue
  coral:  cfn("#D05020", "#A83010", "#FAD8C8", "#5A1808", "#FDE0D0"),         // meals — burnt orange
  blue:   cfn("#2080E0", "#0060C0", "#C0D8F5", "#002060", "#CCE0F8"),         // water — strong blue
  amber:  cfn("#C08020", "#A06010", "#F5E8C0", "#503808", "#FAF0C8"),         // sleep — golden yellow
  purple: cfn("#7040C0", "#5020A0", "#E0D0F5", "#280848", "#E8D8FA"),         // finance — bold purple
  berry:  cf("#C02060", "#A00840", "#F5C8D8", "#580018", "#FAD0E0"),           // glucose — vivid berry
  violet: cfn("#8040C0", "#6020A0", "#E8D0F5", "#2C0848", "#EED8FA"),         // mood — bright violet
  red:    cfn("#D02020", "#B00808", "#FAD0D0", "#5A0808", "#FAD5D5"),
  pink:   cfn("#C02060", "#A00840", "#F5C8D8", "#580018", "#FAD0E0"),
  green:  cfn("#20A040", "#108028", "#C0E8CC", "#083818", "#CCF0D5"),
  brown:  { solid: "#888888", sub: "#606060", tint: "#F0F0F0" },
};

// ─── DARK THEMES ──────────────────────────────────────────────────────────────

// 6. Charcoal steel + bright teal/coral/berry family adapted for dark contrast
const midnightSteel: Theme = {
  id: "midnight-steel", name: "Midnight Steel", group: "Dark", isDark: true,
  ink: "#8AAABF", cream: "#1A1E24", page: "#161A20", card: "#1E242C", cardBorder: "#486C8A",
  textStrong: "#E0EAF5", textSoft: "#7A8C9A",
  primary: "#5B8DB8", success: "#3DAA7A", warning: "#D4880A", danger: "#E05050",
  glucoseHigh: "#E05050", glucoseLow: "#4AB8D0",
  teal:   cf("#4AB8D0", "#30909A", "#0A2A30", "#90E0F0", "#0A2A30"),           // steps — bright teal
  coral:  cfn("#E07070", "#B84848", "#3A1818", "#FFA080", "#3A1818"),         // meals — warm coral
  blue:   cfn("#5B8DB8", "#3A6A9A", "#0A1E36", "#90C0E8", "#0A1E36"),         // water — steel blue
  amber:  cfn("#C8A040", "#A07820", "#201800", "#FFE080", "#181200"),         // sleep — dark-mode amber
  purple: cfn("#8A60D8", "#6840B8", "#180E30", "#C8A8F8", "#120A28"),         // finance — soft purple
  berry:  cf("#D07090", "#A84870", "#2E0E1C", "#F8B8D0", "#280A18"),          // glucose — rose berry
  violet: cfn("#A880E0", "#8060C0", "#20103A", "#D0B0F8", "#18082E"),         // mood — lavender
  red:    cfn("#E05050", "#C02828", "#3A0A0A", "#FFA0A0", "#2E0808"),
  pink:   cfn("#D07090", "#A84870", "#2E0E1C", "#F8B8D0", "#280A18"),
  green:  cfn("#3DAA7A", "#288858", "#082A1A", "#90E0BC", "#061E12"),
  brown:  { solid: "#B0856A", sub: "#906848", tint: "#1C1008" },
};

// 7. Deep navy + cyan, gold, neon magenta
const deepNavy: Theme = {
  id: "deep-navy", name: "Deep Navy", group: "Dark", isDark: true,
  ink: "#6A92C0", cream: "#0E1422", page: "#0A0E18", card: "#10182A", cardBorder: "#487098",
  textStrong: "#E8F2FF", textSoft: "#7090B8",
  primary: "#00C8FF", success: "#00E878", warning: "#FFB800", danger: "#FF4040",
  glucoseHigh: "#FF5080", glucoseLow: "#00A8FF",
  teal:   cf("#00C8FF", "#00A0CC", "#002830", "#80EFFF", "#002030"),           // steps — bright cyan
  coral:  cfn("#FF5090", "#CC2868", "#200818", "#FF90C0", "#180510"),         // meals — neon magenta
  blue:   cfn("#0090E0", "#0068B0", "#001830", "#70C8FF", "#001020"),         // water — ocean blue
  amber:  cfn("#FFB800", "#CC8A00", "#201800", "#FFE080", "#181000"),         // sleep — gold
  purple: cfn("#A860FF", "#8040E0", "#180828", "#D0A0FF", "#100620"),         // finance — electric purple
  berry:  cf("#FF2080", "#CC0058", "#200010", "#FF80C0", "#180008"),           // glucose — neon pink
  violet: cfn("#7878FF", "#5050D0", "#100830", "#B8B8FF", "#080520"),         // mood — electric blue-violet
  red:    cfn("#FF4040", "#D01818", "#200808", "#FF9090", "#180606"),
  pink:   cfn("#FF2080", "#CC0058", "#200010", "#FF80C0", "#180008"),
  green:  cfn("#00E878", "#00C058", "#002214", "#80FFB8", "#001A0E"),
  brown:  { solid: "#8090A8", sub: "#607090", tint: "#081018" },
};

// 8. Deep plum + rose, amber, bright mint
const velvetDusk: Theme = {
  id: "velvet-dusk", name: "Velvet Dusk", group: "Dark", isDark: true,
  ink: "#A87CCC", cream: "#160C20", page: "#120818", card: "#1A1028", cardBorder: "#8050B8",
  textStrong: "#F0E8FF", textSoft: "#A070C0",
  primary: "#E060C0", success: "#40D890", warning: "#E0A020", danger: "#FF4060",
  glucoseHigh: "#FF5070", glucoseLow: "#60A0FF",
  teal:   cf("#E060A0", "#B83878", "#280E1E", "#FF90C8", "#200A18"),           // steps — vivid rose
  coral:  cfn("#E08840", "#B86820", "#201408", "#FFB870", "#180E04"),         // meals — amber orange
  blue:   cfn("#20E0C0", "#10B898", "#041C18", "#70FFEA", "#021410"),         // water — bright mint
  amber:  cfn("#D0A830", "#A88010", "#1C1408", "#FFD870", "#140E04"),         // sleep — warm amber
  purple: cfn("#B878F0", "#9050D0", "#180A28", "#DDB8FF", "#100618"),         // finance — bright lavender
  berry:  cf("#FF6888", "#D04060", "#200810", "#FFB0C0", "#180608"),           // glucose — rose coral
  violet: cfn("#C060E8", "#9840C8", "#1A0828", "#E8A0FF", "#120520"),         // mood — vivid violet
  red:    cfn("#FF4060", "#D01840", "#200810", "#FF9090", "#180608"),
  pink:   cfn("#FF6888", "#D04060", "#200810", "#FFB0C0", "#180608"),
  green:  cfn("#40D890", "#20B070", "#041C10", "#80FFC0", "#021408"),
  brown:  { solid: "#C090A0", sub: "#A07080", tint: "#1C0A14" },
};

// 9. Deep forest + lime green, sky blue, warm amber
const forestNight: Theme = {
  id: "forest-night", name: "Forest Night", group: "Dark", isDark: true,
  ink: "#6AA850", cream: "#0C1A0C", page: "#080E08", card: "#0E1810", cardBorder: "#3E7830",
  textStrong: "#E8F5E0", textSoft: "#78A870",
  primary: "#88D840", success: "#60E080", warning: "#F0A030", danger: "#F04830",
  glucoseHigh: "#F06040", glucoseLow: "#60B8F0",
  teal:   cf("#78D848", "#50A828", "#0A1808", "#B8F870", "#081208"),           // steps — bright lime
  coral:  cfn("#F0A040", "#C07820", "#1C0E04", "#FFD080", "#140A02"),         // meals — warm amber
  blue:   cfn("#60C8F0", "#30A0D0", "#041820", "#A0E8FF", "#021012"),         // water — sky blue
  amber:  cfn("#E0C040", "#B89020", "#181400", "#FFF080", "#100E00"),         // sleep — golden yellow
  purple: cfn("#C880F0", "#A060D0", "#180A28", "#EAB0FF", "#100620"),         // finance — orchid
  berry:  cf("#F06848", "#C84028", "#1E0A04", "#FFB090", "#160602"),           // glucose — coral orange
  violet: cfn("#B090E0", "#8868C0", "#100A20", "#DCC0FF", "#0A0614"),         // mood — soft lavender
  red:    cfn("#F04830", "#C82018", "#1C0806", "#FF9080", "#140604"),
  pink:   cfn("#F06848", "#C84028", "#1E0A04", "#FFB090", "#160602"),
  green:  cfn("#60E080", "#30C058", "#041808", "#A0FFC0", "#021004"),
  brown:  { solid: "#A09070", sub: "#807050", tint: "#100C08" },
};

// 10. Espresso brown + terracotta, sage green, dusty blue
const espresso: Theme = {
  id: "espresso", name: "Espresso", group: "Dark", isDark: true,
  ink: "#B08868", cream: "#120E0A", page: "#0E0908", card: "#18120E", cardBorder: "#8A6040",
  textStrong: "#F5EDD8", textSoft: "#9A8060",
  primary: "#E07840", success: "#60C080", warning: "#D0A020", danger: "#E06060",
  glucoseHigh: "#E05840", glucoseLow: "#70A8E0",
  teal:   cf("#E07840", "#B85820", "#1C0E08", "#FFB080", "#140A04"),           // steps — terracotta
  coral:  cfn("#C86840", "#A04820", "#1C0E08", "#FFA870", "#140A04"),         // meals — burnt sienna
  blue:   cfn("#70A8E0", "#4888C0", "#0A1422", "#B0D0FF", "#080E18"),         // water — dusty blue
  amber:  cfn("#6AB878", "#489858", "#0A1A0E", "#A0E8B0", "#080E0A"),         // sleep — sage green
  purple: cfn("#A878A0", "#886080", "#180A18", "#DDB8D8", "#100610"),         // finance — dusty mauve
  berry:  cf("#D07060", "#A85040", "#1C0E0A", "#FFB0A0", "#140A06"),           // glucose — muted rose
  violet: cfn("#8878C0", "#6858A0", "#100A1C", "#C0B0E8", "#0A0614"),         // mood — dusty violet
  red:    cfn("#E06060", "#B83838", "#1C0808", "#FFA0A0", "#140606"),
  pink:   cfn("#D07060", "#A85040", "#1C0E0A", "#FFB0A0", "#140A06"),
  green:  cfn("#60C080", "#40A060", "#0A1A0E", "#A0E8B0", "#081208"),
  brown:  { solid: "#C8A880", sub: "#A08060", tint: "#1A1208" },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const PALETTES: Record<string, Theme> = {
  "morning-mist":   morningMist,
  "pale-sage":      paleSage,
  "blush-hour":     blushHour,
  "jewel-light":    jewelLight,
  "clean-slate":    cleanSlate,
  "midnight-steel": midnightSteel,
  "deep-navy":      deepNavy,
  "velvet-dusk":    velvetDusk,
  "forest-night":   forestNight,
  "espresso":       espresso,
};

export const PALETTE_GROUPS: Record<string, string[]> = {
  "Light Themes": ["morning-mist", "pale-sage", "blush-hour", "jewel-light", "clean-slate"],
  "Dark Themes":  ["midnight-steel", "deep-navy", "velvet-dusk", "forest-night", "espresso"],
};

export const DEFAULT_PALETTE_ID = "morning-mist";

export const lightTheme = morningMist;
export const darkTheme = midnightSteel;
