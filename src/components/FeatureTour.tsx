import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";

const { width: W, height: H } = Dimensions.get("window");
const SPOT_PAD = 10;
const CARD_H_EST = 185;

export type TourStep = {
  ref: React.RefObject<View | any>;
  title: string;
  body: string;
};

type Spot = { x: number; y: number; w: number; h: number };

type Props = {
  steps: TourStep[];
  visible: boolean;
  onDone: () => void;
  scrollRef?: React.RefObject<ScrollView | any>;
  scrollY?: number;
};

export function FeatureTour({ steps, visible, onDone, scrollRef, scrollY }: Props) {
  const { theme } = useTheme();
  const [idx, setIdx] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const savedScrollY = useRef(0);

  const doMeasure = useCallback((step: TourStep) => {
    if (!step?.ref?.current) { setSpot(null); return; }
    step.ref.current.measure(
      (_x: number, _y: number, w: number, h: number, px: number, py: number) => {
        if (w > 0 && h > 0) {
          setSpot({ x: px - SPOT_PAD, y: py - SPOT_PAD, w: w + SPOT_PAD * 2, h: h + SPOT_PAD * 2 });
        } else {
          setSpot(null);
        }
      }
    );
  }, []);

  const measure = useCallback(() => {
    const step = steps[idx];
    if (!step?.ref?.current) { setSpot(null); return; }

    if (scrollRef?.current) {
      step.ref.current.measureLayout(
        scrollRef.current,
        (_lx: number, ly: number) => {
          // Scroll so element sits ~120px from top of scroll view
          const scrollTarget = Math.max(0, ly - 120);
          scrollRef.current!.scrollTo({ y: scrollTarget, animated: true });
          // Wait for scroll animation to settle then measure window position
          setTimeout(() => doMeasure(step), 380);
        },
        // measureLayout failed (element not in this scroll view) — fall back
        () => setTimeout(() => doMeasure(step), 150)
      );
    } else {
      setTimeout(() => doMeasure(step), 150);
    }
  }, [steps, idx, scrollRef, doMeasure]);

  useEffect(() => {
    if (!visible) { setIdx(0); setSpot(null); return; }
    // Save the scroll position once at the start of the tour (step 0)
    if (idx === 0) savedScrollY.current = scrollY ?? 0;
    measure();
  }, [visible, idx, measure, scrollY]);

  function handleDone() {
    // Restore scroll position to where the user was before the tour started
    scrollRef?.current?.scrollTo({ y: savedScrollY.current, animated: true });
    onDone();
  }

  if (!visible) return null;

  const step = steps[idx];
  const isLast = idx === steps.length - 1;

  function next() {
    if (isLast) handleDone();
    else setIdx(i => i + 1);
  }

  // Position tooltip below spotlight if there's room, otherwise above
  let cardTop: number;
  if (spot) {
    const belowFits = spot.y + spot.h + 16 + CARD_H_EST < H - 16;
    const aboveY = spot.y - 16 - CARD_H_EST;
    cardTop = belowFits ? spot.y + spot.h + 16 : (aboveY > 60 ? aboveY : spot.y + spot.h + 16);
  } else {
    cardTop = H / 2 - CARD_H_EST / 2;
  }

  const DIM = "rgba(0,0,0,0.72)";

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleDone} statusBarTranslucent>
      {/* ── Dimmed overlay: 4 views frame the spotlight, full-dim if no spot ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {spot ? (
          <>
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: spot.y, backgroundColor: DIM }} />
            <View style={{ position: "absolute", top: spot.y + spot.h, left: 0, right: 0, bottom: 0, backgroundColor: DIM }} />
            <View style={{ position: "absolute", top: spot.y, left: 0, width: spot.x, height: spot.h, backgroundColor: DIM }} />
            <View style={{ position: "absolute", top: spot.y, left: spot.x + spot.w, right: 0, height: spot.h, backgroundColor: DIM }} />
            {/* Spotlight ring */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: spot.y, left: spot.x, width: spot.w, height: spot.h,
                borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", borderRadius: 14,
              }}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />
        )}
      </View>

      {/* Tap backdrop to advance */}
      <Pressable style={StyleSheet.absoluteFill} onPress={next} />

      {/* ── Tooltip card ── */}
      <View
        style={[
          styles.card,
          { top: cardTop, backgroundColor: theme.card, borderColor: theme.cardBorder },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={[styles.counter, { color: theme.textSoft }]}>
            {idx + 1} of {steps.length}
          </Text>
          <Pressable onPress={handleDone} hitSlop={12}>
            <Text style={[styles.skip, { color: theme.textSoft }]}>Skip</Text>
          </Pressable>
        </View>

        <Text style={[styles.title, { color: theme.textStrong }]}>{step.title}</Text>
        <Text style={[styles.body, { color: theme.textSoft }]}>{step.body}</Text>

        {/* Progress dots */}
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === idx ? theme.teal.solid : theme.cardBorder },
              ]}
            />
          ))}
        </View>

        <Pressable onPress={next} style={[styles.btn, { backgroundColor: theme.teal.solid }]}>
          <Text style={styles.btnText}>{isLast ? "Got it" : "Next  →"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 22,
    borderWidth: 2,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  counter: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  skip: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 17, fontWeight: "900", marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  dots: { flexDirection: "row", gap: 5, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  btn: { borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
