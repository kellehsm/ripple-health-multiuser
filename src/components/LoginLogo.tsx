import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Svg, { Path, G, Rect, Defs, ClipPath } from "react-native-svg";
import ReanimatedLib, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing as REasing,
} from "react-native-reanimated";

const AnimatedPolyline = ReanimatedLib.createAnimatedComponent(
  require("react-native-svg").Polyline
);

const TEAL   = "#149D74";
const CORAL  = "#E8654E";
const PURPLE = "#7E5A9B";
const BERRY  = "#A62A50";

const DROP_PATH =
  "M12 2.5 C11.5 2.5 4.5 10 4.5 15.5 C4.5 19.6 7.9 23 12 23 C16.1 23 19.5 19.6 19.5 15.5 C19.5 10 12.5 2.5 12 2.5Z";

const HB_POINTS = "0,12 7.5,12 8.1,11 9.2,13 10,12 10.5,12 11.2,8 12.8,16 13.5,12 24,12";
const HB_LENGTH = 58;

// ── Timing ──────────────────────────────────────────────────────────────────
const HB_DRAW  = 1200; // draw duration (ms) — calm, not frantic
const HB_PAUSE =  600; // pause at end before reset

// ── Stroke weights ───────────────────────────────────────────────────────────
const HB_STROKE      = 0.35; // thin heartbeat line in viewBox coords
const OUTLINE_STROKE = 0.45; // droplet outline

const DIM = 120; // px — matches original splash size

export function LoginLogo() {
  const uid = useRef(Math.random().toString(36).slice(2, 6)).current;
  const clipId = `ll-${uid}`;

  const dashOffset = useSharedValue(HB_LENGTH);

  const animatedHBProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  useEffect(() => {
    dashOffset.value = withRepeat(
      withSequence(
        withTiming(0,         { duration: HB_DRAW,  easing: REasing.inOut(REasing.ease) }),
        withTiming(HB_LENGTH, { duration: 0 }),
        withTiming(HB_LENGTH, { duration: HB_PAUSE }),
      ),
      -1,
      false
    );
    return () => cancelAnimation(dashOffset);
  }, []);

  return (
    <View
      style={{ width: DIM, height: DIM, alignItems: "center", justifyContent: "center" }}
      accessibilityLabel="Ripple Wellness"
      accessibilityRole="image"
    >
      <Svg width={DIM} height={DIM} viewBox="0 0 24 24">
        <Defs>
          <ClipPath id={clipId}>
            <Path d={DROP_PATH} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <Rect x="0"  y="0"  width="12" height="12" fill={TEAL}   />
          <Rect x="12" y="0"  width="12" height="12" fill={CORAL}  />
          <Rect x="0"  y="12" width="12" height="12" fill={PURPLE} />
          <Rect x="12" y="12" width="12" height="12" fill={BERRY}  />
        </G>
        <G clipPath={`url(#${clipId})`}>
          <AnimatedPolyline
            points={HB_POINTS}
            stroke="#111111"
            strokeWidth={HB_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={HB_LENGTH}
            animatedProps={animatedHBProps}
          />
        </G>
        <Path d={DROP_PATH} fill="none" stroke="#111111" strokeWidth={OUTLINE_STROKE} />
      </Svg>
    </View>
  );
}
