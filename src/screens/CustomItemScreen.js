import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, SafeAreaView, Image, BackHandler
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiAddCustomItem } from '../api/client';
import { hardExit } from '../utils/exitApp';

const IDLE_TIMEOUT = 5 * 60 * 1000;

export default function CustomItemScreen({ navigation, route }) {
  const { token } = route.params;
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priceInst, setPriceInst] = useState('');
  const [priceCash, setPriceCash] = useState('');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const idleTimer = useRef(null);

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => { navigation.reset({ index: 0, routes: [{ name: 'Pin' }] }); setTimeout(() => { hardExit(); }, 300); }, IDLE_TIMEOUT);
  };

  const takePhoto = async () => {
    resetIdleTimer();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Άδεια κάμερας', 'Απαιτείται πρόσβαση στην κάμερα');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto('data:image/jpeg;base64,' + result.assets[0].base64);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Σφάλμα', 'Το όνομα είδους είναι υποχρεωτικό');
      return;
    }
    resetIdleTimer();
    setSaving(true);
    try {
      const res = await apiAddCustomItem({
        name: name.trim(),
        description: desc.trim(),
        price_inst: parseFloat(priceInst) || 0,
        price_cash: parseFloat(priceCash) || 0,
        photo: photo || null,
      }, token);
      if (res.ok) {
        navigation.navigate('Cart', { token });
      } else {
        Alert.alert('Σφάλμα', res.error || 'Δεν αποθηκεύτηκε');
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>← Πίσω</Text>
        </TouchableOpacity>
        <Text style={s.title}>Νέο Είδος</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.form} onTouchStart={resetIdleTimer}>

        <Text style={s.label}>ΦΩΤΟΓΡΑΦΙΑ</Text>
        <TouchableOpacity style={s.photoBox} onPress={takePhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={s.photoImg} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Text style={s.photoIcon}>📷</Text>
              <Text style={s.photoHint}>Πατήστε για φωτογραφία</Text>
            </View>
          )}
        </TouchableOpacity>
        {photo && (
          <TouchableOpacity onPress={() => setPhoto(null)} style={s.removePhoto}>
            <Text style={s.removePhotoTxt}>✕ Αφαίρεση φωτογραφίας</Text>
          </TouchableOpacity>
        )}

        <Text style={s.label}>ΟΝΟΜΑ ΕΙΔΟΥΣ *</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={v => { resetIdleTimer(); setName(v); }}
          placeholder="π.χ. Τραπέζι Καφέ Roma"
          placeholderTextColor="#4a7fa5"
        />

        <Text style={s.label}>ΠΕΡΙΓΡΑΦΗ</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={desc}
          onChangeText={v => { resetIdleTimer(); setDesc(v); }}
          placeholder="Διαστάσεις, χρώμα, υλικό..."
          placeholderTextColor="#4a7fa5"
          multiline
          numberOfLines={3}
        />

        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>ΤΙΜΗ ΔΟΣΕΩΝ (€)</Text>
            <TextInput
              style={s.input}
              value={priceInst}
              onChangeText={v => { resetIdleTimer(); setPriceInst(v); }}
              placeholder="0.00"
              placeholderTextColor="#4a7fa5"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={s.half}>
            <Text style={s.label}>ΤΙΜΗ ΜΕΤΡΗΤΟΙΣ (€)</Text>
            <TextInput
              style={s.input}
              value={priceCash}
              onChangeText={v => { resetIdleTimer(); setPriceCash(v); }}
              placeholder="0.00"
              placeholderTextColor="#4a7fa5"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={s.saveTxt}>{saving ? 'Αποθήκευση...' : '✅ Προσθήκη στο Καλάθι'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={s.cancelTxt}>Ακύρωση</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2d5f8a' },
  backBtn: { padding: 4 },
  backTxt: { color: '#2ab4ea', fontSize: 15 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  form: { padding: 20, paddingBottom: 40 },
  label: { color: '#aac4e0', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#3a70a0' },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  photoBox: { width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#3a70a0', backgroundColor: '#2d5f8a' },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoIcon: { fontSize: 40, marginBottom: 8 },
  photoHint: { color: '#aac4e0', fontSize: 13 },
  removePhoto: { marginTop: 6, alignItems: 'center' },
  removePhotoTxt: { color: '#e74c3c', fontSize: 12 },
  saveBtn: { backgroundColor: '#27ae60', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelTxt: { color: '#aac4e0', fontSize: 14 },
});
