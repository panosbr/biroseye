import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { apiGetCart, apiClearCart, apiLogout } from '../api/client';

export default function NavBar({ navigation, token, onCartUpdate, activeScreen }) {
  const [cartCount, setCartCount] = useState(0);
  const pollTimer = useRef(null);

  useEffect(() => {
    loadCartCount();
    pollTimer.current = setInterval(loadCartCount, 5000);
    return () => clearInterval(pollTimer.current);
  }, [token]);

  const loadCartCount = async () => {
    try {
      const data = await apiGetCart(token);
      setCartCount((data.items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0));
    } catch (e) {}
  };

  const handleHome = () => navigation.reset({ index: 0, routes: [{ name: 'CustomerSelect', params: { token } }] });
  const handleCart = () => navigation.navigate('Cart', { token });
  const handleHelp = () => navigation.navigate('Help');
  const handleQuotes = () => navigation.navigate('Quotes', { token });

  const handleClearCart = () => {
    Alert.alert('Εκκαθάριση', 'Να αδειάσει το καλάθι;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Ναι', style: 'destructive', onPress: async () => {
        await apiClearCart(token).catch(()=>{});
        loadCartCount();
        onCartUpdate && onCartUpdate();
      }},
    ]);
  };

  const handleQuit = () => {
    Alert.alert('Αποσύνδεση', 'Να γίνει αποσύνδεση;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Αποσύνδεση', style: 'destructive', onPress: async () => {
        await apiLogout(token).catch(()=>{});
        navigation.reset({ index: 0, routes: [{ name: 'Pin' }] });
      }},
    ]);
  };

  const C = '#d0e8ff'; // χρώμα εικονιδίων — σχεδόν λευκό
  const CA = '#ffffff'; // χρώμα active

  return (
    <View style={s.bar}>

      <TouchableOpacity style={[s.btn, activeScreen==='Home' && s.active]} onPress={handleHome}>
        <Ionicons name="home" size={22} color={activeScreen==='Home' ? CA : C} />
        <Text style={[s.lbl, activeScreen==='Home' && s.lblA]}>Αρχή</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, activeScreen==='Cart' && s.active]} onPress={handleCart}>
        <View>
          <Ionicons name="cart" size={22} color={activeScreen==='Cart' ? CA : C} />
          {cartCount > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{cartCount}</Text></View>}
        </View>
        <Text style={[s.lbl, activeScreen==='Cart' && s.lblA]}>Καλάθι</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btn} onPress={handleClearCart}>
        <MaterialCommunityIcons name="broom" size={22} color={C} />
        <Text style={s.lbl}>Εκκαθ.</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, activeScreen==='Quotes' && s.active]} onPress={handleQuotes}>
        <FontAwesome5 name="file-alt" size={20} color={activeScreen==='Quotes' ? CA : C} />
        <Text style={[s.lbl, activeScreen==='Quotes' && s.lblA]}>Προσφορές</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btn} onPress={handleHelp}>
        <Ionicons name="help-circle" size={22} color={C} />
        <Text style={s.lbl}>Βοήθεια</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btn} onPress={handleQuit}>
        <Ionicons name="exit-outline" size={22} color={C} />
        <Text style={s.lbl}>Έξοδος</Text>
      </TouchableOpacity>

    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: '#16354f', borderBottomWidth: 1, borderBottomColor: '#2d5f8a', paddingVertical: 5 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  active: { backgroundColor: '#2d5f8a', borderRadius: 8 },
  lbl: { color: '#8ab4d4', fontSize: 8, marginTop: 2 },
  lblA: { color: '#fff' },
  badge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 15, height: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeTxt: { color: '#fff', fontSize: 8, fontWeight: '700' },
});
