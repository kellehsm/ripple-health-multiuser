import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { layeredShadow, hardOffset, ShadowSize } from "../theme/styleUtils";

interface ShadowCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Controls offset + blur magnitude. Default "card". */
  size?: ShadowSize;
  /** Override card background (defaults to theme.card). */
  bg?: string;
  /** Optional accent color — adds a colored atmospheric glow. */
  accent?: string;
  /** Optional slight rotation in degrees for a confident, human feel. */
  rotate?: number;
  /** Border radius. Default 18. */
  radius?: number;
  /** Border color override (defaults to theme.ink). */
  borderColor?: string;
  /** Padding inside the card. Default 14. */
  padding?: number;
}

/**
 * The design system's layered-shadow card.
 *
 * Renders three visual layers:
 *   1. Hard ink-colored offset View (absolutely positioned behind, creates the
 *      bold offset shadow that is the key design signature).
 *   2. The card View itself with soft iOS shadow + Android elevation for
 *      atmospheric depth.
 *   3. A 2.5px ink border for the Bold Outline look.
 *
 * Usage:
 *   <ShadowCard size="hero" accent={theme.berry.solid}>
 *     <Text>Glucose: 142</Text>
 *   </ShadowCard>
 */
export function ShadowCard({
  children,
  style,
  size = "card",
  bg,
  accent,
  rotate,
  radius = 18,
  borderColor,
  padding = 14,
}: ShadowCardProps) {
  const { theme } = useTheme();
  const ink = theme.ink;
  const isDark = theme.isDark;
  const offset = hardOffset(size);
  const softShadow = layeredShadow(size, isDark, accent);

  // In dark mode the hard shadow uses a slightly lighter shade than the card
  // so it remains visible; in light mode it uses the ink color directly.
  const hardColor = isDark ? "rgba(0,0,0,0.75)" : ink;

  const transform = rotate !== undefined ? [{ rotate: `${rotate}deg` }] : undefined;

  return (
    <View
      style={[
        {
          // Extra margin so the hard shadow isn't clipped
          marginBottom: offset,
          marginRight: offset,
        },
        transform ? { transform } : undefined,
      ]}
    >
      {/* Layer 1: Hard ink offset shadow */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: offset,
          left: offset,
          right: -offset,
          bottom: -offset,
          backgroundColor: hardColor,
          borderRadius: radius,
          opacity: isDark ? 0.7 : 1,
        }}
      />

      {/* Layer 2 + 3: Card body with soft atmospheric shadow + border */}
      <View
        style={[
          {
            backgroundColor: bg ?? theme.card,
            borderRadius: radius,
            borderWidth: 2.5,
            borderColor: borderColor ?? ink,
            padding,
            ...softShadow,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
