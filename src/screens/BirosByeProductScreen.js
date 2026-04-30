import React, { useState, useEffect, useRef } from 'react';
import { hardExit } from '../utils/exitApp';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert,
  SafeAreaView, ActivityIndicator, BackHandler, AppState
} from 'react-native';

import { getBaseUrl, getCachedBaseUrl, invalidateBaseUrl } from '../api/endpoint';
const IDLE_TIMEOUT = 5 * 60 * 1000;

export default function BirosByeProductScreen({ navigation, route }) {
  const { qrToken } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const idleTimer = useRef(null);

  useEffect(() => {
    loadProduct();
    resetIdleTimer();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') resetIdleTimer();
      else clearTimeout(idleTimer.current);
    });
    return () => { sub.remove(); clearTimeout(idleTimer.current); };
  }, []);

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Pin' }] });
      setTimeout(() => { hardExit(); }, 300);
    }, IDLE_TIMEOUT);
  };

  const loadProduct = async () => {
    try {
      const base = await getBaseUrl();
      const r = await fetch(`${base}/api/birosbye/item/${qrToken}`);
      const data = await r.json();
      if (data.ok) setProduct(data.product);
      else { Alert.alert('Σφάλμα', data.error || 'Δεν φορτώθηκε'); navigation.goBack(); }
    } catch (e) {
      Alert.alert('Σφάλμα', 'Αποτυχία σύνδεσης');
      navigation.goBack();
    } finally { setLoading(false); }
  };

  const getPhotoUri = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    if (photo.startsWith('data:')) return photo;
    const base = getCachedBaseUrl();
    if (photo.startsWith('/')) return `${base}${photo}`;
    return `data:image/jpeg;base64,${photo}`;
  };

  const handleNewScan = () => {
    resetIdleTimer();
    navigation.goBack();
  };

  const handleLogout = () => {
    clearTimeout(idleTimer.current);
    navigation.reset({ index: 0, routes: [{ name: 'Pin' }] });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;
  if (!product) return null;

  const photoUri = getPhotoUri(product.photo);

  return (
    <SafeAreaView style={styles.container}>
      {/* Μόνιμη μπάρα — Νέο Σκαν + Έξοδος */}
      <View style={styles.bar}>
        <TouchableOpacity style={styles.barBtn} onPress={handleNewScan}>
          <Text style={styles.barBtnTxt}>📷 Νέο Σκαν</Text>
        </TouchableOpacity>
        <Text style={styles.title}>BirosBye</Text>
        <TouchableOpacity style={styles.quitBtn} onPress={handleLogout}>
          <Text style={styles.quitTxt}>🚪 Έξοδος</Text>
        </TouchableOpacity>
      </View>

      <ScrollView onTouchStart={resetIdleTimer}>
        {photoUri
          ? <Image source={{ uri: photoUri }} style={styles.image} />
          : <View style={styles.noImage}><Text style={styles.noImageText}>Χωρίς φωτογραφία</Text></View>
        }

        <View style={styles.info}>
          <Text style={styles.name}>{product.name}</Text>

          {/* Χαρακτηριστικά — ΟΧΙ τιμές */}
          {product.description ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Περιγραφή</Text>
              <Text style={styles.blockValue}>{product.description}</Text>
            </View>
          ) : null}

          {product.dimensions ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Διαστάσεις</Text>
              <Text style={styles.blockValue}>{product.dimensions}</Text>
            </View>
          ) : null}

          {product.color ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Χρώμα</Text>
              <Text style={styles.blockValue}>{product.color}</Text>
            </View>
          ) : null}

          {product.material ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Υλικό</Text>
              <Text style={styles.blockValue}>{product.material}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3a5f' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#16354f', borderBottomWidth: 1, borderBottomColor: '#2d5f8a' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  barBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2ab4ea', borderRadius: 8 },
  barBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  quitBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2d5f8a', borderRadius: 8 },
  quitTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  image: { width: '100%', height: 280, resizeMode: 'cover' },
  noImage: { width: '100%', height: 180, backgroundColor: '#2d5f8a', alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: '#aac4e0', fontSize: 16 },
  info: { padding: 20 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  block: { marginBottom: 14, backgroundColor: '#16354f', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#2ab4ea' },
  blockLabel: { color: '#7dcfed', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  blockValue: { color: '#fff', fontSize: 15, lineHeight: 22 },
});
