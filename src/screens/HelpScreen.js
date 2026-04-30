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
- **🧮 Δόσεις** — Υπολογιστής μηνιαίας δόσης (Δοσολόγιο)
- **📷 Σκαν** — Νέο σκάναρισμα
- **➕ Νέο Είδος** — Χειροκίνητη προσθήκη

**Εκπτώσεις ανά είδος:**
Κάτω από κάθε είδος υπάρχει γραμμή έκπτωσης με − / + και ✓. Πάτα − ή + για να αλλάξεις ποσοστό χωρίς πληκτρολόγιο, ή πάτα στον αριθμό για να πληκτρολογήσεις. Πάτα ✓ για εφαρμογή.

**Γενική Έκπτωση:**
Εφαρμόζεται πάνω στο υποσύνολο μετά τις ανά-είδος εκπτώσεις. Συγχρονίζεται αυτόματα με το Inshop.

## 8. Δοσολόγιο (v1.0.94+)
Από το Καλάθι, πάτα **🧮 Δόσεις** για το Πρόγραμμα Πληρωμής.

**Επιλογές:**
- **Έντοκο** (default 12 μήνες) — με τόκο πάνω από 15 μήνες
- **Άτοκο** (default 3 μήνες) — μέχρι 15 μήνες χωρίς τόκο

**Πεδία:**
- **Σύνολο** — αυτόματα από το καλάθι
- **Προκαταβολή** — χειροκίνητη εισαγωγή €
- **Μήνες** — stepper ▲▼ ή χειροκίνητα (1-120)
- **Έναρξη** — DD/MM/YYYY με 📅 picker
- **Festive Months** — Χριστούγεννα / Πάσχα / Καλοκαίρι

**Κλείδωμα Δόσεων:**
- **Tap** σε δόση → κλειδώνει στο τρέχον ποσό
- **Long-press** → χειροκίνητη επεξεργασία
- Οι μη-κλειδωμένες δόσεις απορροφούν τη διαφορά

**Έξτρα Τόκος (>15 μήνες):**
Όταν ξεπεράσεις τους 15 μήνες, εμφανίζεται αυτόματα το panel "💰 ΕΞΤΡΑ ΤΟΚΟΣ" με:
- Υπολογισμένο ποσό τόκου
- Κουμπιά επιλογής επιπλέον μηνών: [Χωρίς] [+1 ⭐] [+2] [+3]
- Το ⭐ δείχνει το προτεινόμενο
- Manual override για ποσό τόκου
- ↻ Επαναφορά στην αυτόματη πρόταση

## 9. Προσφορές
Πάτα **📋 Προσφορές** στη μόνιμη μπάρα. Για κάθε προσφορά:
- **👁️ Εμφάνιση** — Προβολή ως PDF
- **🖨️ Εκτύπωση** — Άμεση εκτύπωση
- **📄 PDF** — Αποθήκευση/κοινοποίηση PDF
- **✉️ Email** — Αποστολή με email
- **📦 Παραγγελία** — Μεταφορά σε παραγγελία
- **✕ Διαγραφή** — Διαγραφή προσφοράς

## 10. Δημιουργία Προσφοράς (v1.0.99+)
Στο Καλάθι, πάτα **📄 Προσφορά**. Στη φόρμα:

**Customer Search/Autofill:**
- Πληκτρολόγησε **2+ χαρακτήρες** σε Όνομα ή Τηλέφωνο
- Εμφανίζεται **dropdown με προτάσεις** πελατών από τη βάση
- **Tap σε πρόταση** → autofill όλων (όνομα, τηλέφωνο, διεύθυνση, email)
- **✓ από βάση** εμφανίζεται όταν επιλέξεις υπάρχοντα πελάτη
- Αν αλλάξεις χειροκίνητα κάτι → ξεκλειδώνει η σύνδεση

## 11. Αυτόματο Κλείσιμο (Idle Timeout)
Μετά από **5 λεπτά αδράνειας** η εφαρμογή αποσυνδέεται αυτόματα.

**Έξυπνη συμπεριφορά (v1.0.102+):**
- **Modal Δοσολογίου ανοιχτό** → timer **παγώνει** (μπορείς να σκέφτεσαι)
- **App σε background** → timer **παγώνει** (δεν μετράει εκτός app)
- **Επιστρέφεις στην app** → timer **ξανα-ξεκινά** από την αρχή
- **Κανονική αλληλεπίδραση** → timer reset σε κάθε tap

## 12. Συγχρονισμός με Inshop
Όλες οι αλλαγές (καλάθι, εκπτώσεις, δοσολόγιο, προσφορές) είναι **κοινές** με το Inshop tablet:
- Προσθήκη στο BirosEye → εμφανίζεται στο Inshop μέσα σε δευτερόλεπτα
- Διαγραφή στο Inshop → ενημερώνεται στο BirosEye αμέσως
- Έκπτωση από οπουδήποτε → συγχρονίζεται και στις 2 πλατφόρμες

## 13. Αντιμετώπιση Προβλημάτων

**"PIN λάθος" επανειλημμένα:**
- ⏳ Περίμενε 1-2 sec μεταξύ προσπαθειών
- 📞 Επικοινώνησε με admin για επαναφορά PIN
- ⚠️ Πολλά συνεχόμενα λάθη → audit log

**Καλάθι δεν συγχρονίζεται:**
- 🌐 Έλεγξε internet (WiFi ή 4G)
- 🔄 Πάτα 🛒 Καλάθι για manual refresh
- 🆔 Σιγουρέψου ότι είσαι ίδιος user σε BirosEye και Inshop

**App κλείνει χωρίς λόγο:**
- ⏱ Είναι το 5-λεπτο idle timeout (by design)
- 🔋 Έλεγξε αν η μπαταρία είναι σε εξοικονόμηση ενέργειας

**Date picker κλείνει γρήγορα:**
- ✅ Διορθώθηκε στην v1.0.102+ — πρέπει να μένει ανοιχτό όσο σκέφτεσαι

## 14. Ενημερώσεις
Όταν βγαίνει νέα έκδοση, εμφανίζεται στην οθόνη PIN. Πρέπει να εγκαταστήσεις το νέο APK χειροκίνητα.

*Τελευταία ενημέρωση: Απρίλιος 2026 — App v1.0.102+*
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
        <Text style={s.version}>BirosEye v1.0.102 — Απρίλιος 2026 — ΜΠΥΡΟΣ Έπιπλα, Θεσσαλονίκη</Text>
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
