import NavBar from '../components/NavBar';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, BackHandler, AppState, ActivityIndicator } from 'react-native';
import { apiLogout, apiGetCart, apiClearCart } from '../api/client';
import { hardExit } from '../utils/exitApp';

const IDLE_TIMEOUT = 5 * 60 * 1000;

export default function CustomerSelectScreen({ navigation, route }) {
  const { token } = route.params;
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const idleTimer = useRef(null);

  useEffect(() => {
    resetIdleTimer();
    loadCartCount();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') { resetIdleTimer(); loadCartCount(); } else { clearTimeout(idleTimer.current); } });
    return () => { sub.remove(); clearTimeout(idleTimer.current); };
  }, []);

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => { if (token) await apiLogout(token).catch(()=>{}); navigation.reset({ index: 0, routes: [{ name: 'Pin' }] }); setTimeout(() => { hardExit(); }, 300); }, IDLE_TIMEOUT);
  };

  const loadCartCount = async () => {
    try {
      const data = await apiGetCart(token);
      setCartCount((data.items || []).reduce((s, i) => s + (i.quantity || 1), 0));
    } catch (e) {}
  };

  const handleNew = () => {
    resetIdleTimer();
    // Αν το καλάθι είναι ήδη άδειο, δεν ρωτάμε — πάμε απευθείας
    if (cartCount === 0) {
      navigation.replace('Scanner', { token });
      return;
    }
    Alert.alert(
      'Νέος Πελάτης',
      'Το καλάθι θα αδειάσει. Συνέχεια;',
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Ναι, νέος πελάτης',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiClearCart(token);
            } catch (e) {}
            setLoading(false);
            navigation.replace('Scanner', { token });
          }
        }
      ]
    );
  };

  const handleExisting = () => {
    resetIdleTimer();
    navigation.replace('Scanner', { token });
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <NavBar navigation={navigation} token={token} onCartUpdate={() => {}} />

      {/* 2η μπάρα — Νέο Είδος terma δεξιά */}
      <View style={s.subBar}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.subBarBtn} onPress={() => { resetIdleTimer(); navigation.navigate('CustomItem', { token }); }}>
          <Text style={s.subBarIcon}>➕</Text>
          <Text style={[s.subBarTxt, {color:'#27ae60'}]}>Νέο Είδος</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={s.content}>
        <Text style={s.question}>Τύπος Πελάτη</Text>
        <Text style={s.subtitle}>Επιλέξτε για να συνεχίσετε</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2ab4ea" style={{ marginTop: 40 }} />
        ) : (
          <View style={s.buttons}>
            {/* Νέος Πελάτης */}
            <TouchableOpacity style={[s.bigBtn, s.newBtn]} onPress={handleNew}>
              <Text style={s.bigBtnIcon}>🆕</Text>
              <Text style={s.bigBtnTitle}>Νέος Πελάτης</Text>
              <Text style={s.bigBtnDesc}>Αδειάζει το καλάθι{'\n'}και ξεκινά από την αρχή</Text>
            </TouchableOpacity>

            {/* Υπάρχον Πελάτης */}
            <TouchableOpacity style={[s.bigBtn, s.existingBtn]} onPress={handleExisting}>
              <Text style={s.bigBtnIcon}>👤</Text>
              <Text style={s.bigBtnTitle}>Υπάρχον Πελάτης</Text>
              <Text style={s.bigBtnDesc}>Κρατάει το καλάθι{'\n'}και προσθέτει είδη</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  subBar: { flexDirection: 'row', backgroundColor: '#1a3d5c', borderBottomWidth: 1, borderBottomColor: '#2d5f8a', paddingVertical: 4 },
  subBarBtn: { width: 80, alignItems: 'center', paddingVertical: 4 },
  subBarIcon: { fontSize: 18 },
  subBarTxt: { fontSize: 8, marginTop: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2d5f8a' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cartBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  cartIcon: { fontSize: 22 },
  badge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#e74c3c', borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#16354f', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  powerIcon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  powerRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#e74c3c', position: 'absolute', borderTopColor: 'transparent' },
  powerLine: { width: 2, height: 8, backgroundColor: '#e74c3c', borderRadius: 1, position: 'absolute', top: 0 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  question: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#aac4e0', fontSize: 14, textAlign: 'center', marginBottom: 48 },
  buttons: { width: '100%', gap: 16 },
  bigBtn: { width: '100%', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 2 },
  newBtn: { backgroundColor: '#1a4a2e', borderColor: '#27ae60' },
  existingBtn: { backgroundColor: '#1a3a5a', borderColor: '#2ab4ea' },
  bigBtnIcon: { fontSize: 40, marginBottom: 10 },
  bigBtnTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  bigBtnDesc: { color: '#aac4e0', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
