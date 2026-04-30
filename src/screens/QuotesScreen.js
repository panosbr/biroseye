import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, SafeAreaView, Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetQuotes, apiDeleteQuote, apiQuoteToOrder, apiQuoteEmail, fetchQuoteHtml } from '../api/client';
import * as Print from 'expo-print';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import NavBar from '../components/NavBar';
import { WebView } from 'react-native-webview';

export default function QuotesScreen({ navigation, route }) {
  const { token } = route.params;
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [emailModal, setEmailModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [viewHtml, setViewHtml] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailTarget, setEmailTarget] = useState(null);

  // Φορτώνει ξανά κάθε φορά που η οθόνη παίρνει focus
  // (π.χ. όταν γυρίσει από CreateQuote μετά από νέα προσφορά)
  useFocusEffect(useCallback(() => { loadQuotes(); }, []));

  const loadQuotes = async (q = search) => {
    setLoading(true);
    try {
      const data = await apiGetQuotes({ q }, token);
      setQuotes(data.quotes || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleDelete = (q) => {
    Alert.alert('Διαγραφή', `Να διαγραφεί η ${q.quote_number};`, [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
        await apiDeleteQuote(q.id, token);
        setSelected(null);
        loadQuotes();
      }},
    ]);
  };

  const handleToOrder = (q) => {
    Alert.alert('Παραγγελία', `Μεταφορά ${q.quote_number} σε παραγγελία;`, [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Μεταφορά', onPress: async () => {
        const res = await apiQuoteToOrder(q.id, token).catch(()=>null);
        if (res?.ok) { Alert.alert('✅', `Παραγγελία: ${res.order_number}`); loadQuotes(); }
        else Alert.alert('Σφάλμα', res?.error || 'Αποτυχία');
      }},
    ]);
  };

  const handleView = async (q) => {
    try {
      const html = await fetchQuoteHtml(q.id, token);
      if (!html) { Alert.alert('Σφάλμα', 'Δεν φορτώθηκε'); return; }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const dest = FileSystem.cacheDirectory + `view_${q.quote_number}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      // Άνοιγμα PDF viewer απευθείας
      const contentUri = await FileSystem.getContentUriAsync(dest);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
    } catch (e) {
      Alert.alert('Σφάλμα', e.message || 'Αποτυχία προβολής');
    }
  };

  const handlePdf = async (q) => {
    try {
      const html = await fetchQuoteHtml(q.id, token);
      if (!html) { Alert.alert('Σφάλμα', 'Δεν φορτώθηκε η προσφορά'); return; }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const fname = `quote_${q.quote_number}.pdf`;
      const dest = FileSystem.cacheDirectory + fname;
      await FileSystem.copyAsync({ from: uri, to: dest });
      // Share sheet — ο χρήστης επιλέγει "Αποθήκευση" ή άλλη εφαρμογή
      await Sharing.shareAsync(dest, {
        mimeType: 'application/pdf',
        dialogTitle: `Αποθήκευση ${fname}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Σφάλμα', e.message || 'Αποτυχία PDF');
    }
  };

  const handlePrint = async (q) => {
    try {
      const html = await fetchQuoteHtml(q.id, token);
      if (!html) { Alert.alert('Σφάλμα', 'Δεν φορτώθηκε η προσφορά'); return; }
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Σφάλμα', e.message || 'Αποτυχία εκτύπωσης');
    }
  };

  const handleEmailTap = (q) => {
    setEmailTarget(q);
    setEmailInput(q.customer_email || '');
    setEmailModal(true);
  };

  const handleEmailSend = async () => {
    if (!emailInput.trim()) { Alert.alert('Σφάλμα', 'Συμπλήρωσε email'); return; }
    setEmailModal(false);
    const res = await apiQuoteEmail(emailTarget.id, emailInput.trim(), token).catch(()=>null);
    if (res?.ok) Alert.alert('✅', 'Email εστάλη');
    else Alert.alert('Σφάλμα', res?.error || 'Αποτυχία');
  };

  const statusColor = (s) => ({ draft: '#2ab4ea', converted: '#27ae60', cancelled: '#e74c3c' }[s] || '#aac4e0');
  const statusLabel = (s) => ({ draft: 'Πρόχειρο', converted: 'Παραγγελία', cancelled: 'Ακυρωμένο' }[s] || s);

  return (
    <SafeAreaView style={s.container}>
      <NavBar navigation={navigation} token={token} onCartUpdate={() => {}} activeScreen="Quotes" />

      <View style={s.searchBar}>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={v => { setSearch(v); loadQuotes(v); }}
          placeholder="Αναζήτηση προσφορών..."
          placeholderTextColor="#4a7fa5"
        />
      </View>

      {loading
        ? <ActivityIndicator color="#2ab4ea" style={{ marginTop: 30 }} />
        : quotes.length === 0
          ? <Text style={s.empty}>Δεν βρέθηκαν προσφορές</Text>
          : <FlatList
              data={quotes}
              keyExtractor={q => String(q.id)}
              contentContainerStyle={{ padding: 10 }}
              renderItem={({ item: q }) => (
                <View style={[s.card, selected?.id === q.id && s.cardSel]}>
                  <TouchableOpacity onPress={() => setSelected(selected?.id === q.id ? null : q)} style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={s.cardRow}>
                        <Text style={s.qnum}>{q.quote_number}</Text>
                        <Text style={[s.qstat, { color: statusColor(q.status) }]}>{statusLabel(q.status)}</Text>
                      </View>
                      <Text style={s.qname}>{q.customer_name || '—'}{q.customer_phone ? ` · ${q.customer_phone}` : ''}</Text>
                      <Text style={s.qamt}>{parseFloat(q.total_inst||0).toFixed(2)}€ δόσ. / {parseFloat(q.total_cash||0).toFixed(2)}€ μετρ.</Text>
                    </View>
                    <Text style={s.arrow}>{selected?.id === q.id ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {selected?.id === q.id && (
                    <View style={s.actBar}>
                      <TouchableOpacity style={s.actBtn} onPress={() => handlePrint(q)}>
                        <Text style={s.actIcon}>🖨️</Text>
                        <Text style={s.actTxt}>Εκτύπωση</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actBtn} onPress={() => handlePdf(q)}>
                        <Text style={s.actIcon}>📄</Text>
                        <Text style={s.actTxt}>PDF</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actBtn} onPress={() => handleEmailTap(q)}>
                        <Text style={s.actIcon}>✉️</Text>
                        <Text style={s.actTxt}>Email</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actBtn} onPress={() => handleView(q)}>
                        <Text style={s.actIcon}>👁️</Text>
                        <Text style={s.actTxt}>Εμφάνιση</Text>
                      </TouchableOpacity>
                      {q.status === 'draft' && (
                        <TouchableOpacity style={s.actBtn} onPress={() => handleToOrder(q)}>
                          <Text style={s.actIcon}>📦</Text>
                          <Text style={s.actTxt}>Παραγγελία</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={s.actBtn} onPress={() => handleDelete(q)}>
                        <Text style={[s.actIcon, { color: '#ef4444' }]}>✕</Text>
                        <Text style={[s.actTxt, { color: '#ef4444' }]}>Διαγραφή</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
      }

      {/* WebView Modal για Εμφάνιση Προσφοράς */}
      <Modal visible={viewModal} animationType="slide" onRequestClose={() => setViewModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#1e3a5f' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#2d5f8a' }}>
            <TouchableOpacity onPress={() => setViewModal(false)} style={{ padding: 8, marginRight: 12 }}>
              <Text style={{ color: '#2ab4ea', fontSize: 16 }}>✕ Κλείσιμο</Text>
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Προσφορά</Text>
          </View>
          <WebView source={{ html: viewHtml }} style={{ flex: 1 }} />
        </SafeAreaView>
      </Modal>

      <Modal visible={emailModal} transparent animationType="fade" onRequestClose={() => setEmailModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Αποστολή Email</Text>
            <Text style={s.modalSub}>{emailTarget?.quote_number}</Text>
            <TextInput style={s.modalInput} value={emailInput} onChangeText={setEmailInput}
              placeholder="Email παραλήπτη" placeholderTextColor="#4a7fa5"
              keyboardType="email-address" autoCapitalize="none" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#059669', flex: 1 }]} onPress={handleEmailSend}>
                <Text style={s.modalBtnTxt}>Αποστολή</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#374151', flex: 1 }]} onPress={() => setEmailModal(false)}>
                <Text style={s.modalBtnTxt}>Ακύρωση</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  searchBar: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#2d5f8a' },
  search: { backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 8, padding: 9, fontSize: 14, borderWidth: 1, borderColor: '#3a70a0' },
  empty: { color: '#aac4e0', textAlign: 'center', marginTop: 30, fontSize: 14 },
  card: { backgroundColor: '#16354f', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#2d5f8a', overflow: 'hidden' },
  cardSel: { borderColor: '#2ab4ea' },
  cardHeader: { padding: 10, flexDirection: 'row', alignItems: 'center' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qnum: { color: '#fff', fontSize: 13, fontWeight: '700' },
  qstat: { fontSize: 11, fontWeight: '600' },
  qname: { color: '#aac4e0', fontSize: 12, marginTop: 3 },
  qamt: { color: '#2ab4ea', fontSize: 11, marginTop: 2 },
  arrow: { color: '#aac4e0', fontSize: 16, marginLeft: 8 },
  actBar: { flexDirection: 'row', backgroundColor: '#12293f', borderTopWidth: 1, borderTopColor: '#2d5f8a' },
  actBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: 1, borderRightColor: '#2d5f8a' },
  actIcon: { fontSize: 16, color: '#fff' },
  actTxt: { color: '#aac4e0', fontSize: 8, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1a3d5c', borderRadius: 14, padding: 20, width: '85%', borderWidth: 1, borderColor: '#2d5f8a' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#aac4e0', fontSize: 12, marginBottom: 14 },
  modalInput: { backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 8, padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#3a70a0', marginBottom: 14 },
  modalBtn: { padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
