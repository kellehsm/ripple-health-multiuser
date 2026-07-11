import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";

type FoodResult = {
  source_food_id: string;
  name: string;
  carbs_g: number | null;
  sugar_g: number | null;
  calories: number | null;
  source_db?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onResult: (food: FoodResult) => void;
};

export function BarcodeScannerModal({ visible, onClose, onResult }: Props) {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setScanned(false);
    setError(null);
    onClose();
  }

  function handleScan({ data }: { data: string }) {
    setScanned(true);
    setError(null);
    setLoading(true);
    api
      .lookupBarcode(data)
      .then(function (result: any) {
        if (result?.error) {
          setError(result.error === "product not found"
            ? "Product not found. Try searching by name instead."
            : result.error);
          setLoading(false);
          return;
        }
        const food: FoodResult = {
          source_food_id: result.source_food_id,
          name: result.name,
          carbs_g: result.carbs_g ?? null,
          sugar_g: result.sugar_g ?? null,
          calories: result.calories ?? null,
          source_db: result.source_db,
        };
        setLoading(false);
        handleClose();
        onResult(food);
      })
      .catch(function (e: Error) {
        setError(e.message || "Barcode lookup failed");
        setLoading(false);
      });
  }

  function handleRetry() {
    setScanned(false);
    setError(null);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Scan barcode</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permText}>Camera access is required to scan barcodes.</Text>
            <Pressable style={[styles.btn, { backgroundColor: theme.amber.sub }]} onPress={requestPermission}>
              <Text style={styles.btnText}>Grant permission</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
              }}
              onBarcodeScanned={scanned ? undefined : handleScan}
            />

            {/* Viewfinder overlay */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.finder} />
            </View>

            {/* Status area */}
            <View style={styles.statusArea}>
              {loading ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.statusText}>Looking up product…</Text>
                </>
              ) : error ? (
                <>
                  <Text style={[styles.statusText, { color: "#f87171" }]}>{error}</Text>
                  <Pressable style={[styles.btn, { backgroundColor: theme.amber.sub, marginTop: 12 }]} onPress={handleRetry}>
                    <Text style={styles.btnText}>Scan again</Text>
                  </Pressable>
                </>
              ) : !scanned ? (
                <Text style={styles.statusText}>Point camera at a barcode</Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    top: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  finder: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    opacity: 0.6,
  },
  statusArea: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    minHeight: 100,
  },
  statusText: { color: "#fff", fontSize: 14, textAlign: "center", marginTop: 10 },
  permText: { color: "#fff", fontSize: 14, textAlign: "center", marginBottom: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  btn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
