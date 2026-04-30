import NavBar from '../components/NavBar';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert,
  SafeAreaView, ActivityIndicator, TextInput, BackHandler, AppState
} from 'react-native';
import { apiGetItem, apiAddToCart } from '../api/client';
import { getCachedBaseUrl } from '../api/endpoint';

const IDLE_TIMEOUT = 5 * 60 * 1000;

export default function ProductScreen({ navigation, route, onCartUpdate, cartCount }) {
  const { qrToken, token } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [months, setMonths] = useState('12');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [localCartCount, setLocalCartCount] = useState(0);
  const idleTimer = useRef(null);
  const pollTimer = useRef(null);

  const loadCartCount = async () => {
    try {
      const data = await apiGetCart(token);
      setLocalCartCount((data.items || []).reduce((s, i) => s + (i.quantity || 1), 0));
    } catch (e) {}
  };

  useEffect(() => {
    loadProduct();
    loadCartCount();
    resetIdleTimer();
    // Poll κάθε 5 δευτερόλεπτα για sync με inshop
    pollTimer.current = setInterval(loadCartCount, 5000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') { resetIdleTimer(); loadCartCount(); } else { clearTimeout(idleTimer.current); } });
    return () => { sub.remove(); clearTimeout(idleTimer.current); clearInterval(pollTimer.current); };
  }, []);

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => { if (token) { try { await (await import('../api/client')).apiLogout(token); } catch(e){} } navigation.reset({ index: 0, routes: [{ name: 'Pin' }] }); }, IDLE_TIMEOUT);
  };

  const loadProduct = async () => {
    try {
      const data = await apiGetItem(qrToken, token);
      if (data.error) { Alert.alert('Σφάλμα', data.error); navigation.goBack(); }
      else setProduct(data.product || data);
    } catch (e) {
      Alert.alert('Σφάλμα', 'Δεν φορτώθηκε το είδος');
      navigation.goBack();
    } finally { setLoading(false); }
  };

  const getInstSurcharge = () =>
    Object.values(selectedOptions).reduce((sum, opt) => sum + (Number(opt.price_installments) || Number(opt.price_surcharge) || 0), 0);

  const getCashSurcharge = () =>
    Object.values(selectedOptions).reduce((sum, opt) => sum + (Number(opt.price_cash) || Number(opt.price_surcharge) || 0), 0);

  const totalInstallments = () => Number(product?.price_installments || 0) + getInstSurcharge();
  const totalCash = () => Number(product?.price_cash || 0) + getCashSurcharge();

  const handleAddToCart = async () => {
    resetIdleTimer();
    setAdding(true);
    try {
      const res = await apiAddToCart({
        sp_id: product.sp_id || product.id,
        qty,
        price_cash: totalCash(),
        price_inst: totalInstallments(),
        selected_options: selectedOptions,
      }, token);
      if (res.ok) {
        onCartUpdate && onCartUpdate();
        loadCartCount();
      } else Alert.alert('Σφάλμα', res.error || 'Δεν προστέθηκε');
    } catch (e) { Alert.alert('Σφάλμα', 'Αποτυχία προσθήκης'); }
    finally { setAdding(false); }
  };

  const getPhotoUri = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    if (photo.startsWith('data:')) return photo;
    if (photo.startsWith('/')) return `${getCachedBaseUrl()}${photo}`;
    return `data:image/jpeg;base64,${photo}`;
  };

  const monthlyPayment = () => {
    const m = parseInt(months) || 0;
    return m ? (totalInstallments() / m).toFixed(2) : '—';
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;
  if (!product) return null;

  const photoUri = getPhotoUri(product.photo);
  const hasOptions = product.options && Object.keys(product.options).length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <NavBar navigation={navigation} token={token} onCartUpdate={() => {}} />
      {/* 2η μπάρα — Σκαν + Νέο Είδος */}
      <View style={styles.subBar}>
        <TouchableOpacity style={styles.subBarBtn} onPress={() => { resetIdleTimer(); navigation.navigate('Scanner', { token }); }}>
          <Text style={styles.subBarIcon}>📷</Text>
          <Text style={[styles.subBarTxt, {color:'#2ab4ea'}]}>Σκαν</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.subBarBtn} onPress={() => { resetIdleTimer(); navigation.navigate('CustomItem', { token }); }}>
          <Text style={styles.subBarIcon}>➕</Text>
          <Text style={[styles.subBarTxt, {color:'#27ae60'}]}>Νέο Είδος</Text>
        </TouchableOpacity>
      </View>
      <ScrollView onTouchStart={resetIdleTimer}>
        {photoUri
          ? <Image source={{ uri: photoUri }} style={styles.image} />
          : <View style={styles.noImage}><Text style={styles.noImageText}>Χωρίς φωτογραφία</Text></View>
        }

        <View style={styles.info}>
          <Text style={styles.name}>{product.name}</Text>
          {product.supplier_code ? <Text style={styles.code}>Κωδικός: {product.supplier_code}</Text> : null}

          <View style={styles.prices}>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Δόσεις</Text>
              <Text style={styles.price}>{totalInstallments().toFixed(2)}€</Text>
              {getInstSurcharge() > 0 && <Text style={styles.priceSub}>+{getInstSurcharge().toFixed(2)}€ επιπλ.</Text>}
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Μετρητά</Text>
              <Text style={styles.price}>{totalCash().toFixed(2)}€</Text>
              {getCashSurcharge() > 0 && <Text style={styles.priceSub}>+{getCashSurcharge().toFixed(2)}€ επιπλ.</Text>}
            </View>
          </View>

          {/* Παραλλαγές / Options */}
          {hasOptions && Object.entries(product.options).map(([optType, opts]) => (
            <View key={optType} style={styles.optionGroup}>
              <Text style={styles.optionTitle}>{optType}</Text>
              <View style={styles.optionRow}>
                {opts.map((opt, i) => {
                  const isSelected = selectedOptions[optType]?.name === opt.name;
                  const optPhoto = getPhotoUri(opt.photo);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                      onPress={() => {
                        resetIdleTimer();
                        setSelectedOptions(prev => {
                          if (isSelected) { const n = {...prev}; delete n[optType]; return n; }
                          return {...prev, [optType]: opt};
                        });
                      }}
                    >
                      {optPhoto && (
                        <Image source={{ uri: optPhoto }} style={styles.optionThumb} />
                      )}
                      <View>
                        <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                          {opt.name}
                        </Text>
                        {(opt.price_surcharge > 0 || opt.price_installments > 0) && (
                          <Text style={[styles.optionChipSub, isSelected && styles.optionChipTextSelected]}>
                            δόσ. +{Number(opt.price_installments || opt.price_surcharge).toFixed(0)}€ / μετρ. +{Number(opt.price_cash || opt.price_surcharge).toFixed(0)}€
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Υπολογιστής δόσης */}
          <TouchableOpacity style={styles.calcToggle} onPress={() => { resetIdleTimer(); setShowCalc(v => !v); }}>
            <Text style={styles.calcToggleText}>{showCalc ? '▲ Κλείσιμο' : '🧮 Υπολογιστής Μηνιαίας Δόσης'}</Text>
          </TouchableOpacity>
          {showCalc && (
            <View style={styles.calcBox}>
              <View style={styles.calcRow}>
                {['6','12','18','24','36','48'].map(m => (
                  <TouchableOpacity key={m} style={[styles.monthBtn, months===m && styles.monthBtnActive]} onPress={() => { resetIdleTimer(); setMonths(m); }}>
                    <Text style={[styles.monthBtnText, months===m && styles.monthBtnTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.monthInput} value={months} onChangeText={v => { resetIdleTimer(); setMonths(v); }} keyboardType="numeric" placeholder="ή γράψε μήνες" placeholderTextColor="#4a7fa5" />
              <View style={styles.calcResult}>
                <Text style={styles.calcResultLabel}>Μηνιαία δόση:</Text>
                <Text style={styles.calcResultValue}>{monthlyPayment()}€ / μήνα</Text>
              </View>
            </View>
          )}

          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => { resetIdleTimer(); setQty(q => Math.max(1, q-1)); }}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qty}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => { resetIdleTimer(); setQty(q => q+1); }}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart} disabled={adding}>
            <Text style={styles.addBtnText}>{adding ? 'Προσθήκη...' : 'Προσθήκη στο Καλάθι'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3a5f' },
  subBar: { flexDirection: 'row', backgroundColor: '#1a3d5c', borderBottomWidth: 1, borderBottomColor: '#2d5f8a', paddingVertical: 4 },
  subBarBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  subBarIcon: { fontSize: 18 },
  subBarTxt: { fontSize: 8, marginTop: 2 },
  image: { width: '100%', height: 240, resizeMode: 'cover' },
  noImage: { width: '100%', height: 160, backgroundColor: '#2d5f8a', alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: '#aac4e0', fontSize: 16 },
  info: { padding: 20 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  code: { color: '#aac4e0', marginBottom: 12 },
  prices: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  priceBox: { flex: 1, backgroundColor: '#2d5f8a', borderRadius: 10, padding: 12, alignItems: 'center' },
  priceLabel: { color: '#aac4e0', fontSize: 12, marginBottom: 4 },
  price: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  priceSub: { color: '#2ab4ea', fontSize: 11, marginTop: 2 },
  optionGroup: { marginBottom: 14 },
  optionTitle: { color: '#aac4e0', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#2d5f8a', borderRadius: 20, borderWidth: 1, borderColor: '#2d5f8a' },
  optionChipSelected: { backgroundColor: '#2ab4ea', borderColor: '#2ab4ea' },
  optionThumb: { width: 32, height: 32, borderRadius: 6, resizeMode: 'cover' },
  optionChipText: { color: '#aac4e0', fontSize: 13 },
  optionChipTextSelected: { color: '#fff', fontWeight: '600' },
  optionChipSub: { color: '#7dcfed', fontSize: 11 },
  calcToggle: { backgroundColor: '#1a4a6e', padding: 12, borderRadius: 8, marginBottom: 8, alignItems: 'center' },
  calcToggleText: { color: '#2ab4ea', fontSize: 14, fontWeight: '600' },
  calcBox: { backgroundColor: '#16354f', borderRadius: 10, padding: 14, marginBottom: 12 },
  calcRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  monthBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#2d5f8a', borderRadius: 16 },
  monthBtnActive: { backgroundColor: '#2ab4ea' },
  monthBtnText: { color: '#aac4e0', fontSize: 13 },
  monthBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  monthInput: { backgroundColor: '#1e3a5f', color: '#fff', borderRadius: 8, padding: 8, marginBottom: 10, fontSize: 14, borderWidth: 1, borderColor: '#2d5f8a' },
  calcResult: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d1f35', borderRadius: 8, padding: 12 },
  calcResultLabel: { color: '#aac4e0', fontSize: 14 },
  calcResultValue: { color: '#2ab4ea', fontSize: 20, fontWeight: 'bold' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, marginTop: 4 },
  qtyBtn: { width: 44, height: 44, backgroundColor: '#2d5f8a', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  qty: { color: '#fff', fontSize: 22, marginHorizontal: 24, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#27ae60', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  prodHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  homeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#16354f', borderWidth: 1, borderColor: '#4a7fa5', alignItems: 'center', justifyContent: 'center' },
  homeTxt: { fontSize: 16 },
  helpBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d5f8a', borderWidth: 1, borderColor: '#2ab4ea', alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  helpTxt: { color: '#2ab4ea', fontSize: 16, fontWeight: '800' },
  scanNewBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2d5f8a', borderRadius: 8, marginRight: 8 },
  scanNewText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cartBadgeBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  cartIcon: { fontSize: 22 },
  badge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#e74c3c', borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
