import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";

// Teardrop / water-drop path scaled to a 24×24 viewBox
const DROP_PATH =
  "M12 2.5 C11.5 2.5 4.5 10 4.5 15.5 C4.5 19.6 7.9 23 12 23 C16.1 23 19.5 19.6 19.5 15.5 C19.5 10 12.5 2.5 12 2.5Z";

interface LoadingIndicatorProps {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingIndicator({ size = "small", color, style }: LoadingIndicatorProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const dim = size === "large" ? 44 : 22;
  const fillColor = color ?? theme.teal.solid;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 550, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.88, duration: 380, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 320, useNativeDriver: true }),
        Animated.delay(200),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scale]);

  return (
    <Animated.View
      style={[{ width: dim, height: dim, transform: [{ scale }] }, style]}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <Svg width={dim} height={dim} viewBox="0 0 24 24">
        <Path d={DROP_PATH} fill={fillColor} />
      </Svg>
    </Animated.View>
  );
}
