import NavBar from '../components/NavBar';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, FlatList, ScrollView, TouchableOpacity, Alert, SafeAreaView,
  ActivityIndicator, TextInput, BackHandler, AppState, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  apiLogout, apiGetCart, apiRemoveFromCart, apiClearCart,
  apiGetDiscount, apiSetDiscount, apiSetItemDiscount, apiSetItemPrice
} from '../api/client';
import { hardExit } from '../utils/exitApp';

const IDLE_TIMEOUT = 5 * 60 * 1000;

// Component για per-item discount — memo για να μην κάνει re-render


// DiscountRow — stepper +/- χωρίς keyboard + TextInput για manual
const DiscountRow = ({ item, token, onApply }) => {
  const serverPct = item.item_discount_pct || 0;
  const [pct, setPct] = React.useState(serverPct);
  const [editing, setEditing] = React.useState(false);
  const inputRef = React.useRef(null);
  const applyTimer = React.useRef(null);

  // Sync μόνο αν δεν είμαστε σε editing mode
  React.useEffect(() => {
    if (!editing) {
      setPct(serverPct);
    }
  }, [serverPct]);

  const apply = async (val) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    setPct(v);
    await apiSetItemDiscount(item.id, v, token).catch(()=>{});
    // Delay loadCart ώστε να μην κλείσει το keyboard
    clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => { onApply(); }, 600);
  };

  return (
    <View style={dr.row}>
      <Text style={dr.label}>Έκπτ.:</Text>
      <TouchableOpacity style={dr.step} onPress={() => { setEditing(false); apply(pct - 1); }}>
        <Text style={dr.stepTxt}>−</Text>
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        style={dr.input}
        value={String(pct)}
        onChangeText={v => { setEditing(true); setPct(v); }}
        onFocus={() => setEditing(true)}
        onBlur={() => { setEditing(false); apply(pct); }}
        keyboardType="decimal-pad"
        returnKeyType="done"
        blurOnSubmit={false}
      />
      <TouchableOpacity style={dr.step} onPress={() => { setEditing(false); apply(Number(pct) + 1); }}>
        <Text style={dr.stepTxt}>+</Text>
      </TouchableOpacity>
      <Text style={dr.pct}>%</Text>
      <TouchableOpacity style={dr.applyBtn} onPress={() => { setEditing(false); apply(pct); }}>
        <Text style={dr.applyTxt}>✓</Text>
      </TouchableOpacity>
    </View>
  );
};
const dr = {
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12293f', paddingHorizontal: 10, paddingVertical: 5, gap: 4, borderTopWidth: 1, borderTopColor: '#2d5f8a' },
  label: { color: '#aac4e0', fontSize: 10 },
  step: { width: 24, height: 24, backgroundColor: '#2d5f8a', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  input: { width: 36, backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 5, padding: 3, fontSize: 12, borderWidth: 1, borderColor: '#3a70a0', textAlign: 'center' },
  pct: { color: '#aac4e0', fontSize: 10 },
  applyBtn: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#2ab4ea', borderRadius: 5 },
  applyTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
};

export default function CartScreen({ navigation, route, onCartUpdate, cartCount }) {
  const { token } = route.params;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState('12');
  const [showCalc, setShowCalc] = useState(false);
  const [discPct, setDiscPct] = useState(0);
  const [discInput, setDiscInput] = useState('');
  // v1.0.93: Price edit modal state
  const [priceEditItem, setPriceEditItem] = useState(null);
  const [priceEditValue, setPriceEditValue] = useState('');
  const [priceEditSaving, setPriceEditSaving] = useState(false);
  const idleTimer = useRef(null);

  const pollTimer = useRef(null);

  useFocusEffect(useCallback(() => {
    loadCart();
    resetIdleTimer();
    // Poll κάθε 5s — cart + discount μαζί μέσα στο loadCart
    pollTimer.current = setInterval(loadCart, 5000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') { resetIdleTimer(); loadCart(); } else { clearTimeout(idleTimer.current); } });
    return () => {
      sub.remove();
      clearTimeout(idleTimer.current);
      clearInterval(pollTimer.current);
    };
  }, []));

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => { if (token) await apiLogout(token).catch(()=>{}); navigation.reset({ index: 0, routes: [{ name: 'Pin' }] }); setTimeout(() => { hardExit(); }, 300); }, IDLE_TIMEOUT);
  };

  const isFirstLoad = useRef(true);

  const loadCart = async () => {
    // Loading spinner μόνο την πρώτη φορά — όχι στο poll
    if (isFirstLoad.current) setLoading(true);
    try {
      // Cart items + discount μαζί σε parallel
      const [data, discData] = await Promise.all([
        apiGetCart(token),
        apiGetDiscount(token)
      ]);
      setItems(data.items || []);
      // Ενημέρωσε discount ΜΟΝΟ αν άλλαξε (από inshop)
      if (discData.ok) {
        const newPct = discData.discount_pct || 0;
        setDiscPct(prev => {
          if (prev !== newPct) {
            setDiscInput(newPct === 0 ? '' : String(newPct));
          }
          return newPct;
        });
      }
    } catch (e) {
      if (isFirstLoad.current) Alert.alert('Σφάλμα', 'Δεν φορτώθηκε το καλάθι');
    } finally {
      isFirstLoad.current = false;
      setLoading(false);
    }
  };

  const handleRemove = async (id) => {
    resetIdleTimer();
    try { await apiRemoveFromCart(id, token); loadCart(); onCartUpdate && onCartUpdate(); }
    catch (e) { Alert.alert('Σφάλμα', 'Δεν αφαιρέθηκε'); }
  };

  const handleClear = () => {
    resetIdleTimer();
    Alert.alert('Καθαρισμός', 'Να αδειάσει το καλάθι;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Ναι', style: 'destructive', onPress: async () => { await apiClearCart(token); loadCart(); onCartUpdate && onCartUpdate(); }},
    ]);
  };

  // v1.0.93: Custom price handlers
  const openPriceEdit = (item) => {
    resetIdleTimer();
    if (item.is_option_item || item.is_custom) return;
    setPriceEditItem(item);
    setPriceEditValue(String(Math.round(Number(item.price_installments) || 0)));
  };

  const closePriceEdit = () => {
    setPriceEditItem(null);
    setPriceEditValue('');
    setPriceEditSaving(false);
  };

  const savePriceEdit = async () => {
    if (!priceEditItem || priceEditSaving) return;
    const newVal = parseFloat(String(priceEditValue).replace(',', '.'));
    if (!newVal || newVal <= 0) {
      Alert.alert('Σφάλμα', 'Δώσε έγκυρη τιμή > 0');
      return;
    }
    setPriceEditSaving(true);
    try {
      const r = await apiSetItemPrice(priceEditItem.id, newVal, token);
      if (r && r.ok) {
        closePriceEdit();
        await loadCart();
        onCartUpdate && onCartUpdate();
      } else {
        Alert.alert('Σφάλμα', (r && r.error) || 'Δεν αποθηκεύτηκε');
        setPriceEditSaving(false);
      }
    } catch (e) {
      Alert.alert('Σφάλμα', 'Σφάλμα δικτύου');
      setPriceEditSaving(false);
    }
  };

  const resetPriceToDefault = async () => {
    if (!priceEditItem || priceEditSaving) return;
    setPriceEditSaving(true);
    try {
      const r = await apiSetItemPrice(priceEditItem.id, null, token);
      if (r && r.ok) {
        closePriceEdit();
        await loadCart();
        onCartUpdate && onCartUpdate();
      } else {
        Alert.alert('Σφάλμα', (r && r.error) || 'Δεν αποθηκεύτηκε');
        setPriceEditSaving(false);
      }
    } catch (e) {
      Alert.alert('Σφάλμα', 'Σφάλμα δικτύου');
      setPriceEditSaving(false);
    }
  };

  const mainItems = items.filter(i => !i.is_option_item);
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity)||1), 0);
  // Σύνολο ΜΕΤΑ ανά-είδος έκπτωση (πριν γενική)
  const subTotalInst = items.reduce((s, i) => {
    const disc = i.item_discount_pct || 0;
    return s + (Number(i.price_installments)||0) * (Number(i.quantity)||1) * (1 - disc/100);
  }, 0);
  const subTotalCash = items.reduce((s, i) => {
    const disc = i.item_discount_pct || 0;
    return s + (Number(i.price_cash)||0) * (Number(i.quantity)||1) * (1 - disc/100);
  }, 0);
  // Γενική έκπτωση πάνω στο υποσύνολο
  const totalInst = subTotalInst * (1 - discPct/100);
  const totalCash = subTotalCash * (1 - discPct/100);
  const m = parseInt(months) || 0;
  const monthlyTotal = m ? (totalInst / m).toFixed(2) : '—';

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <NavBar navigation={navigation} token={token} onCartUpdate={loadCart} activeScreen="Cart" />
      {/* 2η μπάρα — μόνο στο καλάθι */}
      <View style={styles.cartBar}>
        <TouchableOpacity style={styles.cartBarBtn} onPress={() => { resetIdleTimer(); navigation.navigate('CreateQuote', { token, totalInst, totalCash, discPct }); }}>
          <Text style={styles.cartBarIcon}>📄</Text>
          <Text style={[styles.cartBarTxt, {color:'#f59e0b'}]}>Προσφορά</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartBarBtn} onPress={() => { resetIdleTimer(); setShowCalc(v => !v); }}>
          <Text style={styles.cartBarIcon}>🧮</Text>
          <Text style={[styles.cartBarTxt, {color:'#2ab4ea'}]}>Δόσεις</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartBarBtn} onPress={() => { resetIdleTimer(); navigation.navigate('Scanner', { token }); }}>
          <Text style={styles.cartBarIcon}>📷</Text>
          <Text style={[styles.cartBarTxt, {color:'#2ab4ea'}]}>Σκαν</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartBarBtn} onPress={() => { resetIdleTimer(); navigation.navigate('CustomItem', { token }); }}>
          <Text style={styles.cartBarIcon}>➕</Text>
          <Text style={[styles.cartBarTxt, {color:'#27ae60'}]}>Νέο Είδος</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cartTitleBar}>
        <Text style={styles.title}>Καλάθι ({totalQty})</Text>
      </View>

      {mainItems.length === 0 ? (
        <View style={styles.center}><Text style={styles.empty}>Το καλάθι είναι άδειο</Text></View>
      ) : (
        <ScrollView
          onTouchStart={resetIdleTimer}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
        {items.map((item) => {
            if (item.is_option_item) {
              const optDisc = item.item_discount_pct || 0;
              const optQty = Number(item.quantity) || 1;
              const optBaseInst = (Number(item.price_installments) || 0) * optQty;
              const optBaseCash = (Number(item.price_cash) || 0) * optQty;
              const optFinalInst = (optBaseInst * (1 - optDisc/100)).toFixed(2);
              const optFinalCash = (optBaseCash * (1 - optDisc/100)).toFixed(2);
              return (
                <React.Fragment key={`opt-${item.id}`}>
                <View style={styles.optionItem}>
                  <Text style={styles.optionArrow}>↳</Text>
                  {item.photo ? (
                    <Image source={{ uri: item.photo.startsWith('data:') ? item.photo : `data:image/jpeg;base64,${item.photo}` }}
                      style={styles.thumbSm} />
                  ) : (
                    <View style={styles.thumbSmPlaceholder} />
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.optionLabel}>{item.option_label || item.name}</Text>
                    {optBaseInst > 0 && (
                      <View style={styles.priceRow}>
                        {optDisc > 0 && <Text style={styles.priceOld}>+{optBaseInst.toFixed(2)}€</Text>}
                        <Text style={styles.optionPrice}>+{optFinalInst}€ δόσ.</Text>
                      </View>
                    )}
                    {optBaseCash > 0 && (
                      <View style={styles.priceRow}>
                        {optDisc > 0 && <Text style={styles.priceOld}>+{optBaseCash.toFixed(2)}€</Text>}
                        <Text style={styles.optionPrice}>+{optFinalCash}€ μετρ.</Text>
                      </View>
                    )}
  
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.id)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <DiscountRow item={item} token={token} onApply={loadCart} />
                </React.Fragment>
              );
            }
            const itemDisc = item.item_discount_pct || 0;
            const qty = Number(item.quantity) || 1;
            const baseInst = (Number(item.price_installments) || 0) * qty;
            const baseCash = (Number(item.price_cash) || 0) * qty;
            const finalInst = (baseInst * (1 - itemDisc/100)).toFixed(2);
            const finalCash = (baseCash * (1 - itemDisc/100)).toFixed(2);
            // v1.0.93: Editable price μόνο για κύρια είδη (όχι options/custom)
            const canEditPrice = !item.is_custom;
            return (
              <React.Fragment key={`item-${item.id}`}>
              <View style={styles.item}>
                {item.photo ? (
                  <Image source={{ uri: item.photo.startsWith('data:') ? item.photo : `data:image/jpeg;base64,${item.photo}` }}
                    style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder} />
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>x{qty}</Text>
                  {baseInst > 0 && (
                    <View style={styles.priceRow}>
                      {itemDisc > 0 && <Text style={styles.priceOld}>{baseInst.toFixed(2)}€</Text>}
                      {canEditPrice ? (
                        <TouchableOpacity onPress={() => openPriceEdit(item)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                          <Text style={styles.itemInstEditable}>{finalInst}€ δόσ. ✏️</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.itemInst}>{finalInst}€ δόσ.</Text>
                      )}
                    </View>
                  )}
                  {baseCash > 0 && (
                    <View style={styles.priceRow}>
                      {itemDisc > 0 && <Text style={styles.priceOld}>{baseCash.toFixed(2)}€</Text>}
                      <Text style={styles.itemCash}>{finalCash}€ μετρ.</Text>
                    </View>
                  )}

                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.id)}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <DiscountRow item={item} token={token} onApply={loadCart} />
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}



      {/* Discount + Totals — ΕΞΩΤΕΡΙΚΑ του FlatList για να μην κλείνει keyboard */}
      {mainItems.length > 0 && (
        <View style={styles.totals}>
          <View style={styles.discRow}>
            <Text style={styles.totalLabel}>Γενική Έκπτωση:</Text>
            <View style={styles.discInputWrap}>
              {[0,5,10,15,20].map(v => (
                <TouchableOpacity key={v} onPress={() => {
                  setDiscPct(v);
                  setDiscInput(v === 0 ? '' : String(v));
                  apiSetDiscount(v, token).catch(()=>{});
                }}
                  style={[styles.discChip, discPct===v && styles.discChipActive]}>
                  <Text style={[styles.discChipTxt, discPct===v && styles.discChipTxtActive]}>{v}%</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.discInput}
                value={discInput}
                placeholder="%" placeholderTextColor="#4a7fa5"
                keyboardType="decimal-pad"
                returnKeyType="done"
                onChangeText={v => setDiscInput(v)}
                onEndEditing={() => {
                  const v = parseFloat(discInput) || 0;
                  setDiscPct(v);
                  setDiscInput(v === 0 ? '' : String(v));
                  apiSetDiscount(v, token).catch(()=>{});
                }}
              />
            </View>
          </View>
          {discPct > 0 ? (
            <View style={styles.discTotalsRow}>
              <View style={styles.discTotalItem}>
                <Text style={styles.discOldPrice}>{subTotalInst.toFixed(2)}€</Text>
                <Text style={styles.totalInstText}>{totalInst.toFixed(2)}€ δόσ.</Text>
              </View>
              <View style={styles.discTotalItem}>
                <Text style={styles.discOldPrice}>{subTotalCash.toFixed(2)}€</Text>
                <Text style={styles.totalCashText}>{totalCash.toFixed(2)}€ μετρ.</Text>
              </View>
            </View>
          ) : (
            <React.Fragment>
              <Text style={styles.totalInstText}>Σύνολο Δόσεις: {totalInst.toFixed(2)}€</Text>
              <Text style={styles.totalCashText}>Σύνολο Μετρητά: {totalCash.toFixed(2)}€</Text>
            </React.Fragment>
          )}

          {showCalc && (
            <View style={styles.calcBox}>
              <View style={styles.calcRow}>
                {['6','12','18','24','36','48'].map(mo => (
                  <TouchableOpacity key={mo} style={[styles.monthBtn, months===mo && styles.monthBtnActive]} onPress={() => { resetIdleTimer(); setMonths(mo); }}>
                    <Text style={[styles.monthBtnText, months===mo && styles.monthBtnTextActive]}>{mo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.monthInput} value={months} onChangeText={v => { resetIdleTimer(); setMonths(v); }} keyboardType="numeric" placeholder="ή γράψε μήνες" placeholderTextColor="#4a7fa5" />
              <View style={styles.calcResult}>
                <Text style={styles.calcResultLabel}>Μηνιαία δόση:</Text>
                <Text style={styles.calcResultValue}>{monthlyTotal}€ / μήνα</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* v1.0.93: Price Edit Modal */}
      <Modal
        visible={!!priceEditItem}
        transparent
        animationType="fade"
        onRequestClose={closePriceEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={pmStyles.backdrop}
        >
          <View style={pmStyles.box}>
            <Text style={pmStyles.title}>✏️ Αλλαγή Τιμής</Text>
            {priceEditItem && (
              <>
                <Text style={pmStyles.itemName} numberOfLines={2}>{priceEditItem.name}</Text>
                <Text style={pmStyles.helper}>
                  Η τιμή μετρητοίς θα υπολογιστεί αυτόματα αναλογικά.
                </Text>
                <Text style={pmStyles.label}>ΤΙΜΗ ΔΟΣΕΩΝ €</Text>
                <TextInput
                  style={pmStyles.input}
                  value={priceEditValue}
                  onChangeText={setPriceEditValue}
                  keyboardType="decimal-pad"
                  autoFocus
                  selectTextOnFocus
                  editable={!priceEditSaving}
                />
                <View style={pmStyles.btnRow}>
                  <TouchableOpacity
                    style={[pmStyles.btn, pmStyles.btnCancel]}
                    onPress={closePriceEdit}
                    disabled={priceEditSaving}
                  >
                    <Text style={pmStyles.btnTxt}>Ακύρωση</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[pmStyles.btn, pmStyles.btnReset]}
                    onPress={resetPriceToDefault}
                    disabled={priceEditSaving}
                  >
                    <Text style={pmStyles.btnTxt}>↺ Αρχική</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[pmStyles.btn, pmStyles.btnSave]}
                    onPress={savePriceEdit}
                    disabled={priceEditSaving}
                  >
                    {priceEditSaving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={pmStyles.btnTxt}>Αποθήκευση</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// v1.0.93: Styles για το Price Edit Modal
const pmStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  box: { width: '100%', maxWidth: 380, backgroundColor: '#1e3a5f', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#2d5f8a' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  itemName: { color: '#aac4e0', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  helper: { color: '#7c93b1', fontSize: 12, marginBottom: 14, textAlign: 'center', fontStyle: 'italic' },
  label: { color: '#aac4e0', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 8, padding: 12, fontSize: 18, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: '#3a70a0', marginBottom: 16 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: '#4a5568' },
  btnReset: { backgroundColor: '#7c2d12' },
  btnSave: { backgroundColor: '#2ab4ea' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

const styles = StyleSheet.create({
  cartTitleBar: { paddingHorizontal: 16, paddingVertical: 8 },
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  clearBtn: { borderWidth: 1, borderColor: '#e74c3c', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  clearBtnText: { color: '#e74c3c', fontSize: 13 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#16354f', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  homeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#16354f', borderWidth: 1, borderColor: '#4a7fa5', alignItems: 'center', justifyContent: 'center' },
  homeTxt: { fontSize: 16 },
  helpBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d5f8a', borderWidth: 1, borderColor: '#2ab4ea', alignItems: 'center', justifyContent: 'center' },
  helpTxt: { color: '#2ab4ea', fontSize: 16, fontWeight: '800' },
  powerIcon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  powerRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#e74c3c', position: 'absolute', borderTopColor: 'transparent' },
  powerLine: { width: 2, height: 8, backgroundColor: '#e74c3c', borderRadius: 1, position: 'absolute', top: 0 },
  empty: { color: '#aac4e0', fontSize: 16 },
  item: { flexDirection: 'row', backgroundColor: '#2d5f8a', margin: 8, borderRadius: 10, padding: 12 },
  itemInfo: { flex: 1 },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemQty: { color: '#aac4e0', fontSize: 13 },
  itemPrice: { color: '#aac4e0', fontSize: 13 },
  removeBtn: { width: 32, height: 32, backgroundColor: '#e74c3c', borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  removeBtnText: { color: '#fff', fontWeight: 'bold' },
  totals: { backgroundColor: '#2d5f8a', margin: 8, borderRadius: 10, padding: 16 },
  totalText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  calcToggle: { backgroundColor: '#1a4a6e', margin: 8, padding: 12, borderRadius: 8, alignItems: 'center' },
  calcToggleText: { color: '#2ab4ea', fontSize: 14, fontWeight: '600' },
  calcBox: { backgroundColor: '#16354f', margin: 8, borderRadius: 10, padding: 14 },
  calcRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  monthBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#2d5f8a', borderRadius: 16 },
  monthBtnActive: { backgroundColor: '#2ab4ea' },
  monthBtnText: { color: '#aac4e0', fontSize: 13 },
  monthBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  monthInput: { backgroundColor: '#1e3a5f', color: '#fff', borderRadius: 8, padding: 8, marginBottom: 10, fontSize: 14, borderWidth: 1, borderColor: '#2d5f8a' },
  calcResult: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d1f35', borderRadius: 8, padding: 12 },
  calcResultLabel: { color: '#aac4e0', fontSize: 14 },
  calcResultValue: { color: '#2ab4ea', fontSize: 20, fontWeight: 'bold' },
  optionItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginBottom: 4, paddingLeft: 16, paddingRight: 8, paddingVertical: 6, backgroundColor: 'rgba(42,180,234,0.08)', borderRadius: 8 },
  optionArrow: { color: '#4a7fa5', fontSize: 14, marginRight: 8 },
  optionLabel: { color: '#aac4e0', fontSize: 13 },
  optionPrice: { color: '#2ab4ea', fontSize: 12 },
  priceOld: { fontSize: 10, color: '#ef4444', textDecorationLine: 'line-through', marginRight: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  // v1.0.93: editable price look (dashed underline + edit icon)
  itemInst: { color: '#2ab4ea', fontSize: 14, fontWeight: '700' },
  itemInstEditable: { color: '#fbbf24', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline', textDecorationStyle: 'dashed' },
  itemCash: { color: '#27ae60', fontSize: 13, fontWeight: '600' },
  itemDiscSection: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#16354f', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#2d5f8a' },
  itemDiscTitle: { color: '#aac4e0', fontSize: 11, fontWeight: '600', marginBottom: 8 },
  itemDiscRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  itemDiscName: { flex: 1, color: '#fff', fontSize: 12 },
  itemDiscInput: { width: 48, backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 6, padding: 4, fontSize: 13, borderWidth: 1, borderColor: '#3a70a0', textAlign: 'center' },
  itemDiscPct: { color: '#aac4e0', fontSize: 12 },
  itemDiscBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#2ab4ea', borderRadius: 6 },
  itemDiscBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  thumb: { width: 54, height: 54, borderRadius: 8, marginRight: 10, flexShrink: 0 },
  thumbPlaceholder: { width: 54, height: 54, borderRadius: 8, backgroundColor: '#2d5f8a', marginRight: 10, flexShrink: 0 },
  thumbSm: { width: 36, height: 36, borderRadius: 6, marginRight: 6, flexShrink: 0 },
  thumbSmPlaceholder: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#2d5f8a', marginRight: 6, flexShrink: 0 },
  cartBar: { flexDirection: 'row', backgroundColor: '#1a3d5c', borderBottomWidth: 1, borderBottomColor: '#2d5f8a', paddingVertical: 4 },
  cartBarBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  cartBarIcon: { fontSize: 18 },
  cartBarTxt: { fontSize: 8, marginTop: 2 },
  discRow: { marginBottom: 10 },
  discInputWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  discChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: '#2d5f8a', borderWidth: 1, borderColor: '#3a70a0' },
  discChipActive: { backgroundColor: '#2ab4ea', borderColor: '#2ab4ea' },
  discChipTxt: { color: '#aac4e0', fontSize: 12, fontWeight: '600' },
  discChipTxtActive: { color: '#fff' },
  discInput: { width: 52, backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 8, padding: 4, fontSize: 13, borderWidth: 1, borderColor: '#3a70a0', textAlign: 'center' },
  applyBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#2ab4ea', borderRadius: 6 },
  applyBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  totalLabel: { color: '#aac4e0', fontSize: 13 },
  discTotalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  discTotalItem: { alignItems: 'flex-end' },
  discOldPrice: { color: '#ef4444', fontSize: 11, textDecorationLine: 'line-through' },
  totalInstText: { color: '#2ab4ea', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  totalCashText: { color: '#27ae60', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  quoteBtn: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center' },
  quoteBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: 10, margin: 16 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  scanBtn: { backgroundColor: '#2d5f8a' },
  customBtn: { backgroundColor: '#27ae60' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  backBtnText: { color: '#fff', fontSize: 15 },
});
