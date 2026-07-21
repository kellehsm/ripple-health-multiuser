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

// 1. Bright Companion — warm cream + OKLCH-based accent hues
const morningMist: Theme = {
  id: "morning-mist", name: "Morning Mist", group: "Light", isDark: false,
  // Warm near-black for text/icon ink; neutral warm for card borders
  ink: "#1C2B3A", cream: "#FAF5EE", page: "#F5ECDF", card: "#FEFCF8", cardBorder: "#C4B5A5",
  textStrong: "#1C2B3A", textSoft: "#5C6D7E",
  primary: "#2870C8", success: "#1A9870", warning: "#B88820", danger: "#C02840",
  glucoseHigh: "#C02840", glucoseLow: "#2870C8",
  // hue 165 green  — steps / activity / hobbies / books
  teal:   cf("#1A9870", "#0E6848", "#D8F5EB", "#1C2B3A", "#D8F5EB", "#1A9870"),
  // hue 38 orange  — food / meals
  coral:  cfn("#C85C28", "#A04018", "#FBEACC", "#1C2B3A", "#FBEACC"),
  // hue 228 blue   — water
  blue:   cfn("#2870C8", "#1858A8", "#DAE8FA", "#1C2B3A", "#DAE8FA"),
  // hue 82 amber   — sleep
  amber:  cfn("#B88820", "#906808", "#F8EEC8", "#1C2B3A", "#F8EEC8"),
  // hue 302 purple — finance / spending
  purple: cfn("#7830B8", "#581898", "#ECD8FA", "#1C2B3A", "#ECD8FA"),
  // hue 356 red    — glucose / heart rate (in-range)
  berry:  cf("#C02840", "#901828", "#FAE0E4", "#1C2B3A", "#FAE0E4", "#C02840"),
  // hue 296 violet — mood
  violet: cfn("#7838B8", "#581898", "#ECD8FA", "#1C2B3A", "#ECD8FA"),
  red:    cfn("#C02840", "#901828", "#FAE0E4", "#1C2B3A", "#FAE0E4"),
  pink:   cfn("#C02840", "#901828", "#FAE0E4", "#1C2B3A", "#FAE0E4"),
  green:  cfn("#1A9870", "#0E6848", "#D8F5EB", "#1C2B3A", "#D8F5EB"),
  brown:  { solid: "#8B5E3C", sub: "#6A4018", tint: "#F5EDE0" },
};

// 2. Pale sage + botanical greens, terracotta, ochre
const paleSage: Theme = {
  id: "pale-sage", name: "Pale Sage", group: "Light", isDark: false,
  ink: "#1E2C18", cream: "#F2F7F0", page: "#E8EFE5", card: "#F6FAF4", cardBorder: "#9AB88E",
  textStrong: "#1E2C18", textSoft: "#4A5E40",
  primary: "#4A7A3A", success: "#3A6A2A", warning: "#A07020", danger: "#8B3020",
  glucoseHigh: "#8B3020", glucoseLow: "#4A6A8A",
  teal:   cf("#2E7A28", "#1A5A14", "#BDD5B4", "#1A3A10", "#C8E0BF"),          // steps — forest green
  coral:  cfn("#B86848", "#985038", "#EDD8C8", "#5A2810", "#F0E0D0"),         // meals — terracotta
  blue:   cfn("#3A6A8A", "#1A4A68", "#C8D8E8", "#0A1A30", "#D2E0EC"),         // water — slate blue
  amber:  cfn("#8A7030", "#6A5218", "#E5D8A8", "#3A2808", "#EAE0B8"),         // sleep — warm ochre
  purple: cfn("#6A5890", "#4A3870", "#D8D0EE", "#281848", "#E0D8F2"),         // finance — dusty lavender
  berry:  cf("#925068", "#723050", "#EDD0DA", "#480E28", "#F0D5E0"),           // glucose — rose berry
  violet: cfn("#7858B0", "#5838A0", "#DDD0F0", "#2A1048", "#E5D8F5"),         // mood — muted violet
  red:    cfn("#9B3020", "#7A1808", "#F0CCC0", "#4A0808", "#F5D5C8"),
  pink:   cfn("#925068", "#723050", "#EDD0DA", "#480E28", "#F0D5E0"),
  green:  cfn("#2E7A28", "#1A5A14", "#BDD5B4", "#1A3A10", "#C8E0BF"),
  brown:  { solid: "#7A5838", sub: "#5A3818", tint: "#F0E4D8" },
};

// 3. Soft blush + warm pastels: copper, tangerine, amber gold, mauve
const blushHour: Theme = {
  id: "blush-hour", name: "Blush Hour", group: "Light", isDark: false,
  ink: "#2A1810", cream: "#FAF4F2", page: "#F5EDE8", card: "#FFF8F5", cardBorder: "#C4907E",
  textStrong: "#2A1810", textSoft: "#7A5040",
  primary: "#C06040", success: "#5A8848", warning: "#C07820", danger: "#9B2828",
  glucoseHigh: "#9B2828", glucoseLow: "#4A7AA8",
  teal:   cf("#B85E30", "#964018", "#F0D8C0", "#5A2010", "#F5E0C8"),           // steps — warm copper
  coral:  cfn("#D87030", "#B85010", "#FAE0C8", "#5A2208", "#FDE8D0"),         // meals — tangerine
  blue:   cfn("#5870B8", "#385898", "#D5DCEC", "#182040", "#DBE0F2"),         // water — rose blue
  amber:  cfn("#C09028", "#A07010", "#F5E8B8", "#5A3808", "#FAF0C5"),         // sleep — warm amber gold
  purple: cfn("#8860A8", "#684888", "#EAD8EA", "#401040", "#F0E0F0"),         // finance — soft mauve
  berry:  cf("#B03860", "#903050", "#F0C8D5", "#500A20", "#F5D0DC"),           // glucose — deep berry
  violet: cfn("#9060C0", "#7040A0", "#EAD8F5", "#3A0E48", "#F0E0F8"),         // mood — warm violet
  red:    cfn("#B03030", "#901818", "#F8D0D0", "#580808", "#FADADA"),
  pink:   cfn("#B03860", "#903050", "#F0C8D5", "#500A20", "#F5D0DC"),
  green:  cfn("#5A8848", "#407030", "#D0E8C8", "#182010", "#D8EDD0"),
  brown:  { solid: "#9A6848", sub: "#784828", tint: "#F5E8DC" },
};

// 4. Cool ivory + jewel tones: sapphire, ruby rose, amethyst, indigo
const jewelLight: Theme = {
  id: "jewel-light", name: "Jewel Light", group: "Light", isDark: false,
  ink: "#12183A", cream: "#F2F4FA", page: "#EEF0F5", card: "#FAFBFF", cardBorder: "#A8B4D0",
  textStrong: "#12183A", textSoft: "#485880",
  primary: "#2A5CC8", success: "#1A7A50", warning: "#D46C00", danger: "#C02040",
  glucoseHigh: "#C02040", glucoseLow: "#1A5CB8",
  teal:   cf("#1A5CB8", "#0A3A90", "#C0D4F0", "#001850", "#CCE0F8"),           // steps — sapphire
  coral:  cfn("#C83060", "#A01040", "#F5C8DC", "#580010", "#FAD5E4"),         // meals — ruby rose
  blue:   cfn("#1890C8", "#0A6898", "#C0E0F0", "#003850", "#CCE8F5"),         // water — ocean blue
  amber:  cfn("#8040C0", "#6020A0", "#E0C8F5", "#300848", "#E8D0FA"),         // sleep — amethyst
  purple: cfn("#6028A0", "#401880", "#DDD0F0", "#200848", "#E5D5F8"),         // finance — deep violet
  berry:  cf("#C02850", "#980830", "#F5C8D5", "#480010", "#FAD0DC"),           // glucose — jewel ruby
  violet: cfn("#6848D0", "#4828B0", "#DDD8F8", "#180850", "#E5E0FA"),         // mood — indigo
  red:    cfn("#C02040", "#A00020", "#FAD0D8", "#580010", "#FAD5DA"),
  pink:   cfn("#C02850", "#980830", "#F5C8D5", "#480010", "#FAD0DC"),
  green:  cfn("#1A7A50", "#0A5830", "#C0E0D0", "#003818", "#CCE8D8"),
  brown:  { solid: "#7A5840", sub: "#5A3820", tint: "#F0E8E0" },
};

// 5. Cool gray + saturated primary accents: teal, burnt orange, strong blue
const cleanSlate: Theme = {
  id: "clean-slate", name: "Clean Slate", group: "Light", isDark: false,
  ink: "#1A1A1A", cream: "#F3F3F3", page: "#EBEBEB", card: "#F7F7F7", cardBorder: "#A0A0A0",
  textStrong: "#1A1A1A", textSoft: "#555555",
  primary: "#2080E0", success: "#20A040", warning: "#E08000", danger: "#D02020",
  glucoseHigh: "#D02020", glucoseLow: "#2080E0",
  teal:   cf("#007898", "#005878", "#C0E0EA", "#002840", "#CAEBF2"),           // steps — teal blue
  coral:  cfn("#D05020", "#A83010", "#FAD8C8", "#5A1808", "#FDE0D0"),         // meals — burnt orange
  blue:   cfn("#1878D8", "#0058B8", "#C0D8F5", "#002060", "#CCE0F8"),         // water — strong blue
  amber:  cfn("#C08020", "#A06010", "#F5E8C0", "#503808", "#FAF0C8"),         // sleep — golden yellow
  purple: cfn("#6838B8", "#4818A0", "#E0D0F5", "#280848", "#E8D8FA"),         // finance — bold purple
  berry:  cf("#C01858", "#A00038", "#F5C8D8", "#580018", "#FAD0E0"),           // glucose — vivid berry
  violet: cfn("#7838B8", "#5818A0", "#E8D0F5", "#2C0848", "#EED8FA"),         // mood — bright violet
  red:    cfn("#D02020", "#B00808", "#FAD0D0", "#5A0808", "#FAD5D5"),
  pink:   cfn("#C01858", "#A00038", "#F5C8D8", "#580018", "#FAD0E0"),
  green:  cfn("#20A040", "#108028", "#C0E8CC", "#083818", "#CCF0D5"),
  brown:  { solid: "#808080", sub: "#606060", tint: "#F0F0F0" },
};

// ─── DARK THEMES ──────────────────────────────────────────────────────────────

// 6. Charcoal steel + bright teal/coral/berry family adapted for dark contrast
const midnightSteel: Theme = {
  id: "midnight-steel", name: "Midnight Steel", group: "Dark", isDark: true,
  ink: "#9ABACF", cream: "#1A1E24", page: "#161A20", card: "#1E242C", cardBorder: "#5A80A0",
  textStrong: "#EAF2FA", textSoft: "#8AAABB",
  primary: "#6AAAD8", success: "#40C088", warning: "#E09A18", danger: "#F06060",
  glucoseHigh: "#F06060", glucoseLow: "#60C8E8",
  teal:   cf("#60CCE8", "#38A8C0", "#0A2A30", "#C0F0FF", "#0A2A30"),           // steps — bright teal
  coral:  cfn("#F08888", "#C86060", "#3A1818", "#FFB8A8", "#3A1818"),         // meals — warm coral
  blue:   cfn("#6AAAD8", "#4888B8", "#0A1E36", "#A8D8F8", "#0A1E36"),         // water — steel blue
  amber:  cfn("#E0B848", "#B89028", "#201800", "#FFE098", "#181200"),         // sleep — bright amber
  purple: cfn("#A878F0", "#8058D0", "#180E30", "#D8C0FF", "#120A28"),         // finance — vivid purple
  berry:  cf("#E888A8", "#C06888", "#2E0E1C", "#FFB8D0", "#280A18"),          // glucose — rose berry
  violet: cfn("#C098F8", "#9878D8", "#20103A", "#E8D0FF", "#18082E"),         // mood — bright lavender
  red:    cfn("#F06060", "#D03838", "#3A0A0A", "#FFB0B0", "#2E0808"),
  pink:   cfn("#E888A8", "#C06888", "#2E0E1C", "#FFB8D0", "#280A18"),
  green:  cfn("#48C890", "#309870", "#082A1A", "#A0F0C8", "#061E12"),
  brown:  { solid: "#C09878", sub: "#A07858", tint: "#1C1008" },
};

// 7. Deep navy + cyan, gold, neon magenta
const deepNavy: Theme = {
  id: "deep-navy", name: "Deep Navy", group: "Dark", isDark: true,
  ink: "#80B0D8", cream: "#0E1422", page: "#0A0E18", card: "#10182A", cardBorder: "#5888B8",
  textStrong: "#EEF4FF", textSoft: "#8AAAD0",
  primary: "#00C8FF", success: "#00E878", warning: "#FFB800", danger: "#FF5050",
  glucoseHigh: "#FF5080", glucoseLow: "#00A8FF",
  teal:   cf("#00D8FF", "#00A8D0", "#002830", "#A0F4FF", "#002030"),           // steps — bright cyan
  coral:  cfn("#FF60A0", "#D03878", "#200818", "#FFB0D0", "#180510"),         // meals — neon magenta
  blue:   cfn("#20A0F0", "#0078C8", "#001830", "#90D8FF", "#001020"),         // water — ocean blue
  amber:  cfn("#FFB800", "#D09000", "#201800", "#FFE898", "#181000"),         // sleep — gold
  purple: cfn("#B878FF", "#9050F0", "#180828", "#DDB8FF", "#100620"),         // finance — electric purple
  berry:  cf("#FF3090", "#D00868", "#200010", "#FFA0D0", "#180008"),           // glucose — neon pink
  violet: cfn("#8888FF", "#6060E0", "#100830", "#C8C8FF", "#080520"),         // mood — electric blue-violet
  red:    cfn("#FF5050", "#D02828", "#200808", "#FFA8A8", "#180606"),
  pink:   cfn("#FF3090", "#D00868", "#200010", "#FFA0D0", "#180008"),
  green:  cfn("#00F088", "#00C868", "#002214", "#90FFD0", "#001A0E"),
  brown:  { solid: "#90A0B8", sub: "#708098", tint: "#081018" },
};

// 8. Deep plum + rose, amber, bright mint
const velvetDusk: Theme = {
  id: "velvet-dusk", name: "Velvet Dusk", group: "Dark", isDark: true,
  ink: "#C090E0", cream: "#160C20", page: "#120818", card: "#1A1028", cardBorder: "#9860C8",
  textStrong: "#F5EEFF", textSoft: "#B888D0",
  primary: "#E060C0", success: "#40D890", warning: "#E0A828", danger: "#FF5070",
  glucoseHigh: "#FF5070", glucoseLow: "#70B0FF",
  teal:   cf("#F070B0", "#C84888", "#280E1E", "#FFB0D8", "#200A18"),           // steps — vivid rose
  coral:  cfn("#F0A050", "#C87830", "#201408", "#FFD090", "#180E04"),         // meals — amber orange
  blue:   cfn("#28F0D0", "#10C8A8", "#041C18", "#90FFEE", "#021410"),         // water — bright mint
  amber:  cfn("#E0B838", "#B89018", "#1C1408", "#FFE888", "#140E04"),         // sleep — warm amber
  purple: cfn("#C888FF", "#A068E0", "#180A28", "#E8C8FF", "#100618"),         // finance — bright lavender
  berry:  cf("#FF7898", "#E05070", "#200810", "#FFC0D0", "#180608"),           // glucose — rose coral
  violet: cfn("#D070F8", "#A848D8", "#1A0828", "#F0B0FF", "#120520"),         // mood — vivid violet
  red:    cfn("#FF5070", "#D02850", "#200810", "#FFA8B8", "#180608"),
  pink:   cfn("#FF7898", "#E05070", "#200810", "#FFC0D0", "#180608"),
  green:  cfn("#50E8A0", "#28C080", "#041C10", "#98FFC8", "#021408"),
  brown:  { solid: "#D0A0B8", sub: "#A88098", tint: "#1C0A14" },
};

// 9. Deep forest + lime green, sky blue, warm amber
const forestNight: Theme = {
  id: "forest-night", name: "Forest Night", group: "Dark", isDark: true,
  ink: "#80C060", cream: "#0C1A0C", page: "#080E08", card: "#0E1810", cardBorder: "#508840",
  textStrong: "#EEFAE0", textSoft: "#90C078",
  primary: "#88D840", success: "#60E080", warning: "#F0A030", danger: "#F05840",
  glucoseHigh: "#F06840", glucoseLow: "#60C8F8",
  teal:   cf("#88E850", "#60C030", "#0A1808", "#C8FF88", "#081208"),           // steps — bright lime
  coral:  cfn("#F8B050", "#D08830", "#1C0E04", "#FFE098", "#140A02"),         // meals — warm amber
  blue:   cfn("#60D0F8", "#38B0D8", "#041820", "#B0F0FF", "#021012"),         // water — sky blue
  amber:  cfn("#F0D048", "#C8A828", "#181400", "#FFF890", "#100E00"),         // sleep — golden yellow
  purple: cfn("#D890FF", "#B068E0", "#180A28", "#F0C8FF", "#100620"),         // finance — orchid
  berry:  cf("#F87858", "#D05838", "#1E0A04", "#FFC0A8", "#160602"),           // glucose — coral orange
  violet: cfn("#C0A8F0", "#9888D0", "#100A20", "#E8D8FF", "#0A0614"),         // mood — soft lavender
  red:    cfn("#F05840", "#D03020", "#1C0806", "#FFA890", "#140604"),
  pink:   cfn("#F87858", "#D05838", "#1E0A04", "#FFC0A8", "#160602"),
  green:  cfn("#60F090", "#38D068", "#041808", "#B0FFCC", "#021004"),
  brown:  { solid: "#B0A880", sub: "#908860", tint: "#100C08" },
};

// 10. Espresso brown + terracotta, sage green, dusty blue
const espresso: Theme = {
  id: "espresso", name: "Espresso", group: "Dark", isDark: true,
  ink: "#C8A070", cream: "#120E0A", page: "#0E0908", card: "#18120E", cardBorder: "#A07848",
  textStrong: "#FAF0DC", textSoft: "#B89870",
  primary: "#E88040", success: "#60C880", warning: "#D8A828", danger: "#E87070",
  glucoseHigh: "#E86050", glucoseLow: "#78B8F0",
  teal:   cf("#F08848", "#C86828", "#1C0E08", "#FFD0A0", "#140A04"),           // steps — terracotta
  coral:  cfn("#E88050", "#C06030", "#1C0E08", "#FFC090", "#140A04"),         // meals — burnt sienna
  blue:   cfn("#78B8F0", "#5098D0", "#0A1422", "#C0DCFF", "#080E18"),         // water — dusty blue
  amber:  cfn("#78C888", "#58A868", "#0A1A0E", "#B8F0C8", "#080E0A"),         // sleep — sage green
  purple: cfn("#C090B8", "#A07098", "#180A18", "#F0D0E8", "#100610"),         // finance — dusty mauve
  berry:  cf("#E88070", "#C06050", "#1C0E0A", "#FFC0B0", "#140A06"),           // glucose — muted rose
  violet: cfn("#A090D8", "#8070B8", "#100A1C", "#D8C8FF", "#0A0614"),         // mood — dusty violet
  red:    cfn("#E87070", "#C05050", "#1C0808", "#FFB8B8", "#140606"),
  pink:   cfn("#E88070", "#C06050", "#1C0E0A", "#FFC0B0", "#140A06"),
  green:  cfn("#68D090", "#48B070", "#0A1A0E", "#B0F0C8", "#081208"),
  brown:  { solid: "#D8B888", sub: "#B09068", tint: "#1A1208" },
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
