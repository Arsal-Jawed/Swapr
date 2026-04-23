import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCANNER_SIZE = SCREEN_WIDTH * 0.7;

export default function ScanScreen() {
  const [mode, setMode] = useState<'scan' | 'my-code'>('scan');
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 4],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>QR Scanner</Text>
          <TouchableOpacity style={styles.historyBtn}>
            <Ionicons name="time-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'scan' && styles.modeBtnActive]}
            onPress={() => setMode('scan')}
          >
            <Ionicons name="scan-outline" size={16} color={mode === 'scan' ? Colors.white : Colors.primary} />
            <Text style={[styles.modeBtnText, mode === 'scan' && styles.modeBtnTextActive]}>Scan Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'my-code' && styles.modeBtnActive]}
            onPress={() => setMode('my-code')}
          >
            <Ionicons name="qr-code-outline" size={16} color={mode === 'my-code' ? Colors.white : Colors.primary} />
            <Text style={[styles.modeBtnText, mode === 'my-code' && styles.modeBtnTextActive]}>My Code</Text>
          </TouchableOpacity>
        </View>

        {mode === 'scan' ? (
          <View style={styles.scanArea}>
            <View style={styles.viewfinderOuter}>
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />

                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineTranslate }] },
                  ]}
                />

                <View style={styles.viewfinderCenter}>
                  <Ionicons name="qr-code-outline" size={64} color="rgba(107,33,168,0.2)" />
                </View>
              </View>
            </View>

            <Text style={styles.scanHint}>
              Point your camera at a Swapr QR code to connect
            </Text>

            <View style={styles.scanActions}>
              <TouchableOpacity style={styles.scanActionBtn}>
                <Ionicons name="flashlight-outline" size={20} color={Colors.primary} />
                <Text style={styles.scanActionText}>Torch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanActionBtn}>
                <Ionicons name="image-outline" size={20} color={Colors.primary} />
                <Text style={styles.scanActionText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanActionBtn}>
                <Ionicons name="link-outline" size={20} color={Colors.primary} />
                <Text style={styles.scanActionText}>Enter Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.myCodeArea}>
            <View style={styles.myCodeCard}>
              <View style={styles.myCodeUserRow}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop' }}
                  style={styles.myCodeAvatar}
                />
                <View>
                  <Text style={styles.myCodeName}>Your Profile</Text>
                  <Text style={styles.myCodeHandle}>@yourhandle</Text>
                </View>
              </View>

              <View style={styles.qrWrapper}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1584839404500-6e6addb4deb7?w=300&h=300&fit=crop' }}
                  style={styles.qrImage}
                />
                <View style={styles.qrLogoOverlay}>
                  <View style={styles.qrLogo}>
                    <Text style={styles.qrLogoText}>S</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.myCodeSkill}>UI/UX Design · Photography</Text>
              <Text style={styles.myCodeInfo}>Share this code to connect on Swapr</Text>
            </View>

            <View style={styles.shareActions}>
              <TouchableOpacity style={styles.shareBtn}>
                <Ionicons name="download-outline" size={18} color={Colors.primary} />
                <Text style={styles.shareBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, styles.shareBtnPrimary]}>
                <Ionicons name="share-outline" size={18} color={Colors.white} />
                <Text style={[styles.shareBtnText, styles.shareBtnTextPrimary]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  modeBtnTextActive: {
    color: Colors.white,
  },
  scanArea: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  viewfinderOuter: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    backgroundColor: 'rgba(107, 33, 168, 0.04)',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: 12,
    left: 12,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 12,
    right: 12,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 12,
    left: 12,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 12,
    right: 12,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: Colors.primary,
    opacity: 0.8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  viewfinderCenter: {
    opacity: 0.5,
  },
  scanHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  scanActions: {
    flexDirection: 'row',
    gap: 24,
  },
  scanActionBtn: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 80,
  },
  scanActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  myCodeArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  myCodeCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  myCodeUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  myCodeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  myCodeName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  myCodeHandle: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '500',
  },
  qrWrapper: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  qrLogoOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
  },
  qrLogoText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
  },
  myCodeSkill: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 6,
  },
  myCodeInfo: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  shareActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  shareBtnTextPrimary: {
    color: Colors.white,
  },
});
