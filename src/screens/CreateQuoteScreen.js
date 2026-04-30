import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, SafeAreaView, BackHandler, AppState
} from 'react-native';
import {
  apiSaveQuote,
  apiSchedDraftGet, apiSchedDraftAttach,
  apiSearchCustomers, apiCustomerDetails,
} from '../api/client';
import PaymentScheduleModal from '../components/PaymentScheduleModal';
import { hardExit } from '../utils/exitApp';

const IDLE_TIMEOUT = 5 * 60 * 1000;

export default function CreateQuoteScreen({ navigation, route }) {
  const { token, totalInst, totalCash, discPct } = route.params;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const idleTimer = useRef(null);

  // v1.0.94: Payment schedule state
  const [drafts, setDrafts] = useState({ interest: null, interest_free: null });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('interest');

  // v1.0.99: Customer search state
  const [searchResults, setSearchResults] = useState([]);
  const [searchField, setSearchField] = useState(null);  // 'name' | 'phone' — ποιο πεδίο ψάχνει
  const [searching, setSearching] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const searchTimerRef = useRef(null);

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => {
      navigation.reset({ index: 0, routes: [{ name: 'Pin' }] });
      setTimeout(() => { hardExit(); }, 300);
    }, IDLE_TIMEOUT);
  };

  // ── v1.0.99: Customer search με debounce ────────────────────────
  const performSearch = useCallback(async (query, field) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const apiField = field === 'phone' ? 'phone' : '';
      const r = await apiSearchCustomers(query, token, apiField);
      setSearchResults(Array.isArray(r) ? r : []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [token]);

  const handleNameChange = (v) => {
    resetIdleTimer();
    setName(v);
    setSelectedCustomerId(null);
    setSearchField('name');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(v, 'name'), 400);
  };

  const handlePhoneChange = (v) => {
    resetIdleTimer();
    setPhone(v);
    setSelectedCustomerId(null);
    setSearchField('phone');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(v, 'phone'), 400);
  };

  const selectCustomer = async (cust) => {
    setSearching(true);
    try {
      const r = await apiCustomerDetails(cust.id, token);
      if (r && r.ok) {
        const fullName = `${r.last_name} ${r.first_name}`.trim();
        setName(fullName);
        setPhone(r.phone || '');
        setEmail(r.email || '');
        const addrParts = [r.address, r.city, r.postal_code].filter(Boolean);
        setAddress(addrParts.join(', '));
        setSelectedCustomerId(cust.id);
        setSearchResults([]);
        setSearchField(null);
      }
    } catch (e) {
      Alert.alert('Σφάλμα', 'Αποτυχία φόρτωσης πελάτη');
    } finally {
      setSearching(false);
    }
  };

  const closeSearchResults = () => {
    setSearchResults([]);
    setSearchField(null);
  };

  // totalInst/totalCash έρχονται ήδη με εκπτώσεις από CartScreen
  const finalInst = totalInst;
  const finalCash = totalCash;

  // ── v1.0.94: Φόρτωση drafts κατά το mount + polling ────────────────
  const loadDrafts = useCallback(async () => {
    try {
      const r = await apiSchedDraftGet(token);
      if (r && r.ok && r.schedules) {
        setDrafts({
          interest: r.schedules.interest || null,
          interest_free: r.schedules.interest_free || null,
        });
      }
    } catch (e) { /* silent */ }
  }, [token]);

  useEffect(() => {
    loadDrafts();
    resetIdleTimer();
    // Polling κάθε 5s για sync με Inshop (αν αλλάξει εκεί)
    const pollId = setInterval(loadDrafts, 5000);

    // v1.0.102: AppState handler — pause timer όταν app πάει background
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        resetIdleTimer();
      } else {
        clearTimeout(idleTimer.current);
      }
    });

    return () => {
      clearInterval(pollId);
      clearTimeout(idleTimer.current);
      sub.remove();
    };
  }, [loadDrafts]);

  // v1.0.102: Όταν modal ανοίγει, pause idle timer (αλλιώς ο χρήστης που σκέφτεται μέσα στο modal θα κάνει logout)
  useEffect(() => {
    if (modalVisible) {
      clearTimeout(idleTimer.current);
    } else {
      // Όταν κλείνει το modal, ξανα-ξεκινάμε τον timer
      resetIdleTimer();
    }
  }, [modalVisible]);

  // Helpers για το rendering των banners
  function _formatBannerText(sched) {
    if (!sched) return '';
    const total = (sched.months_count || 0);
    const dp = sched.down_payment > 0 ? ` (προκαταβολή ${Math.round(sched.down_payment)}€)` : '';
    return `${total} δόσεις${dp}`;
  }

  const openModal = (mode) => {
    resetIdleTimer();
    setModalMode(mode);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    // Re-load drafts ώστε το banner να ενημερωθεί
    loadDrafts();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Σφάλμα', 'Το όνομα πελάτη είναι υποχρεωτικό');
      return;
    }
    resetIdleTimer();
    setSaving(true);
    try {
      const res = await apiSaveQuote({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim(),
        notes: notes.trim(),
        global_discount_pct: discPct,
        total_inst: parseFloat(finalInst.toFixed(2)),
        total_cash: parseFloat(finalCash.toFixed(2)),
      }, token);
      if (res.ok) {
        // v1.0.94: Μετά το save, attach τα drafts στο νέο quote
        if (drafts.interest || drafts.interest_free) {
          try {
            await apiSchedDraftAttach(res.quote_id, token);
          } catch (e) { /* not blocking — quote is saved either way */ }
        }
        Alert.alert(
          '✅ Προσφορά Αποθηκεύτηκε',
          `Αριθμός: ${res.quote_number}`,
          [{ text: 'OK', onPress: () => navigation.navigate('CustomerSelect', { token }) }]
        );
      } else {
        Alert.alert('Σφάλμα', res.error || 'Αποτυχία αποθήκευσης');
      }
    } catch (e) {
      Alert.alert('Σφάλμα', 'Αποτυχία σύνδεσης');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>← Πίσω</Text>
        </TouchableOpacity>
        <Text style={s.title}>Νέα Προσφορά</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.form} onTouchStart={resetIdleTimer}>

        {/* v1.0.94: Κουμπιά Δοσολογίου ΠΑΝΩ από τα σύνολα */}
        <View style={s.schedButtonsRow}>
          <TouchableOpacity style={[s.schedBtn, s.schedBtnInt]} onPress={() => openModal('interest')}>
            <Text style={s.schedBtnTxt}>💳 Δοσολόγιο</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.schedBtn, s.schedBtnFree]} onPress={() => openModal('interest_free')}>
            <Text style={s.schedBtnTxt}>💚 Άτοκο</Text>
          </TouchableOpacity>
        </View>

        {/* v1.0.94: Summary banners (όταν υπάρχουν drafts) */}
        {drafts.interest && (
          <View style={[s.banner, { backgroundColor: '#1e3a5f', borderColor: '#3b82f6' }]}>
            <Text style={s.bannerTxt}>💳 Δοσολόγιο: {_formatBannerText(drafts.interest)}</Text>
          </View>
        )}
        {drafts.interest_free && (
          <View style={[s.banner, { backgroundColor: '#0f3a2a', borderColor: '#10b981' }]}>
            <Text style={s.bannerTxt}>💚 Άτοκο Δοσολόγιο: {_formatBannerText(drafts.interest_free)}</Text>
          </View>
        )}

        {/* Σύνολα */}
        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Σύνολο Δόσεις:</Text>
            <Text style={s.totalInstVal}>{finalInst.toFixed(2)}€</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Σύνολο Μετρητά:</Text>
            <Text style={s.totalCashVal}>{finalCash.toFixed(2)}€</Text>
          </View>
        </View>

        {/* Στοιχεία πελάτη */}
        <Text style={s.sectionTitle}>
          ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ
          {selectedCustomerId && <Text style={s.matchedTag}>  ✓ από βάση</Text>}
        </Text>

        <Text style={s.label}>ΟΝΟΜΑ *</Text>
        <TextInput style={s.input} value={name} onChangeText={handleNameChange}
          placeholder="Ονοματεπώνυμο (ελάχ. 2 χαρακτήρες για αναζήτηση)" placeholderTextColor="#4a7fa5" />

        {/* Search results dropdown — όταν ψάχνεις στο όνομα */}
        {searchField === 'name' && searchResults.length > 0 && (
          <View style={s.suggestionBox}>
            <View style={s.suggestionHeader}>
              <Text style={s.suggestionHeaderText}>
                {searching ? 'Αναζήτηση...' : `${searchResults.length} αποτελέσματα`}
              </Text>
              <TouchableOpacity onPress={closeSearchResults}>
                <Text style={s.suggestionCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {searchResults.map((c) => (
              <TouchableOpacity key={c.id} style={s.suggestionItem} onPress={() => selectCustomer(c)}>
                <Text style={s.suggestionLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={s.label}>ΤΗΛΕΦΩΝΟ</Text>
        <TextInput style={s.input} value={phone} onChangeText={handlePhoneChange}
          placeholder="Τηλέφωνο" placeholderTextColor="#4a7fa5" keyboardType="phone-pad" />

        {/* Search results dropdown — όταν ψάχνεις στο τηλέφωνο */}
        {searchField === 'phone' && searchResults.length > 0 && (
          <View style={s.suggestionBox}>
            <View style={s.suggestionHeader}>
              <Text style={s.suggestionHeaderText}>
                {searching ? 'Αναζήτηση...' : `${searchResults.length} αποτελέσματα`}
              </Text>
              <TouchableOpacity onPress={closeSearchResults}>
                <Text style={s.suggestionCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {searchResults.map((c) => (
              <TouchableOpacity key={c.id} style={s.suggestionItem} onPress={() => selectCustomer(c)}>
                <Text style={s.suggestionLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={s.label}>ΔΙΕΥΘΥΝΣΗ</Text>
        <TextInput style={s.input} value={address} onChangeText={v => { resetIdleTimer(); setAddress(v); }}
          placeholder="Διεύθυνση" placeholderTextColor="#4a7fa5" />

        <Text style={s.label}>EMAIL</Text>
        <TextInput style={s.input} value={email} onChangeText={v => { resetIdleTimer(); setEmail(v); }}
          placeholder="Email" placeholderTextColor="#4a7fa5" keyboardType="email-address" autoCapitalize="none" />

        <Text style={s.label}>ΣΗΜΕΙΩΣΕΙΣ</Text>
        <TextInput style={[s.input, s.textarea]} value={notes} onChangeText={v => { resetIdleTimer(); setNotes(v); }}
          placeholder="Σημειώσεις..." placeholderTextColor="#4a7fa5" multiline numberOfLines={3} />

        <TouchableOpacity style={[s.saveBtn, saving && s.disabled]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveTxt}>{saving ? 'Αποθήκευση...' : '📋 Αποθήκευση Προσφοράς'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={s.cancelTxt}>Ακύρωση</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* v1.0.94: Payment schedule modal */}
      <PaymentScheduleModal
        visible={modalVisible}
        mode={modalMode}
        totalAmount={modalMode === 'interest_free' ? finalCash : finalInst}
        token={token}
        existingSched={drafts[modalMode] || null}
        onClose={closeModal}
        onSaved={() => closeModal()}
        onCleared={() => closeModal()}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2d5f8a' },
  backTxt: { color: '#2ab4ea', fontSize: 15 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  form: { padding: 20, paddingBottom: 40 },
  // v1.0.94: schedule buttons + banners
  schedButtonsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  schedBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  schedBtnInt: { backgroundColor: '#3b82f6' },
  schedBtnFree: { backgroundColor: '#10b981' },
  schedBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  banner: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1 },
  bannerTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  // existing styles
  totalsBox: { backgroundColor: '#16354f', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#2d5f8a' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { color: '#aac4e0', fontSize: 14 },
  discVal: { color: '#e74c3c', fontSize: 14, fontWeight: '700' },
  totalInstVal: { color: '#2ab4ea', fontSize: 18, fontWeight: '800' },
  totalCashVal: { color: '#27ae60', fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: '#2ab4ea', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4, letterSpacing: 1 },
  label: { color: '#aac4e0', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#3a70a0' },
  textarea: { height: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  disabled: { opacity: 0.6 },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelTxt: { color: '#aac4e0', fontSize: 14 },
  // v1.0.99: customer search dropdown
  matchedTag: { color: '#10b981', fontSize: 11, fontWeight: '700' },
  suggestionBox: { backgroundColor: '#16354f', borderRadius: 8, marginTop: 4, borderWidth: 1, borderColor: '#3b82f6', maxHeight: 240 },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#2d5f8a' },
  suggestionHeaderText: { color: '#7c93b1', fontSize: 11, fontWeight: '600' },
  suggestionCloseBtn: { color: '#aac4e0', fontSize: 14, fontWeight: '700', paddingHorizontal: 6 },
  suggestionItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#1e3a5f' },
  suggestionLabel: { color: '#fff', fontSize: 13 },
});
