import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, BackHandler, AppState
} from 'react-native';
import { apiAuth } from '../api/client';
import { hardExit } from '../utils/exitApp';
import { getBaseUrl } from '../api/endpoint';

const APP_VERSION = '1.0.104'; // AUTO: ανανεώνεται με κάθε build
const IDLE_TIMEOUT = 5 * 60 * 1000;

export default function PinScreen({ navigation, onLogin }) {
  const [pin, setPin] = useState('');
  const [netStatus, setNetStatus] = useState('Ανίχνευση δικτύου...');
  const idleTimer = useRef(null);

  useEffect(() => {
    // Ξεκίνα ανίχνευση endpoint ΑΜΕΣΩΣ για να βλέπει ο χρήστης
    getBaseUrl().then(function(url) {
      // Εμφάνισε μόνο το hostname, πιο καθαρό
      const short = url.replace(/^https?:\/\//, '').replace(/:\d+$/, '').split('/')[0];
      setNetStatus('✓ ' + short);
    }).catch(function() {
      setNetStatus('⚠ Αποτυχία σύνδεσης');
    });
  }, []);

  useEffect(() => {
    // Ξεκίνα timer μόνο όταν η app είναι όντως active
    if (AppState.currentState === 'active') {
      resetIdleTimer();
    }
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        // App επέστρεψε σε foreground — ξεκίνα νέο timer
        resetIdleTimer();
      } else {
        // App πάει σε background/inactive — σταμάτα οριστικά
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    });
    return () => { sub.remove(); clearTimeout(idleTimer.current); idleTimer.current = null; };
  }, []);

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      // Μόνο αν είμαστε όντως foreground — αλλιώς απλά ακυρώνουμε
      if (AppState.currentState === 'active') {
        hardExit();
      }
    }, IDLE_TIMEOUT);
  };

  const handleKey = (key) => {
    resetIdleTimer();
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
    } else if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 4) handleLogin(newPin);
    }
  };

  const handleLogin = async (p) => {
    // BirosBye mode: PIN 1234 → view-only scanner χωρίς server auth
    if (p === '1234') {
      clearTimeout(idleTimer.current);
      navigation.replace('BirosByeScanner');
      return;
    }
    try {
      const res = await apiAuth(p);
      if (res.token) {
        onLogin && onLogin(res.token);
        navigation.replace('CustomerSelect', { token: res.token });
      } else {
        Alert.alert('Λάθος PIN', 'Δοκιμάστε ξανά');
        setPin('');
      }
    } catch (e) {
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η σύνδεση');
      setPin('');
    }
  };

  const handleQuit = () => {
    Alert.alert('Έξοδος', 'Να κλείσει η εφαρμογή;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Έξοδος', style: 'destructive', onPress: () => { clearTimeout(idleTimer.current); hardExit(); } },
    ]);
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>BirosEye</Text>
      <Text style={styles.subtitle}>Εισάγετε PIN</Text>
      <View style={styles.dots}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
        ))}
      </View>
      <View style={styles.keypad}>
        {keys.map((k, i) => (
          k === '' ? <View key={i} style={styles.keyEmpty} /> :
          <TouchableOpacity key={i} style={styles.key} onPress={() => handleKey(k)}>
            <Text style={styles.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.version}>v{APP_VERSION}</Text>
      <Text style={styles.netStatus}>{netStatus}</Text>
      <TouchableOpacity style={styles.quitBtn} onPress={handleQuit}>
        <Text style={styles.quitText}>Έξοδος</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#aac4e0', marginBottom: 28 },
  dots: { flexDirection: 'row', marginBottom: 36 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff', marginHorizontal: 8 },
  dotFilled: { backgroundColor: '#fff' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 240 },
  key: { width: 72, height: 72, margin: 4, backgroundColor: '#2d5f8a', borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { width: 72, height: 72, margin: 4 },
  keyText: { fontSize: 24, color: '#fff', fontWeight: '600' },
  version: { color: '#4a7fa5', fontSize: 12, marginTop: 20 },
  netStatus: { color: '#6b9bc9', fontSize: 11, marginTop: 4 },
  quitBtn: { marginTop: 12, padding: 10 },
  quitText: { color: '#e74c3c', fontSize: 14 },
});
