// ─────────────────────────────────────────────────────────────────────────
// PaymentScheduleModal.js (v1.0.98)
// Full-featured modal για δοσολόγιο (έντοκο/άτοκο)
//
// v1.0.98 — Stage 2B Complete:
//   ✅ Stepper για μήνες με βελάκια ▲▼
//   ✅ Date pickers (DD/MM/YYYY)
//   ✅ Festive months panel (Χριστούγεννα/Πάσχα/Καλοκαίρι)
//   ✅ Locking installments (tap σε δόση)
//   ✅ Extra interest panel (>15 μήνες)
//   ✅ Manual amount edit για locked δόσεις
// ─────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  apiSchedCalculate, apiSchedDefaultStart, apiSchedDraftSave,
  apiSchedDraftDelete, apiSchedExtraInterest, apiSchedInterestSettings,
  apiSchedFestiveCheck,
} from '../api/client';

const FREE_MIN = 2;
const FREE_MAX = 5;
const INT_MIN = 1;
const INT_MAX = 60;
const INTEREST_THRESHOLD = 15; // πάνω από 15 μήνες προτείνεται extra interest

// ─── Date helpers ─────────────────────────────────────────────────
function _isoToDmy(iso) {
  if (!iso || iso.length < 10) return '';
  return `${iso.substring(8,10)}/${iso.substring(5,7)}/${iso.substring(0,4)}`;
}
function _isoToDate(iso) {
  if (!iso || iso.length < 10) return new Date();
  return new Date(parseInt(iso.substring(0,4)), parseInt(iso.substring(5,7))-1, parseInt(iso.substring(8,10)));
}
function _dateToIso(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function PaymentScheduleModal({
  visible, mode, totalAmount, token, existingSched,
  onClose, onSaved, onCleared,
}) {
  const isFree = mode === 'interest_free';
  const title = isFree ? '💚 Άτοκο Δοσολόγιο' : '💳 Δοσολόγιο';
  const themeColor = isFree ? '#10b981' : '#3b82f6';

  // Form state
  const [months, setMonths] = useState(isFree ? '3' : '12');
  const [startDate, setStartDate] = useState('');
  const [downPayment, setDownPayment] = useState('0');
  const [downDate, setDownDate] = useState('');

  // Date picker visibility
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showDownPicker, setShowDownPicker] = useState(false);

  // ── Festive (έντοκο μόνο) ──
  const [xmasExtra, setXmasExtra] = useState('0');
  const [easterExtra, setEasterExtra] = useState('0');
  const [summerExtra, setSummerExtra] = useState('0');
  const [festiveAvailable, setFestiveAvailable] = useState({ xmas: false, easter: false, summer: false });

  // ── Locked installments ──
  // {month_number: amount}
  const [lockedAmounts, setLockedAmounts] = useState({});
  // editing μία κλειδωμένη δόση
  const [editingLockMonth, setEditingLockMonth] = useState(null);
  const [editingLockValue, setEditingLockValue] = useState('');

  // ── Extra interest (έντοκο > 15 μήνες) ──
  // v1.0.101: Mirror Inshop logic
  // - Όταν εμφανιστεί το panel, auto-apply suggested_added_months + interest_amount
  // - Δείχνει dropdown με options (π.χ. +1, +2, +3) για να αλλάξει ο χρήστης
  // - Manual amount override
  const [extraInterestAmount, setExtraInterestAmount] = useState('0');
  const [extraInterestMonths, setExtraInterestMonths] = useState('0');
  const [extraInfo, setExtraInfo] = useState(null);  // {applies, interest_amount, suggested_added_months, options[]}
  const [manualOverride, setManualOverride] = useState(false);  // true = ο χρήστης άλλαξε χειροκίνητα
  const [interestSettings, setInterestSettings] = useState(null);

  // Calculated installments preview
  const [installments, setInstallments] = useState([]);
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [calcError, setCalcError] = useState('');

  const [saving, setSaving] = useState(false);

  // ── Init defaults / from existing ──────────────────────────────
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    async function init() {
      // Load interest settings (για να ξέρουμε threshold)
      try {
        const r = await apiSchedInterestSettings(token);
        if (!cancelled && r && r.ok) setInterestSettings(r);
      } catch (e) {}

      if (existingSched) {
        const baseMonths = (existingSched.months_count || 0) - (existingSched.extra_interest_added_months || 0);
        if (!cancelled) {
          setMonths(String(Math.max(baseMonths, 1)));
          setStartDate(existingSched.start_date || '');
          setDownPayment(String(existingSched.down_payment || 0));
          setDownDate(existingSched.down_payment_date || '');
          setXmasExtra(String(existingSched.xmas_extra || 0));
          setEasterExtra(String(existingSched.easter_extra || 0));
          setSummerExtra(String(existingSched.summer_extra || 0));
          setExtraInterestAmount(String(existingSched.extra_interest_amount || 0));
          setExtraInterestMonths(String(existingSched.extra_interest_added_months || 0));
          // Locked amounts: parse JSON
          let locked = {};
          try {
            if (existingSched.locked_amounts) {
              locked = typeof existingSched.locked_amounts === 'string'
                ? JSON.parse(existingSched.locked_amounts)
                : existingSched.locked_amounts;
            }
          } catch (e) {}
          setLockedAmounts(locked);
        }
      } else {
        try {
          const r = await apiSchedDefaultStart(token);
          if (!cancelled && r && r.ok) {
            setStartDate(r.date);
          }
        } catch (e) {
          const d = new Date(); d.setDate(d.getDate() + 30);
          if (!cancelled) {
            setStartDate(_dateToIso(d));
          }
        }
        if (!cancelled) {
          setMonths(isFree ? '3' : '12');
          setDownPayment('0');
          setDownDate('');
          setXmasExtra('0');
          setEasterExtra('0');
          setSummerExtra('0');
          setExtraInterestAmount('0');
          setExtraInterestMonths('0');
          setLockedAmounts({});
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [visible, mode]);

  // ── Festive availability έρχεται από το apiSchedCalculate (αφαιρέθηκε το extra call για ταχύτητα v1.0.99)

  // ── Live calculation ──────────────────────────────────────────
  const recalc = useCallback(async () => {
    if (!visible || !startDate) return;
    const m = parseInt(months) || 0;
    if (m < 1) { setInstallments([]); setCalcError(''); return; }
    if (isFree && (m < FREE_MIN || m > FREE_MAX)) {
      setInstallments([]);
      setCalcError(`Το άτοκο δοσολόγιο επιτρέπει ${FREE_MIN}-${FREE_MAX} μήνες.`);
      return;
    }
    const dp = parseFloat(downPayment) || 0;
    if (dp < 0) { setCalcError('Η προκαταβολή δεν μπορεί να είναι αρνητική.'); return; }
    if (dp >= totalAmount) { setCalcError('Η προκαταβολή πρέπει να είναι μικρότερη από το σύνολο.'); return; }

    setLoadingCalc(true);
    setCalcError('');
    try {
      const params = {
        schedule_type: mode,
        total_amount: totalAmount,
        down_payment: dp,
        down_payment_date: dp > 0 ? (downDate || startDate) : null,
        months_count: m,
        start_date: startDate,
        xmas_extra: parseFloat(xmasExtra) || 0,
        easter_extra: parseFloat(easterExtra) || 0,
        summer_extra: parseFloat(summerExtra) || 0,
        locked_amounts: lockedAmounts,
        extra_interest_amount: parseFloat(extraInterestAmount) || 0,
        extra_interest_added_months: parseInt(extraInterestMonths) || 0,
      };
      const r = await apiSchedCalculate(params, token);
      if (r && r.ok) {
        setInstallments(r.installments || []);
        setCalcError('');
        if (r.festive_available) setFestiveAvailable(r.festive_available);
      } else {
        setInstallments([]);
        setCalcError((r && r.error) || 'Αποτυχία υπολογισμού');
      }
    } catch (e) {
      setInstallments([]);
      setCalcError('Σφάλμα δικτύου: ' + (e.message || String(e)));
    } finally {
      setLoadingCalc(false);
    }
  }, [visible, mode, totalAmount, months, startDate, downPayment, downDate, token, isFree, xmasExtra, easterExtra, summerExtra, lockedAmounts, extraInterestAmount, extraInterestMonths]);

  useEffect(() => {
    if (!visible) return;
    // Skip recalc while date pickers are open
    if (showStartPicker || showDownPicker) return;
    // v1.0.99: μεγαλύτερο debounce 600ms για λιγότερα recalc calls
    const t = setTimeout(recalc, 600);
    return () => clearTimeout(t);
  }, [recalc, visible, showStartPicker, showDownPicker]);

  // ── Extra interest (>15 μήνες) — v1.0.101 mirrors Inshop ─────
  useEffect(() => {
    if (!visible || isFree || !startDate) return;
    if (showStartPicker || showDownPicker) return;
    const m = parseInt(months) || 0;
    if (m <= INTEREST_THRESHOLD) {
      setExtraInfo(null);
      // Reset extra interest όταν κατεβάσουμε κάτω από threshold
      setExtraInterestAmount('0');
      setExtraInterestMonths('0');
      setManualOverride(false);
      return;
    }
    const dp = parseFloat(downPayment) || 0;
    const baseForCalc = totalAmount - dp;
    if (baseForCalc <= 0) {
      setExtraInfo(null);
      return;
    }
    let cancelled = false;
    apiSchedExtraInterest({
      base_amount: baseForCalc,
      months_count: m,
    }, token)
      .then(r => {
        if (cancelled) return;
        if (r && r.ok && r.applies) {
          setExtraInfo(r);
          if (r.interest_settings) setInterestSettings(r.interest_settings);
          // Auto-apply suggested όταν ο χρήστης δεν έχει κάνει manual override
          if (!manualOverride) {
            setExtraInterestAmount(String((r.interest_amount || 0).toFixed(2)));
            setExtraInterestMonths(String(r.suggested_added_months || 0));
          }
        } else {
          setExtraInfo(null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible, isFree, totalAmount, months, downPayment, token, showStartPicker, showDownPicker]);

  // Όταν ο χρήστης διαλέγει διαφορετικό option από dropdown
  const selectExtraOption = (addedMonths) => {
    setManualOverride(true);
    setExtraInterestMonths(String(addedMonths));
    // Το ποσό τόκου παραμένει το ίδιο — απλά μοιράζεται σε διαφορετικό αριθμό μηνών
    if (extraInfo && extraInfo.interest_amount) {
      setExtraInterestAmount(String(extraInfo.interest_amount.toFixed(2)));
    }
  };

  // Manual edit ποσού τόκου
  const handleManualAmountChange = (v) => {
    setManualOverride(true);
    setExtraInterestAmount(v);
  };

  const clearExtraInterestOverride = () => {
    setManualOverride(false);
    if (extraInfo && extraInfo.applies) {
      setExtraInterestAmount(String((extraInfo.interest_amount || 0).toFixed(2)));
      setExtraInterestMonths(String(extraInfo.suggested_added_months || 0));
    } else {
      setExtraInterestAmount('0');
      setExtraInterestMonths('0');
    }
  };

  // ── Handlers ──────────────────────────────────────────────────
  const adjustMonths = (delta) => {
    const cur = parseInt(months) || 0;
    const next = cur + delta;
    const minVal = isFree ? FREE_MIN : INT_MIN;
    const maxVal = isFree ? FREE_MAX : INT_MAX;
    if (next < minVal || next > maxVal) return;
    setMonths(String(next));
  };

  // Lock / unlock δόση
  const toggleLockInstallment = (inst) => {
    if (inst.is_down_payment) return; // δεν κλειδώνεται προκαταβολή
    const monthNum = inst.month_number;
    const isLocked = monthNum in lockedAmounts;
    if (isLocked) {
      // Unlock — αν είσαι σε edit mode στην ίδια, save first
      const newLocked = { ...lockedAmounts };
      delete newLocked[monthNum];
      setLockedAmounts(newLocked);
      if (editingLockMonth === monthNum) {
        setEditingLockMonth(null);
        setEditingLockValue('');
      }
    } else {
      // Lock σε αυτό το ποσό
      setLockedAmounts({ ...lockedAmounts, [monthNum]: Number(inst.amount) });
    }
  };

  const startEditLock = (inst) => {
    if (inst.is_down_payment) return;
    setEditingLockMonth(inst.month_number);
    setEditingLockValue(String(Number(inst.amount).toFixed(2)));
  };

  const saveEditLock = () => {
    if (editingLockMonth === null) return;
    const v = parseFloat(editingLockValue);
    if (isNaN(v) || v < 0) {
      Alert.alert('Σφάλμα', 'Λάθος ποσό');
      return;
    }
    setLockedAmounts({ ...lockedAmounts, [editingLockMonth]: v });
    setEditingLockMonth(null);
    setEditingLockValue('');
  };

  const cancelEditLock = () => {
    setEditingLockMonth(null);
    setEditingLockValue('');
  };

  // Save / Clear draft
  const handleSave = async () => {
    if (saving) return;
    if (!installments.length) {
      Alert.alert('Σφάλμα', calcError || 'Δεν υπάρχουν δόσεις.');
      return;
    }
    setSaving(true);
    try {
      const m = parseInt(months) || 0;
      const dp = parseFloat(downPayment) || 0;
      const params = {
        schedule_type: mode,
        total_amount: totalAmount,
        base_amount: totalAmount,
        down_payment: dp,
        down_payment_date: dp > 0 ? (downDate || startDate) : null,
        months_count: m,
        start_date: startDate,
        xmas_extra: parseFloat(xmasExtra) || 0,
        easter_extra: parseFloat(easterExtra) || 0,
        summer_extra: parseFloat(summerExtra) || 0,
        locked_amounts: lockedAmounts,
        extra_interest_amount: parseFloat(extraInterestAmount) || 0,
        extra_interest_added_months: parseInt(extraInterestMonths) || 0,
      };
      const r = await apiSchedDraftSave(params, token);
      if (r && r.ok) {
        onSaved && onSaved(params);
        onClose && onClose();
      } else {
        Alert.alert('Σφάλμα', (r && r.error) || 'Αποτυχία αποθήκευσης');
      }
    } catch (e) {
      Alert.alert('Σφάλμα', 'Σφάλμα δικτύου: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Καθαρισμός',
      `Θέλεις σίγουρα να καθαρίσεις το ${isFree ? 'άτοκο ' : ''}δοσολόγιο;`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        { text: 'Ναι', style: 'destructive', onPress: async () => {
          try {
            await apiSchedDraftDelete(token, mode);
            onCleared && onCleared();
            onClose && onClose();
          } catch (e) {
            Alert.alert('Σφάλμα', 'Δεν διαγράφηκε');
          }
        }},
      ]
    );
  };

  if (!visible) return null;

  const hasFestive = !isFree && (festiveAvailable.xmas || festiveAvailable.easter || festiveAvailable.summer);
  const showExtraInterestPanel = !isFree && (parseInt(months) || 0) > INTEREST_THRESHOLD;
  const lockedCount = Object.keys(lockedAmounts).length;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.container}
      >
        {/* Header */}
        <View style={[s.header, { backgroundColor: themeColor }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Text style={s.headerBtn}>✕ Κλείσιμο</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{title}</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

          {/* Σύνολο */}
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>{isFree ? 'Σύνολο Μετρητοίς' : 'Σύνολο Δόσεων'}</Text>
            <Text style={[s.totalVal, { color: themeColor }]}>
              {(Number(totalAmount) || 0).toFixed(2)} €
            </Text>
          </View>

          {/* Μήνες stepper */}
          <Text style={s.label}>ΜΗΝΕΣ {isFree && `(${FREE_MIN}-${FREE_MAX})`}</Text>
          <View style={s.monthsStepper}>
            <TouchableOpacity style={[s.stepBtn, { backgroundColor: themeColor }]} onPress={() => adjustMonths(-1)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Text style={s.stepBtnText}>▼</Text>
            </TouchableOpacity>
            <TextInput style={s.monthsInput} value={months} onChangeText={setMonths} keyboardType="number-pad" maxLength={2} textAlign="center" />
            <TouchableOpacity style={[s.stepBtn, { backgroundColor: themeColor }]} onPress={() => adjustMonths(1)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Text style={s.stepBtnText}>▲</Text>
            </TouchableOpacity>
          </View>

          {/* Ημερομηνία έναρξης */}
          <Text style={s.label}>ΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ</Text>
          <TouchableOpacity style={s.dateBtn} onPress={() => setShowStartPicker(true)}>
            <Text style={s.dateBtnText}>📅 {startDate ? _isoToDmy(startDate) : 'Επιλογή ημερομηνίας'}</Text>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker value={startDate ? _isoToDate(startDate) : new Date()} mode="date"
              display={'spinner'}
              onChange={(event, selectedDate) => { setShowStartPicker(false); if (selectedDate) setStartDate(_dateToIso(selectedDate)); }} />
          )}

          {/* Προκαταβολή */}
          <Text style={s.label}>ΠΡΟΚΑΤΑΒΟΛΗ €</Text>
          <TextInput style={s.input} value={downPayment} onChangeText={setDownPayment} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#4a7fa5" />
          {parseFloat(downPayment) > 0 && (
            <>
              <Text style={s.label}>ΗΜ/ΝΙΑ ΠΡΟΚΑΤΑΒΟΛΗΣ</Text>
              <TouchableOpacity style={s.dateBtn} onPress={() => setShowDownPicker(true)}>
                <Text style={s.dateBtnText}>📅 {downDate ? _isoToDmy(downDate) : 'Επιλογή ημερομηνίας'}</Text>
              </TouchableOpacity>
              {showDownPicker && (
                <DateTimePicker value={downDate ? _isoToDate(downDate) : (startDate ? _isoToDate(startDate) : new Date())} mode="date"
                  display={'spinner'}
                  onChange={(event, selectedDate) => { setShowDownPicker(false); if (selectedDate) setDownDate(_dateToIso(selectedDate)); }} />
              )}
            </>
          )}

          {/* ─── FESTIVE PANEL (έντοκο μόνο) ──────────────── */}
          {!isFree && hasFestive && (
            <View style={s.panel}>
              <Text style={s.panelTitle}>🎄 ΓΙΟΡΤΕΣ — ΕΞΤΡΑ ΔΟΣΕΙΣ</Text>
              {festiveAvailable.xmas && (
                <View style={s.festRow}>
                  <Text style={[s.festLabel, { color: '#fda4af' }]}>Χριστούγεννα</Text>
                  <TextInput style={s.festInput} value={xmasExtra} onChangeText={setXmasExtra} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#4a7fa5" />
                  <Text style={s.festSuffix}>€</Text>
                </View>
              )}
              {festiveAvailable.easter && (
                <View style={s.festRow}>
                  <Text style={[s.festLabel, { color: '#fbbf24' }]}>Πάσχα</Text>
                  <TextInput style={s.festInput} value={easterExtra} onChangeText={setEasterExtra} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#4a7fa5" />
                  <Text style={s.festSuffix}>€</Text>
                </View>
              )}
              {festiveAvailable.summer && (
                <View style={s.festRow}>
                  <Text style={[s.festLabel, { color: '#7dd3fc' }]}>Καλοκαίρι</Text>
                  <TextInput style={s.festInput} value={summerExtra} onChangeText={setSummerExtra} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#4a7fa5" />
                  <Text style={s.festSuffix}>€</Text>
                </View>
              )}
            </View>
          )}

          {/* ─── EXTRA INTEREST PANEL (έντοκο > 15 μήνες) — v1.0.101 ── */}
          {showExtraInterestPanel && extraInfo && extraInfo.applies && (
            <View style={s.panel}>
              <Text style={s.panelTitle}>💰 ΕΞΤΡΑ ΤΟΚΟΣ</Text>
              <Text style={s.helper}>
                <Text style={{fontWeight:'700', color:'#aac4e0'}}>{extraInfo.extra_months}</Text> επιπλέον μήνες πάνω από τους {INTEREST_THRESHOLD} × <Text style={{fontWeight:'700', color:'#aac4e0'}}>{(interestSettings && interestSettings.rate_per_month_pct) || 2}%</Text>/μήνα
              </Text>
              <Text style={[s.helper, {marginTop: 4, color:'#aac4e0'}]}>
                → Ποσό τόκου: <Text style={{fontWeight:'700', color:'#fbbf24'}}>{Number(extraInfo.interest_amount).toFixed(0)} €</Text>
              </Text>

              {/* Options dropdown — buttons γιατί δεν υπάρχει native picker εύκολα */}
              <Text style={[s.label, {marginTop: 12}]}>ΕΠΙΛΟΓΗ ΕΠΙΠΛΕΟΝ ΜΗΝΩΝ</Text>
              <View style={s.optionsRow}>
                <TouchableOpacity
                  style={[s.optBtn, parseInt(extraInterestMonths) === 0 && s.optBtnActive]}
                  onPress={() => { setManualOverride(true); setExtraInterestMonths('0'); }}
                >
                  <Text style={[s.optBtnText, parseInt(extraInterestMonths) === 0 && s.optBtnTextActive]}>Χωρίς</Text>
                  <Text style={s.optBtnSubtext}>(ενσωμ.)</Text>
                </TouchableOpacity>
                {extraInfo.options.map((o) => {
                  const isActive = parseInt(extraInterestMonths) === o.added_months;
                  const isSuggested = o.added_months === extraInfo.suggested_added_months;
                  const perMonth = extraInfo.interest_amount / Math.max(1, o.added_months);
                  return (
                    <TouchableOpacity
                      key={o.added_months}
                      style={[s.optBtn, isActive && s.optBtnActive]}
                      onPress={() => selectExtraOption(o.added_months)}
                    >
                      <Text style={[s.optBtnText, isActive && s.optBtnTextActive]}>
                        +{o.added_months}{isSuggested && ' ⭐'}
                      </Text>
                      <Text style={s.optBtnSubtext}>{perMonth.toFixed(0)}€/μην</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {extraInfo.suggested_added_months > 0 && (
                <Text style={[s.helper, {marginTop: 6, fontStyle:'italic'}]}>
                  ⭐ = προτεινόμενο
                </Text>
              )}

              {/* Manual override (πάντα διαθέσιμο) */}
              <Text style={[s.label, {marginTop: 12}]}>Η΄ ΧΕΙΡΟΚΙΝΗΤΟ ΠΟΣΟ ΤΟΚΟΥ</Text>
              <View style={s.festRow}>
                <TextInput style={s.festInput} value={extraInterestAmount} onChangeText={handleManualAmountChange} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#4a7fa5" />
                <Text style={s.festSuffix}>€</Text>
              </View>

              {manualOverride && (
                <TouchableOpacity style={s.clearLinkBtn} onPress={clearExtraInterestOverride}>
                  <Text style={s.clearLinkText}>↻ Επαναφορά στην προτεινόμενη</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Error */}
          {calcError ? (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>⚠️ {calcError}</Text>
            </View>
          ) : null}

          {/* PREVIEW */}
          <View style={s.previewHeader}>
            <Text style={s.sectionTitle}>ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΔΟΣΕΩΝ</Text>
            {lockedCount > 0 && (
              <Text style={s.lockedCount}>🔒 {lockedCount} κλειδωμένες</Text>
            )}
          </View>
          {loadingCalc ? (
            <ActivityIndicator size="small" color={themeColor} style={{ marginVertical: 12 }} />
          ) : installments.length > 0 ? (
            <View style={s.previewBox}>
              <Text style={s.tipText}>💡 Tap σε δόση για κλείδωμα. Long-tap για επεξεργασία ποσού.</Text>
              {installments.map((inst, i) => {
                const isLocked = !inst.is_down_payment && (inst.month_number in lockedAmounts);
                const isEditing = editingLockMonth === inst.month_number;
                return (
                  <View key={i} style={[
                    s.instRow,
                    inst.is_down_payment && { backgroundColor: '#1d3a5f' },
                    inst.note === 'Πάσχα' && { backgroundColor: '#3a2818' },
                    inst.note === 'Καλοκαίρι' && { backgroundColor: '#1d2a3a' },
                    inst.note === 'Χριστούγεννα' && { backgroundColor: '#3a1d1d' },
                    isLocked && { borderWidth: 2, borderColor: '#fbbf24' },
                  ]}>
                    <Text style={s.instMonth}>
                      {inst.is_down_payment ? '💰' : `#${inst.month_number}`}
                    </Text>
                    <Text style={s.instLabel}>{inst.month_label}</Text>
                    {isEditing ? (
                      <View style={s.editLockRow}>
                        <TextInput
                          style={s.editLockInput}
                          value={editingLockValue}
                          onChangeText={setEditingLockValue}
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                        <TouchableOpacity style={s.editLockBtn} onPress={saveEditLock}>
                          <Text style={{color:'#fff'}}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.editLockBtn, {backgroundColor:'#7a3030'}]} onPress={cancelEditLock}>
                          <Text style={{color:'#fff'}}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => toggleLockInstallment(inst)}
                        onLongPress={() => startEditLock(inst)}
                        delayLongPress={500}
                        style={s.amountTouch}
                      >
                        <Text style={[s.instAmount, { color: isLocked ? '#fbbf24' : themeColor }]}>
                          {isLocked && '🔒 '}{Number(inst.amount).toFixed(2)} €
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <View style={[s.instRow, { borderTopWidth: 2, borderTopColor: themeColor, marginTop: 8 }]}>
                <Text style={s.instMonth}>Σ</Text>
                <Text style={s.instLabel}>Σύνολο</Text>
                <Text style={[s.instAmount, { color: themeColor, fontSize: 16 }]}>
                  {installments.reduce((a, b) => a + (Number(b.amount) || 0), 0).toFixed(2)} €
                </Text>
              </View>
            </View>
          ) : (
            <Text style={s.helper}>Συμπλήρωσε τα πεδία για προεπισκόπηση.</Text>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {existingSched && (
            <TouchableOpacity style={[s.btn, s.btnClear]} onPress={handleClear} disabled={saving}>
              <Text style={s.btnText}>🗑️ Καθαρισμός</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.btn, { backgroundColor: themeColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving || loadingCalc || !installments.length}
          >
            {saving ? (<ActivityIndicator color="#fff" size="small" />) : (<Text style={s.btnText}>💾 Αποθήκευση</Text>)}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1f33' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerBtn: { color: '#fff', fontSize: 14, fontWeight: '600', minWidth: 80 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  body: { padding: 16, paddingBottom: 20 },
  totalBox: { backgroundColor: '#1e3a5f', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#2d5f8a' },
  totalLabel: { color: '#aac4e0', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  totalVal: { fontSize: 24, fontWeight: '800' },
  label: { color: '#aac4e0', fontSize: 11, fontWeight: '700', marginTop: 14, marginBottom: 6, letterSpacing: 0.5 },
  input: { backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#3a70a0' },
  helper: { color: '#7c93b1', fontSize: 11, marginTop: 4 },
  // months stepper
  monthsStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  stepBtn: { width: 50, height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  monthsInput: { backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 10, padding: 8, fontSize: 20, fontWeight: '800', borderWidth: 1, borderColor: '#3a70a0', width: 90, height: 50 },
  // date picker button
  dateBtn: { backgroundColor: '#2d5f8a', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#3a70a0' },
  dateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // panels (festive / extra interest)
  panel: { backgroundColor: '#16354f', borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#2d5f8a' },
  panelTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  festRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 8 },
  festLabel: { color: '#aac4e0', fontSize: 13, fontWeight: '700', width: 110 },
  festInput: { flex: 1, backgroundColor: '#2d5f8a', color: '#fff', borderRadius: 8, padding: 8, fontSize: 14, borderWidth: 1, borderColor: '#3a70a0' },
  festSuffix: { color: '#aac4e0', fontSize: 12, fontWeight: '600', width: 50 },
  // suggestion box
  suggestionBox: { backgroundColor: '#1d3a5f', borderRadius: 8, padding: 10, marginVertical: 8, borderWidth: 1, borderColor: '#3b82f6' },
  suggestionText: { color: '#aac4e0', fontSize: 12, marginBottom: 6 },
  applyBtn: { backgroundColor: '#3b82f6', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // option buttons (extra interest dropdown alternative)
  optionsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  optBtn: { flex: 1, minWidth: 70, backgroundColor: '#1e3a5f', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  optBtnActive: { backgroundColor: '#3b82f6', borderColor: '#fbbf24' },
  optBtnText: { color: '#aac4e0', fontSize: 13, fontWeight: '700' },
  optBtnTextActive: { color: '#fff' },
  optBtnSubtext: { color: '#7c93b1', fontSize: 9, marginTop: 2 },
  clearLinkBtn: { marginTop: 8, alignSelf: 'flex-start' },
  clearLinkText: { color: '#fda4af', fontSize: 12 },
  // errors
  errorBox: { backgroundColor: '#3a1d1d', borderColor: '#7a3030', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 12 },
  errorTxt: { color: '#fda4af', fontSize: 13 },
  // preview
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  sectionTitle: { color: '#aac4e0', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  lockedCount: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },
  tipText: { color: '#7c93b1', fontSize: 10, fontStyle: 'italic', marginBottom: 8, textAlign: 'center' },
  previewBox: { backgroundColor: '#16354f', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#2d5f8a', marginTop: 8 },
  instRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6 },
  instMonth: { color: '#7c93b1', fontSize: 12, fontWeight: '700', width: 30 },
  instLabel: { color: '#fff', fontSize: 13, flex: 1, paddingHorizontal: 6 },
  amountTouch: { paddingHorizontal: 8, paddingVertical: 4 },
  instAmount: { fontSize: 14, fontWeight: '700' },
  editLockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLockInput: { backgroundColor: '#3a70a0', color: '#fff', borderRadius: 6, padding: 6, width: 80, fontSize: 13 },
  editLockBtn: { backgroundColor: '#10b981', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  // footer
  footer: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#0a1729', borderTopWidth: 1, borderTopColor: '#2d5f8a' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnClear: { backgroundColor: '#7a3030' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
