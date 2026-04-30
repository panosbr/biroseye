import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import NavBar from '../components/NavBar';

const MANUAL = `## 1. Εισαγωγή
Η εφαρμογή **BirosEye** επιτρέπει στους πωλητές να σκανάρουν QR labels από τα εκθέματα και να προσθέτουν είδη στο καλάθι. Το καλάθι συγχρονίζεται αυτόματα με το Inshop tablet σε πραγματικό χρόνο.

## 2. Σύνδεση με PIN
Κάθε πωλητής έχει **4ψήφιο PIN** που ορίζεται από τον admin στο ERP (ADMINISTRATION → Users → BirosEye PIN).
1. Πληκτρολόγησε το 4ψήφιο PIN σου
2. Η σύνδεση γίνεται αυτόματα

## 3. Μόνιμη Μπάρα (πάνω)
Εμφανίζεται σε **όλες** τις οθόνες:
- **🏠 Αρχή** — Επιστροφή στην αρχική
- **🛒 Καλάθι** — Άνοιγμα καλαθιού (badge με αριθμό ειδών)
- **🧹 Εκκαθ.** — Άδειασμα καλαθιού
- **📋 Προσφορές** — Λίστα αποθηκευμένων προσφορών
- **❓ Βοήθεια** — Αυτή η σελίδα
- **🚪 Έξοδος** — Αποσύνδεση και επιστροφή στο PIN

## 4. Σκάναρισμα QR
Μετά τη σύνδεση ανοίγει η κάμερα. Στρέψε στο QR αυτοκόλλητο — αναγνωρίζεται αυτόματα και ανοίγει η σελίδα του είδους.
**Σημείωση:** Λειτουργούν μόνο τα QR αυτοκόλλητα ΜΠΥΡΟΣ (Herma 4270).

## 5. Σελίδα Είδους
Εμφανίζει φωτογραφία, όνομα, τιμές δόσεων/μετρητών, παραλλαγές και υπολογιστή δόσης.
**2η μπάρα (κάτω από μόνιμη):**
- **📷 Σκαν** — Νέο σκάναρισμα
- **➕ Νέο Είδος** — Χειροκίνητη προσθήκη

## 6. Παραλλαγές (Sub-items)
Αν το είδος έχει παραλλαγές (χρώματα, υλικά) εμφανίζονται ως κουμπιά. Κάθε παραλλαγή έχει φωτογραφία και επιπλέον τιμή. Αποθηκεύεται ως ξεχωριστή γραμμή στο καλάθι.

## 7. Καλάθι
**2η μπάρα (κάτω από μόνιμη):**
- **📄 Προσφορά** — Δημιουργία νέας προσφοράς
- **🧮 Δόσεις** — Υπολογιστής μηνιαίας δόσης
- **📷 Σκαν** — Νέο σκάναρισμα
- **➕ Νέο Είδος** — Χειροκίνητη προσθήκη

**Εκπτώσεις ανά είδος:**
Κάτω από κάθε είδος υπάρχει γραμμή έκπτωσης με − / + και ✓. Πάτα − ή + για να αλλάξεις ποσοστό χωρίς πληκτρολόγιο, ή πάτα στον αριθμό για να πληκτρολογήσεις. Πάτα ✓ για εφαρμογή.

**Γενική Έκπτωση:**
Εφαρμόζεται πάνω στο υποσύνολο μετά τις ανά-είδος εκπτώσεις. Συγχρονίζεται αυτόματα με το Inshop.

## 8. Προσφορές
Πάτα **📋 Προσφορές** στη μόνιμη μπάρα. Για κάθε προσφορά:
- **👁️ Εμφάνιση** — Προβολή ως PDF
- **🖨️ Εκτύπωση** — Άμεση εκτύπωση
- **📄 PDF** — Αποθήκευση/κοινοποίηση PDF
- **✉️ Email** — Αποστολή με email
- **📦 Παραγγελία** — Μεταφορά σε παραγγελία
- **✕ Διαγραφή** — Διαγραφή προσφοράς

## 9. Αυτόματο Κλείσιμο
Μετά από **5 λεπτά αδράνειας** η εφαρμογή αποσυνδέεται αυτόματα, επιστρέφει στο PIN και πηγαίνει στην αρχική οθόνη του κινητού.
`;

function renderManual(text) {
  const lines = text.split('\n');
  const elements = [];
  lines.forEach((line, idx) => {
    if (!line.trim()) { elements.push(<View key={idx} style={{ height: 6 }} />); return; }
    if (line.startsWith('## ')) {
      elements.push(<Text key={idx} style={s.h2}>{line.replace('## ', '')}</Text>);
      return;
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<Text key={idx} style={s.bold}>{line.replace(/\*\*/g, '')}</Text>);
      return;
    }
    if (line.startsWith('- ')) {
      const txt = line.replace('- ', '').replace(/\*\*([^*]+)\*\*/g, '$1');
      elements.push(<Text key={idx} style={s.bullet}>{'• ' + txt}</Text>);
      return;
    }
    if (/^\d+\./.test(line)) {
      elements.push(<Text key={idx} style={s.bullet}>{line}</Text>);
      return;
    }
    const txt = line.replace(/\*\*([^*]+)\*\*/g, '$1');
    elements.push(<Text key={idx} style={s.para}>{txt}</Text>);
  });
  return elements;
}

export default function HelpScreen({ navigation, route }) {
  const token = route?.params?.token;
  return (
    <SafeAreaView style={s.container}>
      <NavBar navigation={navigation} token={token} onCartUpdate={() => {}} />
      <View style={s.header}>
        <Text style={s.title}>Οδηγίες BirosEye</Text>
        <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={s.closeTxt}>✕ Πίσω</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.version}>BirosEye — Απρίλιος 2026 — ΜΠΥΡΟΣ Έπιπλα, Θεσσαλονίκη</Text>
        {renderManual(MANUAL)}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d5f8a' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2d5f8a', borderRadius: 8 },
  closeTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  version: { color: '#4a7fa5', fontSize: 11, marginBottom: 16, textAlign: 'center' },
  h2: { color: '#2ab4ea', fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 14, borderBottomWidth: 1, borderBottomColor: '#2d5f8a', paddingBottom: 4 },
  bold: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  para: { color: '#ccd9e8', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  bullet: { color: '#ccd9e8', fontSize: 13, lineHeight: 20, marginBottom: 3, paddingLeft: 8 },
});
