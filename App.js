import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import PinScreen from './src/screens/PinScreen';
import CustomerSelectScreen from './src/screens/CustomerSelectScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ProductScreen from './src/screens/ProductScreen';
import CartScreen from './src/screens/CartScreen';
import HelpScreen from './src/screens/HelpScreen';
import CustomItemScreen from './src/screens/CustomItemScreen';
import CreateQuoteScreen from './src/screens/CreateQuoteScreen';
import QuotesScreen from './src/screens/QuotesScreen';
import BirosByeScannerScreen from './src/screens/BirosByeScannerScreen';
import BirosByeProductScreen from './src/screens/BirosByeProductScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Pin" component={PinScreen} />
        <Stack.Screen name="CustomerSelect" component={CustomerSelectScreen} />
        <Stack.Screen name="Scanner" component={ScannerScreen} />
        <Stack.Screen name="Product" component={ProductScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="CustomItem" component={CustomItemScreen} />
        <Stack.Screen name="CreateQuote" component={CreateQuoteScreen} />
        <Stack.Screen name="Quotes" component={QuotesScreen} />
        <Stack.Screen name="BirosByeScanner" component={BirosByeScannerScreen} />
        <Stack.Screen name="BirosByeProduct" component={BirosByeProductScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
