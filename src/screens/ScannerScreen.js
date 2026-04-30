import NavBar from '../components/NavBar';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Animated, Dimensions, BackHandler, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { apiLogout, apiGetCart } from '../api/client';
import { hardExit } from '../utils/exitApp';

const { width } = Dimensions.get('window');
const SCAN_SIZE = width * 0.72;
const IDLE_TIMEOUT = 5 * 60 * 1000;

export default function ScannerScreen({ navigation, route }) {
  const { token } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cameraActive, setCameraActive] = useState(true);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const idleTimer = useRef(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  useEffect(() => {
    startAnim();
    resetIdleTimer();
    loadCartCount();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') resetIdleTimer(); else clearTimeout(idleTimer.current); });
    return () => { animRef.current?.stop(); sub.remove(); clearTimeout(idleTimer.current); };
  }, []);

  useEffect(() => {
    navigation.addListener('blur', () => { setCameraActive(false); });
    const unsubscribe = navigation.addListener('focus', () => {
      setScanned(false);
      setCameraActive(true);
      loadCartCount();
      resetIdleTimer();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCartCount = async () => {
    try {
      const data = await apiGetCart(token);
      setCartCount((data.items || []).reduce((s, i) => s + (i.quantity || 1), 0));
    } catch (e) {}
  };

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => { if (token) await apiLogout(token).catch(()=>{}); navigation.reset({ index: 0, routes: [{ name: 'Pin' }] }); setTimeout(() => { hardExit(); }, 300); }, IDLE_TIMEOUT);
  };

  const startAnim = () => {
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    animRef.current.start();
  };

  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SCAN_SIZE - 4] });

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    resetIdleTimer();
    if (!data.startsWith('BIROS:')) {
      Alert.alert('Μη έγκυρο QR', 'Αυτό το QR δεν ανήκει στο BIROS σύστημα.');
      return;
    }
    setScanned(true);
    const qrToken = data.replace('BIROS:', '');
    navigation.navigate('Product', { qrToken, token });
    // Reset αμέσως μετά - έτσι όταν γυρίσει η κάμερα είναι έτοιμη
    setTimeout(() => {
      setScanned(false);
    }, 300);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Απαιτείται πρόσβαση στην κάμερα</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Παροχή πρόσβασης</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <NavBar navigation={navigation} token={token} onCartUpdate={() => {}} />

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={cameraActive && !scanned}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.maskTop} />
        <View style={styles.maskMiddle}>
          <View style={styles.maskSide} />
          <View style={styles.scanBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
          </View>
          <View style={styles.maskSide} />
        </View>
        <View style={styles.maskBottom} />
      </View>

      <Text style={styles.hint}>Στρέψτε την κάμερα στο QR label</Text>
      <View style={styles.bottom} />
    </SafeAreaView>
  );
}

const MASK_COLOR = 'rgba(0,0,0,0.65)';
const CW = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  title: { color: '#fff', fontSize: 17, fontWeight: '600', flex: 1 },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cartBadgeBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  cartIcon: { fontSize: 22 },
  badge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#e74c3c', borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#16354f', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  homeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#16354f', borderWidth: 1, borderColor: '#4a7fa5', alignItems: 'center', justifyContent: 'center' },
  homeTxt: { fontSize: 16 },
  helpBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d5f8a', borderWidth: 1, borderColor: '#2ab4ea', alignItems: 'center', justifyContent: 'center' },
  helpTxt: { color: '#2ab4ea', fontSize: 16, fontWeight: '800' },
  powerIcon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  powerRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#e74c3c', position: 'absolute', borderTopColor: 'transparent' },
  powerLine: { width: 2, height: 8, backgroundColor: '#e74c3c', borderRadius: 1, position: 'absolute', top: 0 },
  cameraWrap: { width: '100%', height: SCAN_SIZE + 60, position: 'relative' },
  maskTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 30, backgroundColor: MASK_COLOR },
  maskMiddle: { position: 'absolute', top: 30, left: 0, right: 0, height: SCAN_SIZE, flexDirection: 'row' },
  maskSide: { flex: 1, backgroundColor: MASK_COLOR },
  maskBottom: { position: 'absolute', top: 30 + SCAN_SIZE, left: 0, right: 0, bottom: 0, backgroundColor: MASK_COLOR },
  scanBox: { width: SCAN_SIZE, height: SCAN_SIZE, overflow: 'hidden' },
  corner: { position: 'absolute', width: 22, height: 22 },
  cornerTL: { top: 0, left: 0, borderTopWidth: CW, borderLeftWidth: CW, borderColor: '#2ab4ea' },
  cornerTR: { top: 0, right: 0, borderTopWidth: CW, borderRightWidth: CW, borderColor: '#2ab4ea' },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CW, borderLeftWidth: CW, borderColor: '#2ab4ea' },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CW, borderRightWidth: CW, borderColor: '#2ab4ea' },
  scanLine: { position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: '#2ab4ea', opacity: 0.85 },
  hint: { color: '#aac4e0', fontSize: 13, textAlign: 'center', marginTop: 10 },
  bottom: { flex: 1 },
  btn: { backgroundColor: '#2d5f8a', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3a5f' },
  msg: { color: '#fff', marginBottom: 16, fontSize: 16 },
});
