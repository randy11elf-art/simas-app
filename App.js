import React, { useState, useEffect, useRef, useCallback, useMemo, memo, createContext, useContext } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, Alert, Modal, StatusBar, ScrollView, Linking,
  Animated, KeyboardAvoidingView, Platform, SafeAreaView, Dimensions,
  RefreshControl, BackHandler, ToastAndroid, Easing, InteractionManager
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ScreenOrientation from 'expo-screen-orientation';

// ★ GANTI DENGAN URL DEPLOYMENT BARU SETELAH DEPLOY GAS ★
const API_URL = "https://script.google.com/macros/s/AKfycbwRC-ejiUpm-Xz3FK7gjwVkp2WgTOtfyVl1YtD59czyx9zm_6V_7CGnAndYvMBUum6T9Q/exec";

const SPREADSHEET_ID = "1nHqZCFnAcPZh7dxJxCGILxwIE8nhDCdy7iaA67wvNwg";

// ★ FIXED: ID sudah diisi, SHEET_URL pakai constant
const HANDOVER_SHEET_ID = "1hHvT6sZMkqT5HxJI3omDAbor5l2j8wZeVrrJjmdxszQ";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/1hHvT6sZMkqT5HxJI3omDAbor5l2j8wZeVrrJjmdxszQ/edit`;

const APP_VERSION = 'v3.4.2';
const STERIL_DAYS = 30;
const MIN_ALASAN_WORDS = 5;
const FETCH_TIMEOUT = 15000;
const MAX_NAV_STACK = 20;

const validateApiUrl = () => {
  if (!API_URL || API_URL.includes('PASTE_URL_BARU')) {
    throw new Error('API_URL belum diisi! Ganti PASTE_URL_BARU dengan URL deployment GAS Anda.');
  }
};

const COLORS = Object.freeze({
  primary: '#00cec9', secondary: '#6c5ce7', accent: '#a29bfe',
  bgApp: '#0f172a', lightBg: '#f8f9fa', cardBg: '#1e293b', white: '#ffffff',
  gradientPrimary: ['#6c5ce7', '#a29bfe'],
  gradientSecondary: ['#00cec9', '#81ecec'],
  gradientDanger: ['#ff7675', '#d63031'],
  menu1: '#4834d4', menu2: '#00b894', menu3: '#fdcb6e',
  menu4: '#e17055', menu5: '#0984e3', menu6: '#e84393',
  statSteril: '#00cec9', statEd: '#fbc531', statExp: '#ff3f34', statKotor: '#2563eb',
  danger: '#ff3f34', warning: '#fbc531', success: '#00b894',
  textLight: '#2d3436', textDark: '#f1f5f9',
  navBar: '#ffffff', navBarDark: '#1e293b',
  chart1: '#6c5ce7', chart2: '#00cec9', chart3: '#fdcb6e',
  chart4: '#ff7675', chart5: '#00b894', chart6: '#e17055',
});

const THEME = Object.freeze({
  light: {
    bg: COLORS.lightBg, card: COLORS.white, text: COLORS.textLight,
    sub: '#636e72', border: '#dfe6e9', bottomBar: COLORS.navBar,
    inputBg: '#fff', tableHead: '#ecf0f1'
  },
  dark: {
    bg: COLORS.bgApp, card: COLORS.cardBg, text: COLORS.textDark,
    sub: '#94a3b8', border: '#334155', bottomBar: COLORS.navBarDark,
    inputBg: '#334155', tableHead: '#1e293b'
  }
});

const MONTHS = Object.freeze([
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]);
const MONTHS_SHORT = Object.freeze([
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
]);
const MONTHS_WITH_ALL = Object.freeze(['Semua Bulan', ...MONTHS]);
const YEARS = Object.freeze(
  Array.from({ length: 15 }, (_, i) => (new Date().getFullYear() - 5 + i).toString())
);

const { width } = Dimensions.get('window');
const TAB_WIDTH = (width - 40) / 5;

const NAV_ITEMS = Object.freeze([
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'dashboard', icon: 'view-dashboard', label: 'Dashboard' },
  { key: 'input', icon: 'plus-circle', label: 'Input' },
  { key: 'laporan', icon: 'file-chart', label: 'Laporan' },
  { key: 'statistik', icon: 'chart-bar', label: 'Statistik' }
]);

const FILTER_CONFIG = Object.freeze([
  { key: 'TOTAL', color: '#6c5ce7', statKey: 'total' },
  { key: 'STERIL', color: COLORS.statSteril, statKey: 'steril' },
  { key: 'ED HARI INI', color: COLORS.statEd, statKey: 'edToday' },
  { key: 'EXPIRED', color: COLORS.statExp, statKey: 'expired' },
  { key: 'KOTOR', color: COLORS.statKotor, statKey: 'kotor' }
]);

const INITIAL_FORM = Object.freeze({
  id: '', petugas: '', instrument: '', tglSteril: '',
  tglED: '', tglPakai: '', keterangan: ''
});
const INITIAL_STATS = Object.freeze({
  total: 0, steril: 0, edToday: 0, expired: 0, kotor: 0
});

const ThemeContext = createContext();
const useTheme = () => useContext(ThemeContext);

const showToast = (msg) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert("Info", msg);
  }
};

const formatDate = (ds) => {
  if (!ds) return '-';
  try {
    const d = new Date(ds);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch (e) { return '-'; }
};

const formatDateExcel = (ds) => {
  if (!ds) return '-';
  try {
    const d = new Date(ds);
    if (isNaN(d.getTime())) return '-';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch (e) { return '-'; }
};

const parseDateTime = (ds) => {
  if (!ds) return new Date(0);
  try {
    const d = new Date(ds);
    if (isNaN(d.getTime())) return new Date(0);
    return d;
  } catch (e) { return new Date(0); }
};

const getDaysRemaining = (ed) => {
  if (!ed) return null;
  try {
    const d = new Date(ed);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.floor((d - today) / 86400000);
  } catch (e) { return null; }
};

const escapeHtml = (s) => {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const getKeteranganLaporan = (item) => {
  if (!item) return '-';
  if (item.aksi === 'MASUK') return 'Sterilisasi baru';
  if (item.aksi === 'KELUAR') {
    const ket = String(item.ket || '').toLowerCase();
    if (ket.includes('expired') || ket.includes('kadaluarsa')) {
      return 'Expired / Kadaluarsa';
    }
    if (item.tglPakai || ket.includes('digunakan')) {
      return `Digunakan tanggal ${formatDate(item.tglPakai || item.tgl)}`;
    }
    return item.ket || 'Keluar';
  }
  return item.ket || '-';
};

const getStatusColor = (s) => {
  switch (s) {
    case 'STERIL': return COLORS.statSteril;
    case 'KOTOR': return COLORS.statKotor;
    case 'EXPIRED': return COLORS.statExp;
    case 'ED HARI INI': return COLORS.warning;
    default: return COLORS.warning;
  }
};

const fetchWithTimeout = async (url, opts = {}, timeout = FETCH_TIMEOUT) => {
  validateApiUrl();
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: c.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    if (e.name === 'AbortError') throw new Error('Koneksi timeout. Periksa internet Anda.');
    throw e;
  }
};

const validateForm = (f, isEdit) => {
  const e = [];
  if (!f.petugas?.trim()) e.push('Petugas harus diisi');
  if (!f.instrument?.trim()) e.push('Instrument harus diisi');
  if (!f.tglSteril) e.push('Tanggal steril harus diisi');
  if (!f.tglED) e.push('Tanggal expired harus diisi');
  if (f.tglSteril && f.tglED) {
    const sterilDate = new Date(f.tglSteril);
    const edDate = new Date(f.tglED);
    if (!isNaN(sterilDate.getTime()) && !isNaN(edDate.getTime())) {
      if (edDate <= sterilDate) e.push('Tanggal expired harus setelah tanggal steril');
    }
  }
  if (isEdit && f.tglPakai && f.tglSteril) {
    const pakaiDate = new Date(f.tglPakai);
    const sterilDate = new Date(f.tglSteril);
    if (!isNaN(pakaiDate.getTime()) && !isNaN(sterilDate.getTime())) {
      if (pakaiDate < sterilDate) e.push('Tanggal pakai tidak boleh sebelum tanggal steril');
    }
  }
  return e;
};

// ================================================================
// SPLASH SCREEN
// ================================================================

const SplashScreen = memo(({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.5],
  });

  useEffect(() => {
    mountedRef.current = true;

    const entryAnimation = Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 600, useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5))
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, friction: 4, tension: 40, useNativeDriver: true
        })
      ]),
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 0.05, duration: 100, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -0.05, duration: 100, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 100, useNativeDriver: true })
      ])
    ]);

    const slideAnimation = Animated.timing(slideUp, {
      toValue: 0, duration: 600, delay: 300,
      useNativeDriver: true, easing: Easing.out(Easing.exp)
    });

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    );

    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1, duration: 2500, useNativeDriver: false,
      easing: Easing.out(Easing.quad)
    });

    entryAnimation.start();
    slideAnimation.start();
    pulseAnimation.start();
    progressAnimation.start();

    const timer = setTimeout(() => {
      if (mountedRef.current) onFinish();
    }, 2800);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      entryAnimation.stop();
      slideAnimation.stop();
      pulseAnimation.stop();
      progressAnimation.stop();
    };
  }, []);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-30deg', '30deg']
  });

  return (
    <LinearGradient
      colors={['#6c5ce7', '#a29bfe', '#74b9ff']}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <StatusBar hidden />
      <View style={{
        position: 'absolute', top: -100, right: -100,
        width: 250, height: 250, borderRadius: 125,
        backgroundColor: 'rgba(255,255,255,0.1)'
      }} />

      <Animated.View style={{
        marginBottom: 25,
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }, { rotate: rotateInterpolate }]
      }}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient
            colors={['#fff', '#f0f0f0']}
            style={{
              width: 120, height: 120, borderRadius: 60,
              justifyContent: 'center', alignItems: 'center', elevation: 15
            }}
          >
            <MaterialCommunityIcons name="hospital-box" size={60} color={COLORS.secondary} />
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      <Animated.View style={{
        alignItems: 'center',
        opacity: fadeAnim,
        transform: [{ translateY: slideUp }]
      }}>
        <Text style={{ fontSize: 42, fontWeight: 'bold', color: '#fff', letterSpacing: 6 }}>SIMAS</Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 8, letterSpacing: 1.5 }}>
          Sistem Informasi & Monitoring
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', letterSpacing: 1.5, fontWeight: '600' }}>
          Alat Steril
        </Text>
        <View style={{ width: 40, height: 3, backgroundColor: COLORS.primary, marginVertical: 15, borderRadius: 2 }} />
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 3 }}>IBS RSJD Amino</Text>
      </Animated.View>

      <View style={{ position: 'absolute', bottom: 80, alignItems: 'center', width: '100%' }}>
        <View style={{
          width: width * 0.5, height: 5,
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: 3, overflow: 'hidden'
        }}>
          <Animated.View style={{
            height: '100%', backgroundColor: COLORS.primary, borderRadius: 3, width: progressWidth
          }} />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 8 }}>Memuat aplikasi...</Text>
      </View>

      <Text style={{ position: 'absolute', bottom: 30, color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
        {APP_VERSION}
      </Text>
    </LinearGradient>
  );
});

// ================================================================
// AUTH COMPONENTS
// ================================================================

const AuthInputField = memo(({
  icon, placeholder, value, onChangeText, secure,
  keyboardType, maxLength, autoCapitalize, showPin,
  onTogglePin, showToggle
}) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14, paddingHorizontal: 15, marginBottom: 12
  }}>
    <Ionicons name={icon} size={20} color="rgba(255,255,255,0.8)" />
    <TextInput
      style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 12, color: '#fff', fontSize: 15 }}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.4)"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure && !showPin}
      keyboardType={keyboardType}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize || "none"}
      autoCorrect={false}
    />
    {showToggle && (
      <TouchableOpacity onPress={onTogglePin} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={showPin ? "eye-off" : "eye"} size={22} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    )}
  </View>
));

const AuthValidationHint = memo(({ condition, valid, invalid }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 5, marginTop: -6 }}>
    <Ionicons
      name={condition ? "checkmark-circle" : "close-circle"}
      size={14}
      color={condition ? COLORS.success : COLORS.danger}
    />
    <Text style={{
      color: condition ? COLORS.success : 'rgba(255,255,255,0.5)',
      fontSize: 10, marginLeft: 5
    }}>
      {condition ? valid : invalid}
    </Text>
  </View>
));

const AuthScreen = memo(({ onLogin, loading }) => {
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [nama, setNama] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 600, useNativeDriver: true,
        easing: Easing.out(Easing.back(1.2))
      })
    ]).start();
  }, []);

  const togglePin = useCallback(() => setShowPin(p => !p), []);

  const switchMode = useCallback((mode) => {
    const slideDirection = mode === 'register' ? -width : width;
    Animated.sequence([
      Animated.timing(formSlide, { toValue: slideDirection, duration: 200, useNativeDriver: true }),
      Animated.timing(formSlide, { toValue: 0, duration: 0, useNativeDriver: true })
    ]).start();
    setAuthMode(mode);
    setUsername(''); setPin(''); setConfirmPin(''); setNama(''); setShowPin(false);
  }, [formSlide]);

  const handleLogin = useCallback(() => {
    if (!username.trim()) { Alert.alert('Error', 'Username harus diisi'); return; }
    if (!pin.trim()) { Alert.alert('Error', 'PIN harus diisi'); return; }
    onLogin(username.trim(), pin.trim());
  }, [username, pin, onLogin]);

  const handleRegister = useCallback(async () => {
    if (!nama.trim() || nama.trim().length < 2) { Alert.alert('Error', 'Nama minimal 2 karakter'); return; }
    if (!username.trim() || username.trim().length < 3) { Alert.alert('Error', 'Username minimal 3 karakter'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) { Alert.alert('Error', 'Username hanya boleh huruf, angka, underscore'); return; }
    if (!pin.trim() || pin.trim().length < 4) { Alert.alert('Error', 'PIN minimal 4 digit'); return; }
    if (!/^\d+$/.test(pin.trim())) { Alert.alert('Error', 'PIN harus angka'); return; }
    if (pin !== confirmPin) { Alert.alert('Error', 'Konfirmasi PIN tidak cocok'); return; }

    setRegLoading(true);
    try {
      const res = await fetchWithTimeout(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', data: { username: username.trim(), pin: pin.trim(), nama: nama.trim() } })
      });
      const json = await res.json();
      if (json.status === 'success') {
        Alert.alert('🎉 Berhasil!', json.message, [{ text: 'Login Sekarang', onPress: () => switchMode('login') }]);
      } else { Alert.alert('Gagal', json.message || 'Registrasi gagal'); }
    } catch (e) { Alert.alert('Error', e.message); }
    setRegLoading(false);
  }, [username, pin, confirmPin, nama, switchMode]);

  const isLoginLoading = loading;
  const isRegisterLoading = regLoading;

  return (
    <LinearGradient colors={['#6c5ce7', '#a29bfe', '#74b9ff']} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 30 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={{ alignItems: 'center', marginBottom: 30 }}>
              <LinearGradient colors={['#fff', '#f0f0f0']} style={{ width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 10, marginBottom: 12 }}>
                <MaterialCommunityIcons name="hospital-box" size={40} color={COLORS.secondary} />
              </LinearGradient>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: 4 }}>SIMAS</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>IBS RSJD Amino</Text>
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 4, marginBottom: 20 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: authMode === 'login' ? 'rgba(255,255,255,0.95)' : 'transparent' }} onPress={() => switchMode('login')}>
                <Text style={{ fontWeight: 'bold', fontSize: 15, color: authMode === 'login' ? COLORS.secondary : 'rgba(255,255,255,0.7)' }}>Masuk</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: authMode === 'register' ? 'rgba(255,255,255,0.95)' : 'transparent' }} onPress={() => switchMode('register')}>
                <Text style={{ fontWeight: 'bold', fontSize: 15, color: authMode === 'register' ? COLORS.secondary : 'rgba(255,255,255,0.7)' }}>Daftar</Text>
              </TouchableOpacity>
            </View>

            <Animated.View style={{ transform: [{ translateX: formSlide }] }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                {authMode === 'login' ? (
                  <>
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>👋 Selamat Datang</Text>
                    <AuthInputField icon="person" placeholder="Username" value={username} onChangeText={setUsername} />
                    <View style={{ marginBottom: 13 }}>
                      <AuthInputField icon="lock-closed" placeholder="PIN" value={pin} onChangeText={setPin} secure keyboardType="number-pad" maxLength={6} showToggle showPin={showPin} onTogglePin={togglePin} />
                    </View>
                    <TouchableOpacity style={{ backgroundColor: COLORS.primary, padding: 18, borderRadius: 14, alignItems: 'center', elevation: 5 }} onPress={handleLogin} disabled={isLoginLoading}>
                      {isLoginLoading ? <ActivityIndicator color="white" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="log-in" size={20} color="white" style={{ marginRight: 10 }} />
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>MASUK</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => switchMode('register')} style={{ marginTop: 20, alignItems: 'center' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                        Belum punya akun?{' '}<Text style={{ color: '#fff', fontWeight: 'bold', textDecorationLine: 'underline' }}>Daftar di sini</Text>
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 }}>📝 Buat Akun Baru</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', marginBottom: 20 }}>Isi data di bawah untuk mendaftar</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 6, marginLeft: 5, fontWeight: '600' }}>Nama Lengkap</Text>
                    <AuthInputField icon="person-circle" placeholder="Contoh: Ahmad Sudirman" value={nama} onChangeText={setNama} autoCapitalize="words" />
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 6, marginLeft: 5, fontWeight: '600' }}>Username</Text>
                    <AuthInputField icon="at" placeholder="Huruf, angka, underscore" value={username} onChangeText={setUsername} />
                    {username.length > 0 && <AuthValidationHint condition={/^[a-zA-Z0-9_]{3,}$/.test(username)} valid="Username valid ✓" invalid={username.length < 3 ? 'Minimal 3 karakter' : 'Hanya huruf, angka, underscore'} />}
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 6, marginLeft: 5, fontWeight: '600' }}>PIN (4-6 digit)</Text>
                    <AuthInputField icon="lock-closed" placeholder="Masukkan PIN" value={pin} onChangeText={setPin} secure keyboardType="number-pad" maxLength={6} showToggle showPin={showPin} onTogglePin={togglePin} />
                    {pin.length > 0 && <AuthValidationHint condition={/^\d{4,6}$/.test(pin)} valid="PIN valid ✓" invalid={!/^\d+$/.test(pin) ? 'PIN harus angka' : `${pin.length}/4 digit minimum`} />}
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 6, marginLeft: 5, fontWeight: '600' }}>Konfirmasi PIN</Text>
                    <AuthInputField icon="shield-checkmark" placeholder="Ulangi PIN" value={confirmPin} onChangeText={setConfirmPin} secure keyboardType="number-pad" maxLength={6} showPin={showPin} />
                    {confirmPin.length > 0 && <AuthValidationHint condition={pin === confirmPin} valid="PIN cocok ✓" invalid="PIN tidak cocok" />}
                    <TouchableOpacity style={{ backgroundColor: COLORS.success, padding: 18, borderRadius: 14, alignItems: 'center', elevation: 5, marginTop: 5 }} onPress={handleRegister} disabled={isRegisterLoading}>
                      {isRegisterLoading ? <ActivityIndicator color="white" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="person-add" size={20} color="white" style={{ marginRight: 10 }} />
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>DAFTAR</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => switchMode('login')} style={{ marginTop: 18, alignItems: 'center' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                        Sudah punya akun?{' '}<Text style={{ color: '#fff', fontWeight: 'bold', textDecorationLine: 'underline' }}>Masuk di sini</Text>
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Animated.View>

            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', marginTop: 25 }}>
              SIMAS {APP_VERSION} | IBS RSJD Amino
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
});

// ================================================================
// CHART COMPONENTS
// ================================================================

const BarChart = memo(({ data, maxVal, labels, colors, T, title }) => {
  const barMaxHeight = 120;
  const safeData = data && data.length > 0 ? data : [];
  const mx = maxVal || (safeData.length > 0 ? Math.max(...safeData, 1) : 1);

  return (
    <View style={{ marginBottom: 20 }}>
      {title && <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14, marginBottom: 12 }}>{title}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barMaxHeight + 30, paddingHorizontal: 5 }}>
        {safeData.map((v, i) => {
          const h = Math.max((v / mx) * barMaxHeight, 4);
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', marginHorizontal: 2 }}>
              <Text style={{ fontSize: 9, color: T.text, fontWeight: 'bold', marginBottom: 4 }}>{v}</Text>
              <View style={{ width: '80%', height: h, backgroundColor: colors?.[i % colors.length] || COLORS.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
              <Text style={{ fontSize: 8, color: T.sub, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{labels?.[i] || ''}</Text>
            </View>
          );
        })}
      </View>
      {safeData.length === 0 && <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center', paddingVertical: 20 }}>Tidak ada data</Text>}
    </View>
  );
});

const PieSegment = memo(({ size, color, startAngle, angle }) => {
  const radius = size / 2;
  if (angle <= 0) return null;
  if (angle >= 360) return <View style={{ position: 'absolute', width: size, height: size, borderRadius: radius, backgroundColor: color }} />;

  const rightAngle = Math.min(angle, 180);
  const leftAngle = Math.max(angle - 180, 0);

  return (
    <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: `${startAngle}deg` }] }}>
      <View style={{ position: 'absolute', width: radius, height: size, left: radius, overflow: 'hidden' }}>
        <View style={{ width: radius, height: size, backgroundColor: color, borderTopRightRadius: radius, borderBottomRightRadius: radius, transform: [{ translateX: -(radius / 2) }, { rotate: `${rightAngle - 180}deg` }, { translateX: radius / 2 }] }} />
      </View>
      {leftAngle > 0 && (
        <View style={{ position: 'absolute', width: radius, height: size, left: 0, overflow: 'hidden' }}>
          <View style={{ width: radius, height: size, backgroundColor: color, borderTopLeftRadius: radius, borderBottomLeftRadius: radius, transform: [{ translateX: radius / 2 }, { rotate: `${leftAngle - 180}deg` }, { translateX: -(radius / 2) }] }} />
        </View>
      )}
    </View>
  );
});

const PieChart = memo(({ data, T, title }) => {
  const realTotal = data.reduce((a, b) => a + b.value, 0);
  const calcTotal = realTotal || 1;
  const size = 140;
  const radius = size / 2;
  const innerSize = 60;
  const innerOffset = (size - innerSize) / 2;

  const segments = useMemo(() => {
    if (realTotal === 0) return [];
    let currentAngle = 0;
    return data.filter(d => d.value > 0).map(item => {
      const angle = (item.value / calcTotal) * 360;
      const seg = { ...item, startAngle: currentAngle, angle };
      currentAngle += angle;
      return seg;
    });
  }, [data, realTotal, calcTotal]);

  return (
    <View style={{ marginBottom: 20 }}>
      {title && <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14, marginBottom: 12 }}>{title}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: T.border, elevation: 3 }}>
          {segments.map((seg, i) => <PieSegment key={i} size={size} color={seg.color} startAngle={seg.startAngle} angle={seg.angle} />)}
          <View style={{ position: 'absolute', width: innerSize, height: innerSize, borderRadius: innerSize / 2, backgroundColor: T.card, top: innerOffset, left: innerOffset, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: realTotal === 0 ? T.sub : T.text }}>{realTotal}</Text>
            <Text style={{ fontSize: 7, color: T.sub }}>TOTAL</Text>
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 20 }}>
          {data.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color, marginRight: 8 }} />
              <Text style={{ color: T.sub, fontSize: 11, flex: 1 }}>{item.label}</Text>
              <Text style={{ color: T.text, fontSize: 12, fontWeight: 'bold' }}>{item.value}</Text>
              <Text style={{ color: T.sub, fontSize: 10, marginLeft: 4 }}>({realTotal > 0 ? Math.round(item.value / realTotal * 100) : 0}%)</Text>
            </View>
          ))}
          {realTotal === 0 && <Text style={{ color: T.sub, fontSize: 11, fontStyle: 'italic', marginTop: 8 }}>Tidak ada data periode ini</Text>}
        </View>
      </View>
    </View>
  );
});

const HorizontalBar = memo(({ data, T, title, maxItems = 5 }) => {
  const sliced = data.slice(0, maxItems);
  const mx = sliced.length > 0 ? Math.max(...sliced.map(d => d.jumlah), 1) : 1;
  const barColors = [COLORS.chart1, COLORS.chart2, COLORS.chart3, COLORS.chart4, COLORS.chart5, COLORS.chart6];

  return (
    <View style={{ marginBottom: 20 }}>
      {title && <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14, marginBottom: 12 }}>{title}</Text>}
      {sliced.map((item, i) => (
        <View key={i} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: T.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{item.nama}</Text>
            <Text style={{ color: T.text, fontSize: 12, fontWeight: 'bold', marginLeft: 8 }}>{item.jumlah}x</Text>
          </View>
          <View style={{ height: 20, backgroundColor: T.border, borderRadius: 10, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${(item.jumlah / mx) * 100}%`, backgroundColor: barColors[i % barColors.length], borderRadius: 10 }} />
          </View>
        </View>
      ))}
      {data.length === 0 && <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center', paddingVertical: 20 }}>Belum ada data</Text>}
    </View>
  );
});

const StatNumber = memo(({ label, value, icon, color, T }) => (
  <View style={{ flex: 1, backgroundColor: T.card, marginHorizontal: 4, padding: 12, borderRadius: 12, alignItems: 'center', elevation: 2, borderLeftWidth: 3, borderLeftColor: color }}>
    <MaterialCommunityIcons name={icon} size={20} color={color} />
    <Text style={{ fontSize: 20, fontWeight: 'bold', color, marginTop: 4 }}>{value}</Text>
    <Text style={{ fontSize: 8, color: T.sub, textAlign: 'center', marginTop: 2 }}>{label}</Text>
  </View>
));
// ================================================================
// REUSABLE COMPONENTS
// ================================================================

const PressableScale = memo(({ onPress, children, style, scaleTo = 0.96, ...props }) => {
  const scaleVal = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[style, { transform: [{ scale: scaleVal }] }]}>
      <TouchableOpacity activeOpacity={0.9}
        onPressIn={() => Animated.spring(scaleVal, { toValue: scaleTo, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scaleVal, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        onPress={onPress} {...props}>{children}</TouchableOpacity>
    </Animated.View>
  );
});

const MiniStatCard = memo(({ icon, label, value, color, onPress }) => {
  const T = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[cS.miniStatCard, { backgroundColor: T.card }]}>
      <View style={[cS.miniStatIcon, { backgroundColor: color + '25' }]}>
        <MaterialCommunityIcons name={icon} size={16} color={color} />
      </View>
      <Text style={[cS.miniStatValue, { color }]}>{value}</Text>
      <Text style={[cS.miniStatLabel, { color: T.sub }]}>{label}</Text>
    </TouchableOpacity>
  );
});

const MenuCard = memo(({ label, icon, color, description, onPress }) => {
  const T = useTheme();
  return (
    <PressableScale onPress={onPress} style={cS.menuCardWrapper}>
      <View style={[cS.menuCard, { backgroundColor: T.card, borderColor: T.border }]}>
        <LinearGradient colors={[color + '15', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cS.menuCardGradient}>
          <View style={[cS.menuIconCircle, { backgroundColor: color }]}>
            <MaterialCommunityIcons name={icon} size={22} color="#fff" />
          </View>
          <Text style={[cS.menuLabel, { color: T.text }]}>{label}</Text>
          <Text style={[cS.menuDesc, { color: T.sub }]}>{description}</Text>
        </LinearGradient>
      </View>
    </PressableScale>
  );
});

const RecentActivityItem = memo(({ item, onPress }) => {
  const T = useTheme();
  const isMasuk = item.aksi === 'MASUK';
  const c = isMasuk ? COLORS.statSteril : COLORS.danger;
  return (
    <TouchableOpacity onPress={onPress} style={[cS.activityItem, { backgroundColor: T.card, borderColor: T.border }]} activeOpacity={0.7}>
      <View style={[cS.activityDot, { backgroundColor: c }]} />
      <View style={{ flex: 1 }}>
        <Text style={[cS.activityText, { color: T.text }]} numberOfLines={1}>{item.alat}</Text>
        <Text style={[cS.activitySub, { color: T.sub }]}>{item.tgl} • {item.petugas}</Text>
      </View>
      <View style={[cS.activityBadge, { backgroundColor: c + '20' }]}>
        <Text style={{ fontSize: 9, fontWeight: 'bold', color: c }}>{item.aksi}</Text>
      </View>
    </TouchableOpacity>
  );
});

const FilterCard = memo(({ label, value, color, isActive, onPress }) => {
  const T = useTheme();
  return (
    <PressableScale onPress={onPress} scaleTo={0.95}>
      <View style={[cS.filterCard, { borderLeftColor: color, backgroundColor: isActive ? color : T.card, elevation: isActive ? 8 : 3 }]}>
        <Text style={{ fontSize: 8, fontWeight: 'bold', color: isActive ? '#fff' : T.sub }}>{label}</Text>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: isActive ? '#fff' : color }}>{value}</Text>
      </View>
    </PressableScale>
  );
});

const NavButton = memo(({ icon, isActive, onPress }) => {
  const T = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={cS.navButton} activeOpacity={0.7}>
      {!isActive && <MaterialCommunityIcons name={icon} size={26} color={T.sub} />}
    </TouchableOpacity>
  );
});

const DetailRow = memo(({ icon, l, v }) => {
  const T = useTheme();
  return (
    <View style={[cS.detailRow, { borderColor: T.border }]}>
      <Ionicons name={icon} size={16} color={COLORS.primary} style={{ marginRight: 10 }} />
      <Text style={{ flex: 1, color: T.sub, fontSize: 12 }}>{l}</Text>
      <Text style={{ flex: 2, fontWeight: '600', color: T.text, textAlign: 'right', fontSize: 13 }}>{v || '-'}</Text>
    </View>
  );
});

const EmptyState = memo(({ icon, message }) => {
  const T = useTheme();
  return (
    <View style={cS.emptyState}>
      <MaterialCommunityIcons name={icon} size={60} color={T.sub} />
      <Text style={{ color: T.sub, marginTop: 15 }}>{message}</Text>
    </View>
  );
});

const SearchBar = memo(({ value, onChangeText, placeholder }) => {
  const T = useTheme();
  return (
    <View style={[cS.searchBar, { backgroundColor: T.card, borderColor: T.border }]}>
      <Ionicons name="search" size={20} color={T.sub} />
      <TextInput style={[cS.searchInput, { color: T.text }]} placeholder={placeholder || "Cari..."} placeholderTextColor={T.sub} value={value} onChangeText={onChangeText} />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close-circle" size={20} color={T.sub} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const cS = StyleSheet.create({
  miniStatCard: { flex: 1, marginHorizontal: 3, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', elevation: 3 },
  miniStatIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  miniStatValue: { fontSize: 18, fontWeight: 'bold' },
  miniStatLabel: { fontSize: 8, marginTop: 2, textAlign: 'center' },
  menuCardWrapper: { width: '48%', marginBottom: 12 },
  menuCard: { borderRadius: 16, overflow: 'hidden', elevation: 4, borderWidth: 1 },
  menuCardGradient: { padding: 14, alignItems: 'center' },
  menuIconCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 2 },
  menuLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  menuDesc: { fontSize: 9, textAlign: 'center' },
  activityItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  activityText: { fontSize: 13, fontWeight: '600' },
  activitySub: { fontSize: 10, marginTop: 2 },
  activityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  filterCard: { width: 85, height: 60, borderRadius: 12, marginRight: 8, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 4 },
  navButton: { padding: 10, width: TAB_WIDTH, alignItems: 'center', zIndex: 10 },
  detailRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 50 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10 },
});

// ================================================================
// ROW COMPONENTS
// ================================================================

const DashboardRow = memo(({ item, onPress, onEdit, onDelete, T }) => {
  const sc = getStatusColor(item.status);
  const days = getDaysRemaining(item.tglED);
  const dc = days !== null ? (days <= 0 ? COLORS.danger : days <= 7 ? COLORS.warning : COLORS.statSteril) : T.sub;

  return (
    <TouchableOpacity style={[dS.rowCard, { backgroundColor: T.card, borderLeftColor: sc }]} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 2 }}>
        <Text numberOfLines={1} style={{ fontWeight: 'bold', fontSize: 14, color: T.text }}>{item.alat}</Text>
        <Text style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{item.petugas}</Text>
      </View>
      <View style={{ flex: 1.5, alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: T.sub }}>ED: {formatDate(item.tglED)}</Text>
        {item.status !== 'KOTOR' && !item.tglPakai && days !== null && (
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: dc }}>{days} Hari</Text>
        )}
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <View style={[dS.statusBadge, { backgroundColor: sc }]}>
          <Text style={dS.statusText}>{item.status}</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <TouchableOpacity onPress={onEdit} style={{ padding: 4, marginRight: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="pencil" size={18} color={COLORS.warning} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="delete" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const dS = StyleSheet.create({
  rowCard: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 10, borderLeftWidth: 5, elevation: 2, alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: 'white', fontSize: 9, fontWeight: 'bold' }
});

const LaporanRow = memo(({ item, onPress, onEdit, T }) => {
  const isMasuk = item.aksi === 'MASUK';
  const ac = isMasuk ? COLORS.statSteril : COLORS.danger;
  return (
    <TouchableOpacity style={[lS.rowCard, { backgroundColor: T.card, borderLeftColor: ac }]} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 'bold', color: T.text, fontSize: 14 }}>{item.alat}</Text>
        <Text style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>📅 {formatDate(item.tgl)} • 👤 {item.petugas}</Text>
        <Text style={{ fontSize: 10, color: ac, marginTop: 3, fontStyle: 'italic' }}>📝 {getKeteranganLaporan(item)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={[lS.aksiBadge, { backgroundColor: ac }]}>
          <Text style={lS.aksiText}>{item.aksi}</Text>
        </View>
        <TouchableOpacity style={{ marginTop: 8, padding: 4 }} onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="pencil" size={18} color={COLORS.warning} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const lS = StyleSheet.create({
  rowCard: { flexDirection: 'row', marginBottom: 8, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 10, borderLeftWidth: 5, elevation: 2, alignItems: 'center' },
  aksiBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  aksiText: { fontSize: 10, fontWeight: 'bold', color: 'white' }
});

// ================================================================
// CHANGE PIN MODAL
// ================================================================

const ChangePinModal = memo(({ visible, onClose, currentUser }) => {
  const T = useTheme();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [showPins, setShowPins] = useState(false);

  const handleClose = useCallback(() => {
    setOldPin(''); setNewPin(''); setConfirmNew(''); setShowPins(false);
    onClose();
  }, [onClose]);

  const handleChange = useCallback(async () => {
    if (!oldPin.trim()) { Alert.alert('Error', 'PIN lama harus diisi'); return; }
    if (!newPin.trim() || newPin.length < 4) { Alert.alert('Error', 'PIN baru minimal 4 digit'); return; }
    if (!/^\d+$/.test(newPin)) { Alert.alert('Error', 'PIN harus angka'); return; }
    if (newPin !== confirmNew) { Alert.alert('Error', 'Konfirmasi PIN tidak cocok'); return; }
    if (oldPin === newPin) { Alert.alert('Error', 'PIN baru harus berbeda'); return; }

    setPinLoading(true);
    try {
      const res = await fetchWithTimeout(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changePin', data: { username: currentUser?.username, oldPin, newPin } })
      });
      const json = await res.json();
      if (json.status === 'success') { Alert.alert('✅ Berhasil', json.message); handleClose(); }
      else { Alert.alert('Gagal', json.message); }
    } catch (e) { Alert.alert('Error', e.message); }
    setPinLoading(false);
  }, [oldPin, newPin, confirmNew, currentUser, handleClose]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: T.card, padding: 25, borderRadius: 20 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.secondary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="key" size={24} color={COLORS.secondary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: T.text }}>Ubah PIN</Text>
            <Text style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>@{currentUser?.username}</Text>
          </View>
          <Text style={{ color: T.sub, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>PIN Lama</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 }}>
            <Ionicons name="lock-open" size={18} color={T.sub} />
            <TextInput style={{ flex: 1, padding: 14, color: T.text }} placeholder="PIN lama" placeholderTextColor={T.sub} value={oldPin} onChangeText={setOldPin} secureTextEntry={!showPins} keyboardType="number-pad" maxLength={6} />
          </View>
          <Text style={{ color: T.sub, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>PIN Baru</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 }}>
            <Ionicons name="lock-closed" size={18} color={T.sub} />
            <TextInput style={{ flex: 1, padding: 14, color: T.text }} placeholder="4-6 digit" placeholderTextColor={T.sub} value={newPin} onChangeText={setNewPin} secureTextEntry={!showPins} keyboardType="number-pad" maxLength={6} />
            <TouchableOpacity onPress={() => setShowPins(!showPins)}>
              <Ionicons name={showPins ? "eye-off" : "eye"} size={20} color={T.sub} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: T.sub, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>Konfirmasi PIN Baru</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 20 }}>
            <Ionicons name="shield-checkmark" size={18} color={T.sub} />
            <TextInput style={{ flex: 1, padding: 14, color: T.text }} placeholder="Ulangi PIN baru" placeholderTextColor={T.sub} value={confirmNew} onChangeText={setConfirmNew} secureTextEntry={!showPins} keyboardType="number-pad" maxLength={6} />
          </View>
          {confirmNew.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: -12 }}>
              <Ionicons name={newPin === confirmNew ? "checkmark-circle" : "close-circle"} size={14} color={newPin === confirmNew ? COLORS.success : COLORS.danger} />
              <Text style={{ color: newPin === confirmNew ? COLORS.success : COLORS.danger, fontSize: 11, marginLeft: 5 }}>
                {newPin === confirmNew ? 'PIN cocok ✓' : 'PIN tidak cocok'}
              </Text>
            </View>
          )}
          <TouchableOpacity style={{ backgroundColor: COLORS.primary, padding: 16, borderRadius: 14, alignItems: 'center', elevation: 3 }} onPress={handleChange} disabled={pinLoading}>
            {pinLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>UBAH PIN</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={{ alignSelf: 'center', marginTop: 15, padding: 12 }}>
            <Text style={{ color: COLORS.secondary, fontWeight: '600' }}>Batal</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// ================================================================
// HOOKS
// ================================================================

const useAnimatedNav = (initialIndex = 0) => {
  const indicatorWidth = 60;
  const navAnim = useRef(new Animated.Value((initialIndex * TAB_WIDTH) + (TAB_WIDTH / 2) - (indicatorWidth / 2))).current;
  const animateToIndex = useCallback((i) => {
    Animated.spring(navAnim, {
      toValue: (i * TAB_WIDTH) + (TAB_WIDTH / 2) - (indicatorWidth / 2),
      useNativeDriver: true, friction: 7, tension: 50
    }).start();
  }, [navAnim]);
  return { navAnim, animateToIndex };
};

const useNavigationStack = (initialView = 'home') => {
  const [view, setView] = useState(initialView);
  const [stack, setStack] = useState([initialView]);
  const navigate = useCallback((newView) => {
    if (newView === view) return false;
    setStack(prev => {
      const newStack = [...prev, newView];
      if (newStack.length > MAX_NAV_STACK) return newStack.slice(newStack.length - MAX_NAV_STACK);
      return newStack;
    });
    setView(newView);
    return true;
  }, [view]);
  const goBack = useCallback(() => {
    if (stack.length <= 1) return null;
    const newStack = stack.slice(0, -1);
    setStack(newStack);
    const previousView = newStack[newStack.length - 1];
    setView(previousView);
    return previousView;
  }, [stack]);
  return { view, navigate, goBack, canGoBack: stack.length > 1 };
};

const useSortable = (defaultField = null, defaultOrder = 'asc') => {
  const [sortField, setSortField] = useState(defaultField);
  const [sortOrder, setSortOrder] = useState(defaultOrder);
  const toggleSort = useCallback((field) => {
    if (sortField !== field) { setSortField(field); setSortOrder('asc'); return 'asc'; }
    if (sortOrder === 'asc') { setSortOrder('desc'); return 'desc'; }
    setSortField(null); setSortOrder('asc'); return null;
  }, [sortField, sortOrder]);
  return { sortField, sortOrder, toggleSort };
};

// ================================================================
// MAIN APP
// ================================================================

export default function App() {
  const [isShowSplash, setIsShowSplash] = useState(true);
  const [mode, setMode] = useState('light');
  const T = THEME[mode];

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', pin: '', nama: '', role: 'petugas' });
  const [editingUser, setEditingUser] = useState(null);
  const [showChangePin, setShowChangePin] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

  const { view, navigate, goBack, canGoBack } = useNavigationStack('home');
  const { navAnim, animateToIndex } = useAnimatedNav(0);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [dashData, setDashData] = useState([]);
  const [stats, setStats] = useState({ ...INITIAL_STATS });
  const [dropdownList, setDropdownList] = useState({ petugas: [], alat: [] });
  const [histData, setHistData] = useState([]);
  const [isiSet, setIsiSet] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [statistikData, setStatistikData] = useState(null);

  const [statBulan, setStatBulan] = useState(new Date().getMonth());
  const [statTahun, setStatTahun] = useState(new Date().getFullYear().toString());

  const dashSort = useSortable(null, 'asc');
  const laporanSort = useSortable('tgl', 'desc');

  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('TOTAL');
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isiSetSearch, setIsiSetSearch] = useState('');
  const [selectedSet, setSelectedSet] = useState(null);
  const [showSetDropdown, setShowSetDropdown] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalSearch, setModalSearch] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const [detailSource, setDetailSource] = useState('');
  const [showPicker, setShowPicker] = useState(null);
  const [cetakOptions, setCetakOptions] = useState(false);
  const [cetakStatistik, setCetakStatistik] = useState(false);
  const [statChartType, setStatChartType] = useState('bar');
  const [alasanModal, setAlasanModal] = useState(false);
  const [alasanText, setAlasanText] = useState('');
  const [alasanAction, setAlasanAction] = useState('');
  const [tempHist, setTempHist] = useState(null);
  const [exportStatus, setExportStatus] = useState('');
  const [lapBulan, setLapBulan] = useState(new Date().getMonth()); // ★ bisa bernilai 'semua'
  const [lapTahun, setLapTahun] = useState(new Date().getFullYear().toString());

  // ============ HAND OVER STATE ============
  const [hoTanggal, setHoTanggal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [hoLoading, setHoLoading] = useState(false);
  const [hoSheetExists, setHoSheetExists] = useState(false);
  const [hoSheetName, setHoSheetName] = useState('');
  const [hoExpandedIdx, setHoExpandedIdx] = useState(0);
  const [hoActiveShift, setHoActiveShift] = useState('pagi');
  const [hoPasien, setHoPasien] = useState(
    Array.from({ length: 6 }, (_, i) => ({
      no: i + 1, identitas: '', diagnosa: '', tindakan: '',
      dpjp: '', pagi: '', sore: '', malam: ''
    }))
  );
  const [hoSerahTerima, setHoSerahTerima] = useState({
    pagi: { menyerahkan: '', menerima: '' },
    sore: { menyerahkan: '', menerima: '' },
    malam: { menyerahkan: '', menerima: '' }
  });
  const [hoRiwayat, setHoRiwayat] = useState([]);
  const [hoShowRiwayat, setHoShowRiwayat] = useState(false);
  const [hoDetailPasien, setHoDetailPasien] = useState(null);
  const [hoSelectTarget, setHoSelectTarget] = useState(null);
  const [hoJumlahPasien, setHoJumlahPasien] = useState(6);
  const [hoMultiSelect, setHoMultiSelect] = useState([]);
  const [hoShowPreview, setHoShowPreview] = useState(false);

  const hoFilledPasienCount = useMemo(() => {
    return hoPasien.filter(p => p.identitas?.trim()).length;
  }, [hoPasien]);

  // ★ ADDED: helper label periode laporan
  const lapPeriodLabel = useMemo(() => {
    if (lapBulan === 'semua') return `Semua Bulan ${lapTahun}`;
    const bulanIdx = typeof lapBulan === 'number' ? lapBulan : parseInt(lapBulan);
    if (isNaN(bulanIdx) || bulanIdx < 0 || bulanIdx > 11) return lapTahun;
    return `${MONTHS[bulanIdx]} ${lapTahun}`;
  }, [lapBulan, lapTahun]);

  const mountedRef = useRef(true);
  const expiredLoggedRef = useRef(false);
  const loadingTimeoutRef = useRef(null);
  const hoTanggalRef = useRef(hoTanggal);
  hoTanggalRef.current = hoTanggal;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); }
      catch (e) { console.log('Orientation lock failed:', e.message); }
    })();
  }, []);

  useEffect(() => {
    if (loading) {
      loadingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) { setLoading(false); setExportStatus(''); showToast('Request timeout. Coba lagi.'); }
      }, 30000);
    } else {
      if (loadingTimeoutRef.current) { clearTimeout(loadingTimeoutRef.current); loadingTimeoutRef.current = null; }
    }
    return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); };
  }, [loading]);

  // ================================================================
  // AUTH & SESSION
  // ================================================================

  const handleLogin = useCallback(async (username, pin) => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', data: { username, pin } })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setCurrentUser(json.user); setIsLoggedIn(true);
        showToast(`Selamat datang, ${json.user.nama}!`);
      } else { Alert.alert('Login Gagal', json.message || 'Username atau PIN salah'); }
    } catch (e) { Alert.alert('Error', e.message); }
    if (mountedRef.current) setLoading(false);
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Yakin ingin keluar?', [
      { text: 'Batal' },
      {
        text: 'Keluar', style: 'destructive', onPress: () => {
          setIsLoggedIn(false); setCurrentUser(null); setSidebar(false);
          expiredLoggedRef.current = false;
          setDashData([]); setHistData([]); setRecentActivity([]); setStatistikData(null);
        }
      }
    ]);
  }, []);

  const autoLogExpired = useCallback(async (dd, ld) => {
    if (!dd?.length || expiredLoggedRef.current) return;
    const ei = dd.filter(i => {
      if (!i.tglED || i.tglPakai || i.status !== 'EXPIRED') return false;
      return !(ld || []).some(l =>
        l.alat === i.alat && l.aksi === 'KELUAR' &&
        ((l.ket || '').toLowerCase().includes('expired') || (l.ket || '').toLowerCase().includes('kadaluarsa'))
      );
    });
    if (!ei.length) return;
    let ok = 0;
    for (const i of ei) {
      try {
        await fetchWithTimeout(API_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logExpired', data: { alat: i.alat, petugas: i.petugas, tgl: i.tglED } })
        }, 10000);
        ok++;
      } catch (e) { console.log('autoLogExpired item error:', e.message); }
    }
    expiredLoggedRef.current = true;
    if (ok > 0 && mountedRef.current) { showToast(`${ok} alat expired tercatat`); fetchData('getLaporan'); }
  }, []);

  // ================================================================
  // NAVIGATION
  // ================================================================

  const changeView = useCallback((v, params = {}) => {
    if (v === 'sidebar') { setSidebar(true); return; }
    const did = navigate(v);
    if (!did) return;
    setSearch(''); setShowSearch(false);
    if (params.filter) setCurrentFilter(params.filter);
    if (v === 'input' && !params.edit) { setIsEditMode(false); setForm({ ...INITIAL_FORM }); }
    const idx = NAV_ITEMS.findIndex(n => n.key === v);
    if (idx >= 0) animateToIndex(idx);
  }, [navigate, animateToIndex]);

  const handleGoBack = useCallback(() => {
    const p = goBack();
    if (p) { const i = NAV_ITEMS.findIndex(n => n.key === p); if (i >= 0) animateToIndex(i); }
  }, [goBack, animateToIndex]);

  // ================================================================
  // FILTERED DATA — ★ CHANGED: support lapBulan === 'semua'
  // ================================================================

  const safeParseLaporanDate = useCallback((tgl) => {
    if (!tgl) return null;
    const d = new Date(tgl);
    if (!isNaN(d.getTime())) return d;
    if (typeof tgl === 'string') {
      const parts = tgl.split('-');
      if (parts.length === 3) {
        const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(dt.getTime())) return dt;
      }
    }
    return null;
  }, []);

  const filteredDashData = useMemo(() => {
    let t = dashData;
    if (currentFilter !== 'TOTAL') t = t.filter(i => i.status === currentFilter);
    if (search) { const q = search.toLowerCase(); t = t.filter(i => i.alat?.toLowerCase().includes(q) || i.petugas?.toLowerCase().includes(q)); }
    if (dashSort.sortField) {
      t = [...t].sort((a, b) => {
        if (dashSort.sortField === 'alat') { const c = (a.alat || '').localeCompare(b.alat || ''); return dashSort.sortOrder === 'asc' ? c : -c; }
        if (dashSort.sortField === 'sisa') { return dashSort.sortOrder === 'asc' ? (a.sisa ?? 9999) - (b.sisa ?? 9999) : (b.sisa ?? 9999) - (a.sisa ?? 9999); }
        return 0;
      });
    }
    return t;
  }, [dashData, currentFilter, search, dashSort.sortField, dashSort.sortOrder]);

  // ★ CHANGED: filteredReport support 'semua' bulan
  const filteredReport = useMemo(() => {
    let t = histData.filter(i => {
      const d = safeParseLaporanDate(i.tgl);
      if (!d) return false;
      if (d.getFullYear().toString() !== lapTahun) return false;
      if (lapBulan !== 'semua') {
        const bulanIdx = typeof lapBulan === 'number' ? lapBulan : parseInt(lapBulan);
        if (!isNaN(bulanIdx) && d.getMonth() !== bulanIdx) return false;
      }
      return true;
    });
    if (search) { const q = search.toLowerCase(); t = t.filter(i => i.alat?.toLowerCase().includes(q) || i.petugas?.toLowerCase().includes(q)); }
    t = [...t].sort((a, b) => {
      if (laporanSort.sortField === 'tgl') return laporanSort.sortOrder === 'asc' ? parseDateTime(a.tgl) - parseDateTime(b.tgl) : parseDateTime(b.tgl) - parseDateTime(a.tgl);
      if (laporanSort.sortField === 'alat') { const c = (a.alat || '').localeCompare(b.alat || ''); return laporanSort.sortOrder === 'asc' ? c : -c; }
      return 0;
    });
    return t;
  }, [histData, lapBulan, lapTahun, search, laporanSort.sortField, laporanSort.sortOrder, safeParseLaporanDate]);

  // ★ CHANGED: exportData support 'semua' bulan
  const exportData = useMemo(() => {
    let t = histData.filter(i => {
      const d = safeParseLaporanDate(i.tgl);
      if (!d) return false;
      if (d.getFullYear().toString() !== lapTahun) return false;
      if (lapBulan !== 'semua') {
        const bulanIdx = typeof lapBulan === 'number' ? lapBulan : parseInt(lapBulan);
        if (!isNaN(bulanIdx) && d.getMonth() !== bulanIdx) return false;
      }
      return true;
    });
    if (search) { const q = search.toLowerCase(); t = t.filter(i => i.alat?.toLowerCase().includes(q) || i.petugas?.toLowerCase().includes(q)); }
    return [...t].sort((a, b) => parseDateTime(a.tgl) - parseDateTime(b.tgl));
  }, [histData, lapBulan, lapTahun, search, safeParseLaporanDate]);

  const reportStats = useMemo(() => ({
    total: filteredReport.length,
    masuk: filteredReport.filter(d => d.aksi === 'MASUK').length,
    keluar: filteredReport.filter(d => d.aksi === 'KELUAR').length
  }), [filteredReport]);

  const statPeriodLabel = useMemo(() => {
    if (statBulan === 'semua') return `${statTahun}`;
    const bulanIdx = typeof statBulan === 'number' ? statBulan : parseInt(statBulan);
    if (isNaN(bulanIdx) || bulanIdx < 0 || bulanIdx > 11) return `${statTahun}`;
    return `${MONTHS_SHORT[bulanIdx]} ${statTahun}`;
  }, [statBulan, statTahun]);

  // ================================================================
  // DATA FETCHING
  // ================================================================

  const fetchData = useCallback(async (act, sl = false) => {
    if (sl) setLoading(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}?action=${act}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!mountedRef.current) return;
      InteractionManager.runAfterInteractions(() => {
        if (!mountedRef.current) return;
        switch (act) {
          case 'getDashboard': setDashData(json.data || []); setStats(json.stats || { ...INITIAL_STATS }); setCurrentFilter('TOTAL'); break;
          case 'getList': setDropdownList(json || { petugas: [], alat: [] }); break;
          case 'getIsiSet': setIsiSet(json || []); break;
          case 'getLaporan': {
            const s = (json || []).sort((a, b) => parseDateTime(b.tgl) - parseDateTime(a.tgl));
            setHistData(s); setRecentActivity(s.slice(0, 5)); break;
          }
          case 'getUsers': setUsers(json || []); break;
          default: break;
        }
      });
    } catch (e) { if (mountedRef.current && sl) Alert.alert("Error", e.message); }
    if (sl && mountedRef.current) setLoading(false);
  }, []);

  const fetchStatistik = useCallback(async (bulan, tahun, sl = false) => {
    if (sl) setLoading(true);
    try {
      const url = `${API_URL}?action=getStatistik&bulan=${bulan === 'semua' ? 'semua' : bulan}&tahun=${tahun}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (mountedRef.current) InteractionManager.runAfterInteractions(() => { if (mountedRef.current) setStatistikData(json || null); });
    } catch (e) { if (mountedRef.current && sl) Alert.alert("Error", e.message); }
    if (sl && mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchStatistik(statBulan, statTahun, true);
  }, [isLoggedIn, statBulan, statTahun, fetchStatistik]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const init = async () => {
      try {
        const [dR, lR] = await Promise.all([
          fetchWithTimeout(`${API_URL}?action=getDashboard`),
          fetchWithTimeout(`${API_URL}?action=getLaporan`)
        ]);
        const dJ = await dR.json(); const lJ = await lR.json();
        if (!mountedRef.current) return;
        const dd = dJ.data || [];
        setDashData(dd); setStats(dJ.stats || { ...INITIAL_STATS });
        const ld = (lJ || []).sort((a, b) => parseDateTime(b.tgl) - parseDateTime(a.tgl));
        setHistData(ld); setRecentActivity(ld.slice(0, 5));
        await autoLogExpired(dd, ld);
        fetchData('getList'); fetchData('getIsiSet');
        if (isAdmin) fetchData('getUsers');
      } catch (e) {
        console.log('Init error:', e.message);
        if (mountedRef.current) {
          try { await Promise.all([fetchData('getDashboard'), fetchData('getLaporan'), fetchData('getList'), fetchData('getIsiSet')]); }
          catch (fe) { console.log('Fallback error:', fe.message); }
        }
      }
    };
    init();
  }, [isLoggedIn, isAdmin]);

  // ================================================================
  // API SUBMIT
  // ================================================================

  const kirim = useCallback(async (act, body) => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, data: body })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status === 'error') { Alert.alert('Gagal', json.message || 'Terjadi kesalahan'); if (mountedRef.current) setLoading(false); return; }
      showToast(json.message || "Berhasil!");
      if (act === 'simpanData' || act === 'updateData' || act === 'hapusData') {
        setDetailItem(null); changeView('dashboard');
        fetchData('getDashboard', true); fetchData('getLaporan'); fetchStatistik(statBulan, statTahun);
      }
      if (act === 'editLaporan' || act === 'hapusLaporan') {
        setAlasanModal(false); setAlasanText('');
        fetchData('getLaporan', true); fetchStatistik(statBulan, statTahun); setDetailItem(null);
      }
      if (act === 'tambahUser' || act === 'hapusUser' || act === 'updateUser') {
        fetchData('getUsers'); setShowUserModal(false);
        setUserForm({ username: '', pin: '', nama: '', role: 'petugas' }); setEditingUser(null);
      }
      if (act === 'simpanHandOver') { setHoSheetExists(true); }
    } catch (e) { Alert.alert("Gagal", e.message); }
    if (mountedRef.current) setLoading(false);
  }, [changeView, fetchData, fetchStatistik, statBulan, statTahun]);

  // ================================================================
  // HANDLERS
  // ================================================================

  const handleDashSort = useCallback((f) => { const r = dashSort.toggleSort(f); if (r === null) showToast("Default"); else showToast(`Urut: ${f === 'alat' ? (r === 'asc' ? 'A-Z' : 'Z-A') : (r === 'asc' ? '↑' : '↓')}`); }, [dashSort]);
  const handleLaporanSort = useCallback((f) => { const r = laporanSort.toggleSort(f); if (r) showToast(`Urut: ${f === 'tgl' ? (r === 'asc' ? 'Lama→Baru' : 'Baru→Lama') : (r === 'asc' ? 'A-Z' : 'Z-A')}`); }, [laporanSort]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); expiredLoggedRef.current = false;
    try {
      const [dR, lR] = await Promise.all([
        fetchWithTimeout(`${API_URL}?action=getDashboard`),
        fetchWithTimeout(`${API_URL}?action=getLaporan`)
      ]);
      const dJ = await dR.json(); const lJ = await lR.json();
      if (!mountedRef.current) return;
      const dd = dJ.data || []; setDashData(dd); setStats(dJ.stats || { ...INITIAL_STATS });
      const ld = (lJ || []).sort((a, b) => parseDateTime(b.tgl) - parseDateTime(a.tgl));
      setHistData(ld); setRecentActivity(ld.slice(0, 5));
      await autoLogExpired(dd, ld); fetchStatistik(statBulan, statTahun);
    } catch (e) { console.log('Refresh error:', e.message); }
    if (mountedRef.current) setRefreshing(false);
  }, [autoLogExpired, fetchStatistik, statBulan, statTahun]);

  const handleSubmitForm = useCallback(() => {
    const e = validateForm(form, isEditMode);
    if (e.length > 0) { Alert.alert("Lengkapi", e.join('\n')); return; }
    kirim(isEditMode ? 'updateData' : 'simpanData', form);
  }, [form, isEditMode, kirim]);

  const handleEditFromDashboard = useCallback((i) => {
    setIsEditMode(true);
    setForm({
      id: i.id, petugas: i.petugas, instrument: i.alat,
      tglSteril: i.tglSteril, tglED: i.tglED,
      tglPakai: (!i.tglPakai || i.tglPakai === '-') ? '' : i.tglPakai,
      keterangan: i.ket || ''
    });
    changeView('input', { edit: true });
  }, [changeView, isAdmin]);

  const handleDeleteItem = useCallback((i) => { 
    Alert.alert("Hapus?", `"${i.alat}"`, [
      { text: "Batal" },
      { text: "Hapus", style: 'destructive', onPress: () => kirim('hapusData', { id: i.id }) }
    ]);
  }, [kirim, isAdmin]);

  const handleEditLaporanSubmit = useCallback(() => {
    if (tempHist?.tgl !== detailItem?.tgl) {
      setAlasanAction('editTanggal'); setAlasanText(''); setAlasanModal(true);
    } else {
      kirim('editLaporan', { id: tempHist.id, tanggal: tempHist.tgl, keterangan: tempHist.ket, alasan: 'Edit Keterangan' });
    }
  }, [tempHist, detailItem, kirim, isAdmin]);

  const handleAlasanSubmit = useCallback(() => {
    if (alasanText.trim().split(/\s+/).length < MIN_ALASAN_WORDS) {
      Alert.alert("Ditolak", `Minimal ${MIN_ALASAN_WORDS} kata`); return;
    }
    if (alasanAction === 'hapusLapor') kirim('hapusLaporan', { id: tempHist.id, alasan: alasanText });
    else if (alasanAction === 'editTanggal') kirim('editLaporan', { id: tempHist.id, tanggal: tempHist.tgl, keterangan: tempHist.ket, alasan: alasanText });
  }, [alasanAction, alasanText, tempHist, kirim]);

  // ================================================================
  // MODAL SELECT — ★ CHANGED: case 'bulan' support 'Semua Bulan'
  // ================================================================

  const toggleHoMultiSelect = useCallback((name) => {
    setHoMultiSelect(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      return [...prev, name];
    });
  }, []);

  const handleModalSelect = useCallback((i) => {
    if (modalType === 'hoMultiPetugas') { toggleHoMultiSelect(i); return; }
    switch (modalType) {
      case 'petugas': setForm(p => ({ ...p, petugas: i })); break;
      case 'alat': setForm(p => ({ ...p, instrument: i })); break;
      // ★ CHANGED: support 'Semua Bulan' untuk laporan
      case 'bulan': {
        if (i === 'Semua Bulan') { setLapBulan('semua'); }
        else { const idx = MONTHS.indexOf(i); if (idx >= 0) setLapBulan(idx); }
        break;
      }
      case 'tahun': setLapTahun(i); break;
      case 'statBulan': {
        if (i === 'Semua Bulan') setStatBulan('semua');
        else { const idx = MONTHS.indexOf(i); if (idx >= 0) setStatBulan(idx); }
        break;
      }
      case 'statTahun': setStatTahun(i); break;
      default: break;
    }
    setModalVisible(false); setModalSearch('');
  }, [modalType, toggleHoMultiSelect]);

  const toggleMode = useCallback(() => setMode(p => p === 'light' ? 'dark' : 'light'), []);
  const closeDetail = useCallback(() => { setDetailItem(null); setDetailSource(''); }, []);
  // ================================================================
  // DATE PICKER
  // ================================================================

  const getPickerDate = useCallback(() => {
    if (!showPicker) return new Date();
    const tryParse = (s) => { if (!s) return new Date(); const d = new Date(s); return isNaN(d.getTime()) ? new Date() : d; };
    switch (showPicker) {
      case 'steril': return tryParse(form.tglSteril);
      case 'ed': return tryParse(form.tglED);
      case 'pakai': return tryParse(form.tglPakai);
      case 'lapor': return tryParse(tempHist?.tgl);
      case 'handover': return tryParse(hoTanggal);
      default: return new Date();
    }
  }, [showPicker, form.tglSteril, form.tglED, form.tglPakai, tempHist, hoTanggal]);

  const onDateChange = useCallback((e, d) => {
    const pt = showPicker; setShowPicker(null); if (!d) return;
    const s = d.toISOString().split('T')[0];
    switch (pt) {
      case 'steril': {
        const n = new Date(d); n.setDate(n.getDate() + STERIL_DAYS);
        setForm(p => ({ ...p, tglSteril: s, tglED: n.toISOString().split('T')[0] }));
        break;
      }
      case 'ed': setForm(p => ({ ...p, tglED: s })); break;
      case 'pakai': setForm(p => ({ ...p, tglPakai: s })); break;
      case 'lapor': setTempHist(p => ({ ...p, tgl: s })); break;
      case 'handover': setHoTanggal(s); fetchHandOver(s); break;
      default: break;
    }
  }, [showPicker, fetchHandOver]);

  // ================================================================
  // PDF GENERATION — LAPORAN — ★ CHANGED: support 'semua' bulan
  // ================================================================

  const generatePDFHTML = useCallback((data) => {
    const tM = data.filter(d => d.aksi === 'MASUK').length;
    const tK = data.filter(d => d.aksi === 'KELUAR').length;
    // ★ CHANGED: gunakan lapPeriodLabel
    const periodLabel = lapPeriodLabel;
    const rows = data.map((i, idx) => {
      const bg = i.aksi === 'MASUK' ? '#00cec9' : '#ff3f34';
      return `<tr><td style="text-align:center;padding:8px;border:1px solid #ddd">${idx + 1}</td><td style="padding:8px;border:1px solid #ddd">${formatDateExcel(i.tgl)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(i.alat)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(i.petugas)}</td><td style="text-align:center;padding:8px;border:1px solid #ddd"><span style="background:${bg};color:#fff;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:bold">${escapeHtml(i.aksi || '-')}</span></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(getKeteranganLaporan(i))}</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;padding:20px;font-size:12px}.header{text-align:center;margin-bottom:25px;padding-bottom:20px;border-bottom:3px solid #6c5ce7}.header h1{color:#6c5ce7;font-size:22px}.period{background:#6c5ce7;color:white;padding:5px 15px;border-radius:20px;display:inline-block;margin-top:10px;font-weight:bold}.stats{display:flex;justify-content:center;gap:40px;margin-bottom:20px;padding:15px;background:#f8f9fa;border-radius:10px}.stat-item{text-align:center}.stat-value{font-size:24px;font-weight:bold;color:#6c5ce7}.stat-label{font-size:10px;color:#666}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#6c5ce7;color:#fff;padding:12px 8px;text-align:left;font-size:10px}td{border:1px solid #ddd;padding:8px}tr:nth-child(even){background:#f8f9fa}.footer{margin-top:30px;text-align:center;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:20px}</style></head><body><div class="header"><h1>📋 LAPORAN SIMAS</h1><p>IBS RSJD Amino</p><div class="period">${escapeHtml(periodLabel)}</div></div><div class="stats"><div class="stat-item"><div class="stat-value">${data.length}</div><div class="stat-label">Total</div></div><div class="stat-item"><div class="stat-value" style="color:#00cec9">${tM}</div><div class="stat-label">Masuk</div></div><div class="stat-item"><div class="stat-value" style="color:#ff3f34">${tK}</div><div class="stat-label">Keluar</div></div></div><table><thead><tr><th style="width:5%;text-align:center">No</th><th style="width:12%">Tanggal</th><th style="width:28%">Alat</th><th style="width:15%">Petugas</th><th style="width:10%;text-align:center">Status</th><th style="width:30%">Keterangan</th></tr></thead><tbody>${rows}</tbody></table><div class="footer"><p>Dicetak: ${new Date().toLocaleString('id-ID')} | Oleh: ${escapeHtml(currentUser?.nama || '-')}</p><p>SIMAS ${APP_VERSION}</p></div></body></html>`;
  }, [lapPeriodLabel, currentUser]);

  const cetakPDFLangsung = useCallback(async () => {
    if (!exportData?.length) { Alert.alert("Kosong", "Tidak ada data"); return; }
    setLoading(true); setExportStatus('Mencetak...');
    try {
      const h = generatePDFHTML(exportData);
      if (Platform.OS === 'web') { const w = window.open('', '_blank'); if (w) { w.document.write(h); w.document.close(); setTimeout(() => w.print(), 500); } }
      else await Print.printAsync({ html: h });
      setCetakOptions(false); showToast('Berhasil!');
    } catch (e) { Alert.alert('Gagal', e.message); }
    finally { if (mountedRef.current) { setLoading(false); setExportStatus(''); } }
  }, [exportData, generatePDFHTML]);

  const downloadPDF = useCallback(async () => {
    if (!exportData?.length) { Alert.alert("Kosong", "Tidak ada data"); return; }
    setLoading(true); setExportStatus('Membuat PDF...');
    try {
      const h = generatePDFHTML(exportData);
      if (Platform.OS === 'web') { const w = window.open('', '_blank'); if (w) { w.document.write(h); w.document.close(); } }
      else { const { uri } = await Print.printToFileAsync({ html: h }); const ok = await Sharing.isAvailableAsync(); if (ok) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf' }); showToast('Berhasil!'); } else Alert.alert('OK', 'PDF disimpan'); }
      setCetakOptions(false);
    } catch (e) { Alert.alert('Gagal', e.message); }
    finally { if (mountedRef.current) { setLoading(false); setExportStatus(''); } }
  }, [exportData, generatePDFHTML]);

  // ================================================================
  // ★ STATISTIK PDF — SVG CHARTS (Pie + Bar + Line) ★
  // ================================================================

  const generateStatistikPDFHTML = useCallback(() => {
    const data = statistikData;
    if (!data) return '<html><body><p>Tidak ada data statistik</p></body></html>';

    const period = statBulan === 'semua' ? `Semua Bulan ${statTahun}` : `${MONTHS[statBulan]} ${statTahun}`;
    const sc = data.statusCount || { steril: 0, expired: 0, edHariIni: 0, kotor: 0 };
    const chartType = statChartType;

    const svgPie = (items, size) => {
      const cx = size / 2, cy = size / 2, r = size / 2 - 8;
      const total = items.reduce((a, b) => a + b.value, 0);
      if (total === 0) return `<svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#f0f0f0"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="14" fill="#999">0</text></svg>`;
      let paths = ''; let currentAngle = -90;
      items.forEach(item => {
        if (item.value <= 0) return;
        const angle = (item.value / total) * 360;
        if (angle >= 359.99) { paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${item.color}"/>`; }
        else {
          const sR = (currentAngle * Math.PI) / 180; const eR = ((currentAngle + angle) * Math.PI) / 180;
          const x1 = cx + r * Math.cos(sR); const y1 = cy + r * Math.sin(sR);
          const x2 = cx + r * Math.cos(eR); const y2 = cy + r * Math.sin(eR);
          paths += `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${item.color}"/>`;
        }
        currentAngle += angle;
      });
      const ir = r * 0.42;
      paths += `<circle cx="${cx}" cy="${cy}" r="${ir}" fill="white"/>`;
      paths += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">${total}</text>`;
      paths += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#888">TOTAL</text>`;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
    };

    const svgPieWithLegend = (items, title, size) => {
      const total = items.reduce((a, b) => a + b.value, 0);
      let legend = '';
      items.forEach(item => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        legend += `<div style="display:flex;align-items:center;margin-bottom:8px"><div style="width:14px;height:14px;border-radius:7px;background:${item.color};margin-right:10px;flex-shrink:0"></div><span style="flex:1;font-size:12px">${item.label}</span><span style="font-weight:bold;font-size:14px;color:${item.color};margin-right:6px">${item.value}</span><span style="font-size:10px;color:#888">(${pct}%)</span></div>`;
      });
      return `<div style="display:flex;align-items:center;gap:30px">${svgPie(items, size)}<div style="flex:1">${legend}${total === 0 ? '<p style="color:#999;font-size:11px;font-style:italic;margin-top:8px">Tidak ada data</p>' : ''}</div></div>`;
    };

    const svgBarChart = (series, labels, w, h) => {
      const pad = { t: 30, r: 15, b: 40, l: 40 }; const cW = w - pad.l - pad.r; const cH = h - pad.t - pad.b;
      const n = labels.length; const ns = series.length; const maxV = Math.max(...series.flatMap(s => s.data), 1);
      const groupW = cW / n; const barW = (groupW * 0.65) / ns; const gapL = groupW * 0.175;
      let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.15"/></filter></defs>`;
      for (let i = 0; i <= 5; i++) { const y = pad.t + (cH / 5) * i; const v = Math.round(maxV - (maxV / 5) * i); svg += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#eee"/><text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="#999">${v}</text>`; }
      for (let i = 0; i < n; i++) { const gx = pad.l + i * groupW; series.forEach((s, si) => { const v = s.data[i] || 0; const bh = Math.max((v / maxV) * cH, 0); const x = gx + gapL + si * barW; const y = pad.t + cH - bh; svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${s.color}" rx="3" filter="url(#shadow)"/>`; if (v > 0) svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="7" font-weight="bold" fill="${s.color}">${v}</text>`; }); svg += `<text x="${(gx + groupW / 2).toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="8" fill="#666">${labels[i]}</text>`; }
      svg += `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + cH}" stroke="#ddd"/><line x1="${pad.l}" y1="${pad.t + cH}" x2="${w - pad.r}" y2="${pad.t + cH}" stroke="#ddd"/>`;
      let lx = pad.l; series.forEach(s => { svg += `<rect x="${lx}" y="5" width="10" height="10" fill="${s.color}" rx="2"/><text x="${lx + 14}" y="14" font-size="9" fill="#666">${s.label}</text>`; lx += 14 + s.label.length * 5.5 + 15; });
      svg += `</svg>`; return svg;
    };

    const svgLineChart = (series, labels, w, h) => {
      const pad = { t: 30, r: 15, b: 40, l: 40 }; const cW = w - pad.l - pad.r; const cH = h - pad.t - pad.b;
      const n = labels.length; const maxV = Math.max(...series.flatMap(s => s.data), 1);
      let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
      for (let i = 0; i <= 5; i++) { const y = pad.t + (cH / 5) * i; const v = Math.round(maxV - (maxV / 5) * i); svg += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#eee"/><text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="#999">${v}</text>`; }
      series.forEach(s => {
        const pts = []; const stepX = cW / (n > 1 ? n - 1 : 1);
        for (let i = 0; i < n; i++) { const x = pad.l + i * stepX; const v = s.data[i] || 0; const y = pad.t + cH - (v / maxV) * cH; pts.push({ x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)), v }); }
        const pStr = pts.map(p => `${p.x},${p.y}`).join(' ');
        svg += `<polygon points="${pStr} ${pts[pts.length - 1].x},${pad.t + cH} ${pts[0].x},${pad.t + cH}" fill="${s.color}" opacity="0.08"/>`;
        svg += `<polyline points="${pStr}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
        pts.forEach(p => { svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="${s.color}" stroke-width="2.5"/>`; if (p.v > 0) svg += `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="8" font-weight="bold" fill="${s.color}">${p.v}</text>`; });
      });
      for (let i = 0; i < n; i++) { const stepX = cW / (n > 1 ? n - 1 : 1); svg += `<text x="${(pad.l + i * stepX).toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="8" fill="#666">${labels[i]}</text>`; }
      svg += `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + cH}" stroke="#ddd"/><line x1="${pad.l}" y1="${pad.t + cH}" x2="${w - pad.r}" y2="${pad.t + cH}" stroke="#ddd"/>`;
      let lx = pad.l; series.forEach(s => { svg += `<line x1="${lx}" y1="10" x2="${lx + 15}" y2="10" stroke="${s.color}" stroke-width="3" stroke-linecap="round"/><circle cx="${lx + 7.5}" cy="10" r="3" fill="white" stroke="${s.color}" stroke-width="2"/><text x="${lx + 20}" y="14" font-size="9" fill="#666">${s.label}</text>`; lx += 20 + s.label.length * 5.5 + 15; });
      svg += `</svg>`; return svg;
    };

    const svgHBar = (items, maxItems, w) => {
      const sliced = items.slice(0, maxItems);
      if (sliced.length === 0) return '<p style="color:#888;text-align:center;padding:20px;font-size:12px">Belum ada data</p>';
      const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff7675', '#00b894', '#e17055', '#0984e3'];
      const mx = Math.max(...sliced.map(a => a.jumlah), 1); const barH = 24; const gap = 10; const padL = 140; const padR = 55; const padT = 5;
      const svgH = padT + sliced.length * (barH + gap) + 5;
      let svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}">`;
      sliced.forEach((item, i) => { const y = padT + i * (barH + gap); const bw = (item.jumlah / mx) * (w - padL - padR); const c = colors[i % colors.length]; svg += `<text x="${padL - 10}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="10" fill="#333">${escapeHtml(String(item.nama).substring(0, 22))}</text><rect x="${padL}" y="${y}" width="${w - padL - padR}" height="${barH}" fill="#f5f5f5" rx="4"/><rect x="${padL}" y="${y}" width="${Math.max(bw, 4).toFixed(1)}" height="${barH}" fill="${c}" rx="4"/><text x="${padL + bw + 8}" y="${y + barH / 2 + 4}" font-size="11" font-weight="bold" fill="${c}">${item.jumlah}x</text>`; });
      svg += `</svg>`; return svg;
    };

    const monthlySeries = [
      { data: (data.monthly || []).map(m => m.masuk), color: '#00cec9', label: 'Masuk' },
      { data: (data.monthly || []).map(m => m.keluar), color: '#ff3f34', label: 'Keluar' }
    ];
    const monthlyChartSVG = chartType === 'line' ? svgLineChart(monthlySeries, MONTHS_SHORT, 700, 280) : svgBarChart(monthlySeries, MONTHS_SHORT, 700, 280);
    const chartTypeLabel = chartType === 'line' ? 'Line Chart' : 'Bar Chart';

    const statusPie = svgPieWithLegend([
      { label: 'Steril', value: sc.steril, color: '#00cec9' }, { label: 'ED Hari Ini', value: sc.edHariIni, color: '#fbc531' },
      { label: 'Expired', value: sc.expired, color: '#ff3f34' }, { label: 'Kotor/Dipakai', value: sc.kotor, color: '#2563eb' }
    ], 'Status Alat', 180);
    const masukPie = svgPieWithLegend([
      { label: 'Sterilisasi Baru', value: data.masukBaruCount || 0, color: '#00cec9' },
      { label: 'Re-Sterilisasi', value: data.masukUlangCount || 0, color: '#6c5ce7' }
    ], 'Alasan Masuk', 130);
    const keluarPie = svgPieWithLegend([
      { label: 'Dipakai', value: data.dipakaiCount || 0, color: '#00b894' },
      { label: 'Expired', value: data.expiredCount || 0, color: '#ff3f34' }
    ], 'Alasan Keluar', 130);
    const topAlatSVG = svgHBar(data.topAlat || [], 7, 700);
    const topPetugasSVG = svgHBar(data.topPetugas || [], 5, 700);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:25px;font-size:12px;color:#333}.header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #6c5ce7}.header h1{color:#6c5ce7;font-size:22px;margin-bottom:4px}.header .sub{color:#666;font-size:12px}.period{background:#6c5ce7;color:#fff;padding:6px 22px;border-radius:20px;display:inline-block;margin-top:12px;font-weight:bold;font-size:13px}.summary{display:flex;justify-content:center;gap:15px;margin-bottom:28px}.scard{flex:1;text-align:center;padding:18px 10px;border-radius:14px;border:2px solid #eee}.scard .val{font-size:28px;font-weight:bold}.scard .lbl{font-size:10px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:1px}.section{margin-bottom:30px;page-break-inside:avoid}.section h2{font-size:15px;color:#333;margin-bottom:15px;padding-bottom:8px;border-bottom:2px solid #eee;display:flex;align-items:center;gap:8px}.chart-box{background:#fafafa;border:1px solid #eee;border-radius:12px;padding:20px;text-align:center}.badge{display:inline-block;background:#f0f0f0;color:#666;font-size:9px;padding:3px 10px;border-radius:10px;margin-left:8px;font-weight:bold}.two-col{display:flex;gap:25px}.two-col>div{flex:1;background:#fafafa;border:1px solid #eee;border-radius:12px;padding:20px}.two-col h3{font-size:13px;margin-bottom:15px;color:#333}.footer{margin-top:35px;text-align:center;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:20px}@media print{body{padding:15px}.section{page-break-inside:avoid}}</style></head>
<body>
<div class="header"><h1>📊 LAPORAN STATISTIK SIMAS</h1><p class="sub">Sistem Informasi & Monitoring Alat Steril — IBS RSJD Amino</p><div class="period">${escapeHtml(period)}</div></div>
<div class="summary"><div class="scard" style="border-color:#00cec920"><div class="val" style="color:#00cec9">📥 ${data.totalMasuk || 0}</div><div class="lbl">Total Masuk</div></div><div class="scard" style="border-color:#ff3f3420"><div class="val" style="color:#ff3f34">📤 ${data.totalKeluar || 0}</div><div class="lbl">Total Keluar</div></div><div class="scard" style="border-color:#6c5ce720"><div class="val" style="color:#6c5ce7">⏱ ${data.avgUmurSteril || 0}h</div><div class="lbl">Rata-rata Umur Steril</div></div></div>
<div class="section"><h2>📊 Status Alat Saat Ini</h2><div class="chart-box">${statusPie}</div></div>
<div class="section"><h2>📈 Trend Bulanan ${data.tahun || statTahun} <span class="badge">${chartTypeLabel}</span></h2><div class="chart-box">${monthlyChartSVG}</div></div>
<div class="section"><h2>🔄 Breakdown Masuk & Keluar</h2><div class="two-col"><div><h3>📥 Alasan Masuk</h3>${masukPie}</div><div><h3>📤 Alasan Keluar</h3>${keluarPie}</div></div></div>
${(data.topAlat || []).length > 0 ? `<div class="section"><h2>🏆 Alat Paling Sering Dipakai</h2><div class="chart-box">${topAlatSVG}</div></div>` : ''}
${(data.topPetugas || []).length > 0 ? `<div class="section"><h2>👤 Petugas Paling Aktif</h2><div class="chart-box">${topPetugasSVG}</div></div>` : ''}
<div class="footer"><p>Dicetak: ${new Date().toLocaleString('id-ID')} | Oleh: ${escapeHtml(currentUser?.nama || '-')}</p><p>SIMAS ${APP_VERSION} — IBS RSJD Amino</p></div>
</body></html>`;
  }, [statistikData, statBulan, statTahun, currentUser, statChartType]);

  const cetakStatistikPDF = useCallback(async () => {
    if (!statistikData) { Alert.alert("Kosong", "Tidak ada data statistik"); return; }
    setLoading(true); setExportStatus('Mencetak statistik...');
    try {
      const h = generateStatistikPDFHTML();
      if (Platform.OS === 'web') { const w = window.open('', '_blank'); if (w) { w.document.write(h); w.document.close(); setTimeout(() => w.print(), 500); } }
      else await Print.printAsync({ html: h });
      setCetakStatistik(false); showToast('Berhasil!');
    } catch (e) { Alert.alert('Gagal', e.message); }
    finally { if (mountedRef.current) { setLoading(false); setExportStatus(''); } }
  }, [statistikData, generateStatistikPDFHTML]);

  const downloadStatistikPDF = useCallback(async () => {
    if (!statistikData) { Alert.alert("Kosong", "Tidak ada data statistik"); return; }
    setLoading(true); setExportStatus('Membuat PDF statistik...');
    try {
      const h = generateStatistikPDFHTML();
      if (Platform.OS === 'web') { const w = window.open('', '_blank'); if (w) { w.document.write(h); w.document.close(); } }
      else { const { uri } = await Print.printToFileAsync({ html: h }); const ok = await Sharing.isAvailableAsync(); if (ok) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf' }); showToast('Berhasil!'); } else Alert.alert('OK', 'PDF disimpan'); }
      setCetakStatistik(false);
    } catch (e) { Alert.alert('Gagal', e.message); }
    finally { if (mountedRef.current) { setLoading(false); setExportStatus(''); } }
  }, [statistikData, generateStatistikPDFHTML]);

  // ================================================================
  // HAND OVER FUNCTIONS
  // ================================================================

  const resetHoForm = useCallback(() => {
    const count = 6;
    setHoPasien(Array.from({ length: count }, (_, i) => ({ no: i + 1, identitas: '', diagnosa: '', tindakan: '', dpjp: '', pagi: '', sore: '', malam: '' })));
    setHoSerahTerima({ pagi: { menyerahkan: '', menerima: '' }, sore: { menyerahkan: '', menerima: '' }, malam: { menyerahkan: '', menerima: '' } });
    setHoSheetExists(false); setHoSheetName(''); setHoExpandedIdx(0); setHoJumlahPasien(count);
  }, []);

  const fetchHandOver = useCallback(async (tanggal) => {
    setHoLoading(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}?action=getHandOver&tanggal=${tanggal}`);
      const textBody = await res.text();
      let json;
      try { json = JSON.parse(textBody); }
      catch (parseErr) {
        const isHTML = textBody.trim().startsWith('<') || textBody.includes('<!DOCTYPE');
        Alert.alert('⚠️ Gagal Memuat', isHTML ? 'GAS belum di-deploy ulang.' : 'Respons tidak valid:\n' + textBody.substring(0, 200));
        if (mountedRef.current) setHoLoading(false); return;
      }
      if (!mountedRef.current) return;
      if (json.status === 'error') { Alert.alert('⚠️ Error', json.message || 'Unknown'); setHoLoading(false); return; }
      if (json.accessError) Alert.alert('⚠️ Akses', json.accessError);
      setHoSheetExists(json.exists || false); setHoSheetName(json.sheetName || '');
      const N = json.jumlahPasien || 6; setHoJumlahPasien(N);
      if (json.pasien && json.pasien.length > 0) {
        const pasienArr = [];
        for (let i = 0; i < N; i++) { if (json.pasien[i]) pasienArr.push({ ...json.pasien[i], no: i + 1 }); else pasienArr.push({ no: i + 1, identitas: '', diagnosa: '', tindakan: '', dpjp: '', pagi: '', sore: '', malam: '' }); }
        setHoPasien(pasienArr);
      } else { setHoPasien(Array.from({ length: N }, (_, i) => ({ no: i + 1, identitas: '', diagnosa: '', tindakan: '', dpjp: '', pagi: '', sore: '', malam: '' }))); }
      if (json.serahTerima) setHoSerahTerima(json.serahTerima);
    } catch (e) { if (mountedRef.current) Alert.alert('Error', 'Gagal memuat: ' + e.message); }
    if (mountedRef.current) setHoLoading(false);
  }, []);

  const fetchHoRiwayat = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`${API_URL}?action=getDaftarSheetHO`);
      const t = await res.text();
      try { const json = JSON.parse(t); if (json.sheets && mountedRef.current) setHoRiwayat(json.sheets); }
      catch (pe) { console.log('fetchHoRiwayat parse:', pe.message); }
    } catch (e) { console.log('fetchHoRiwayat:', e.message); }
  }, []);

  const saveHandOver = useCallback(async () => {
    const adaData = hoPasien.some(p => p.identitas.trim() !== '' || p.diagnosa.trim() !== '' || p.tindakan.trim() !== '');
    if (!adaData) { Alert.alert('Kosong', 'Minimal isi 1 data pasien'); return; }
    Alert.alert('💾 Simpan Hand Over?', `Jumlah pasien: ${hoPasien.length}\nSheet: "${hoSheetName || hoTanggal}"`, [
      { text: 'Batal' },
      { text: 'Simpan', onPress: async () => {
          setLoading(true);
          try {
            const res = await fetchWithTimeout(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simpanHandOver', data: { tanggal: hoTanggal, pasien: hoPasien, serahTerima: hoSerahTerima } }) });
            const json = await res.json();
            if (json.status === 'success') { showToast(json.message || 'Berhasil!'); setHoSheetExists(true); }
            else Alert.alert('Gagal', json.message || 'Gagal menyimpan');
          } catch (e) { Alert.alert('Error', e.message); }
          if (mountedRef.current) setLoading(false);
        }
      }
    ]);
  }, [hoTanggal, hoPasien, hoSerahTerima, hoSheetName]);

  const updateHoPasien = useCallback((index, field, value) => {
    setHoPasien(prev => { const u = [...prev]; if (field === null) u[index] = value; else u[index] = { ...u[index], [field]: value }; return u; });
  }, []);

  const updateHoST = useCallback((shift, role, value) => {
    setHoSerahTerima(prev => ({ ...prev, [shift]: { ...prev[shift], [role]: value } }));
  }, []);

  const openHoPetugasModal = useCallback((shift, role) => {
    setHoSelectTarget({ shift, role });
    const currentVal = hoSerahTerima[shift]?.[role] || '';
    const currentNames = currentVal.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setHoMultiSelect(currentNames);
    setModalType('hoMultiPetugas'); setModalSearch(''); setModalVisible(true);
  }, [hoSerahTerima]);

  const confirmHoMultiSelect = useCallback(() => {
    if (hoSelectTarget) { const joinedNames = hoMultiSelect.join(', '); updateHoST(hoSelectTarget.shift, hoSelectTarget.role, joinedNames); setHoSelectTarget(null); }
    setModalVisible(false); setModalSearch(''); setHoMultiSelect([]);
  }, [hoSelectTarget, hoMultiSelect, updateHoST]);

  const tambahPasien = useCallback(() => {
    setHoPasien(prev => [...prev, { no: prev.length + 1, identitas: '', diagnosa: '', tindakan: '', dpjp: '', pagi: '', sore: '', malam: '' }]);
    setHoJumlahPasien(prev => prev + 1);
    showToast('Pasien ' + (hoPasien.length + 1) + ' ditambahkan');
  }, [hoPasien.length]);

  const hapusPasienTerakhir = useCallback(() => {
    if (hoPasien.length <= 1) { Alert.alert('Minimal', 'Minimal 1 data pasien'); return; }
    Alert.alert('Hapus?', `Hapus Pasien ${hoPasien.length}?`, [
      { text: 'Batal' },
      { text: 'Hapus', style: 'destructive', onPress: () => { setHoPasien(prev => prev.slice(0, -1)); setHoJumlahPasien(prev => prev - 1); showToast('Pasien dihapus'); } }
    ]);
  }, [hoPasien.length]);

  const pasienHasData = useCallback((p) => {
    return !!(p.identitas?.trim() || p.diagnosa?.trim() || p.tindakan?.trim() || p.dpjp?.trim() || p.pagi?.trim() || p.sore?.trim() || p.malam?.trim());
  }, []);

  const hoSelectRiwayat = useCallback((sheetName) => {
    const parts = sheetName.split(' ');
    if (parts.length >= 3) {
      const day = parseInt(parts[0]); const mi = MONTHS.indexOf(parts[1]); const year = parseInt(parts[2]);
      if (!isNaN(day) && mi >= 0 && !isNaN(year)) { const ds = `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; setHoTanggal(ds); fetchHandOver(ds); setHoShowRiwayat(false); return; }
    }
    Alert.alert('Error', 'Format tanggal tidak dikenali: ' + sheetName);
  }, [fetchHandOver]);

  useEffect(() => {
    if (view === 'handover') {
      fetchHandOver(hoTanggalRef.current); fetchHoRiwayat();
      if (dropdownList.petugas.length === 0) fetchData('getList');
    }
  }, [view, fetchHandOver, fetchHoRiwayat, fetchData, dropdownList.petugas.length]);

  // ================================================================
  // RENDER HELPERS
  // ================================================================

  const renderDashItem = useCallback(({ item }) => (
    <DashboardRow item={item} T={T}
      onPress={() => { setDetailItem(item); setDetailSource('dashboard'); }}
      onEdit={() => handleEditFromDashboard(item)}
      onDelete={() => handleDeleteItem(item)} />
  ), [T, handleEditFromDashboard, handleDeleteItem]);

  const renderLapItem = useCallback(({ item }) => (
    <LaporanRow item={item} T={T}
      onPress={() => { setDetailItem(item); setDetailSource('laporan'); }}
      onEdit={() => {
        setTempHist({ ...item }); setDetailItem('editLapor');
      }} />
  ), [T, isAdmin]);

  const dkE = useCallback((i, idx) => i.id?.toString() || `d-${idx}`, []);
  const lkE = useCallback((i, idx) => i.id?.toString() || `l-${idx}`, []);
  const getActiveNavIcon = useCallback(() => NAV_ITEMS.find(n => n.key === view)?.icon || 'home', [view]);
  const isNavView = useMemo(() => NAV_ITEMS.some(n => n.key === view), [view]);

  const safeMax = useCallback((...arrays) => {
    const values = arrays.flat().filter(v => typeof v === 'number' && !isNaN(v));
    return values.length > 0 ? Math.max(...values) : 1;
  }, []);

  // ================================================================
  // BACK HANDLER
  // ================================================================

  useEffect(() => {
    const b = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sidebar) { setSidebar(false); return true; }
      if (showChangePin) { setShowChangePin(false); return true; }
      if (cetakStatistik) { setCetakStatistik(false); return true; }
      if (hoShowPreview) { setHoShowPreview(false); return true; }
      if (hoDetailPasien) { setHoDetailPasien(null); return true; }
      if (hoShowRiwayat) { setHoShowRiwayat(false); return true; }
      if (alasanModal) { setAlasanModal(false); return true; }
      if (cetakOptions) { setCetakOptions(false); return true; }
      if (showUserModal) { setShowUserModal(false); return true; }
      if (modalVisible) { setModalVisible(false); return true; }
      if (detailItem) { closeDetail(); return true; }
      if (canGoBack) { handleGoBack(); return true; }
      return false;
    });
    return () => b.remove();
  }, [sidebar, modalVisible, detailItem, alasanModal, cetakOptions,
    cetakStatistik, showUserModal, showChangePin, hoShowRiwayat,
    hoDetailPasien, hoShowPreview, canGoBack, handleGoBack, closeDetail]);

  // ================================================================
  // STYLES
  // ================================================================

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg },
    header: { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 15, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    input: { backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 15, color: T.text, fontSize: 15 },
    btnPrimary: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 3, flexDirection: 'row', justifyContent: 'center' },
    tableHeader: { flexDirection: 'row', backgroundColor: T.tableHead, paddingVertical: 14, paddingHorizontal: 15, borderTopLeftRadius: 12, borderTopRightRadius: 12, marginHorizontal: 15 },
    tableHeaderText: { fontWeight: 'bold', fontSize: 11, color: T.sub, textTransform: 'uppercase' },
    navBarContainer: { position: 'absolute', bottom: 25, left: 15, right: 15, height: 70, borderRadius: 35, backgroundColor: T.bottomBar, elevation: 20, flexDirection: 'row', alignItems: 'center' },
    activeBall: { position: 'absolute', top: -28, width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, elevation: 8, borderWidth: 5, borderColor: T.bg, justifyContent: 'center', alignItems: 'center' },
    sidebarOverlay: { flex: 1, flexDirection: 'row' },
    sidebarContent: { width: 280, backgroundColor: COLORS.bgApp, paddingTop: 50, paddingHorizontal: 20 },
    sideItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  }), [T]);

  const getHeaderTitle = () => {
    switch (view) {
      case 'input': return isEditMode ? 'UPDATE' : 'INPUT';
      case 'isiset': return 'ISI SET';
      case 'statistik': return 'STATISTIK';
      case 'handover': return 'HAND OVER';
      default: return view.toUpperCase();
    }
  };

  if (isShowSplash) return <SplashScreen onFinish={() => setIsShowSplash(false)} />;
  if (!isLoggedIn) return <AuthScreen onLogin={handleLogin} loading={loading} />;

  // ================================================================
  // ★★★ JSX RETURN ★★★
  // ================================================================

  return (
    <ThemeContext.Provider value={T}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.secondary} />

        {view !== 'home' && (
          <LinearGradient colors={COLORS.gradientPrimary} style={styles.header}>
            <TouchableOpacity onPress={() => setSidebar(true)}>
              <Ionicons name="menu" size={28} color="white" />
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{getHeaderTitle()}</Text>
            <View style={{ flexDirection: 'row' }}>
              {canGoBack && (
                <TouchableOpacity onPress={handleGoBack} style={{ marginRight: 15 }}>
                  <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={toggleMode}>
                <Ionicons name={mode === 'light' ? 'moon' : 'sunny'} size={24} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        <View style={{ flex: 1, marginBottom: 100 }}>

          {/* ==================== HOME ==================== */}
          {view === 'home' && (
            <ScrollView showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
              <LinearGradient colors={COLORS.gradientPrimary} style={{ paddingTop: Platform.OS === 'ios' ? 55 : 45, paddingBottom: 45, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <TouchableOpacity onPress={() => setSidebar(true)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 }}>
                    <Ionicons name="menu" size={22} color="white" />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={toggleMode} style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10, marginRight: 8 }}>
                      <Ionicons name={mode === 'light' ? 'moon' : 'sunny'} size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onRefresh} style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 }}>
                      <Ionicons name="refresh" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>👋 Halo, {currentUser?.nama}</Text>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>Selamat Datang di SIMAS</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 3, letterSpacing: 0.5 }}>Sistem Informasi Monitoring Alat Steril</Text>
              </LinearGradient>

              <View style={{ flexDirection: 'row', marginHorizontal: 10, marginTop: -25, marginBottom: 15 }}>
                <MiniStatCard icon="package-variant" label="Total" value={stats.total} color="#6c5ce7" onPress={() => changeView('dashboard', { filter: 'TOTAL' })} />
                <MiniStatCard icon="check-circle" label="Steril" value={stats.steril} color={COLORS.statSteril} onPress={() => changeView('dashboard', { filter: 'STERIL' })} />
                <MiniStatCard icon="clock-alert" label="ED" value={stats.edToday} color={COLORS.statEd} onPress={() => changeView('dashboard', { filter: 'ED HARI INI' })} />
                <MiniStatCard icon="alert-circle" label="Expired" value={stats.expired} color={COLORS.statExp} onPress={() => changeView('dashboard', { filter: 'EXPIRED' })} />
                <MiniStatCard icon="water" label="Kotor" value={stats.kotor} color={COLORS.statKotor} onPress={() => changeView('dashboard', { filter: 'KOTOR' })} />
              </View>

              {(stats.expired + stats.edToday) > 0 && (
                <TouchableOpacity onPress={() => changeView('dashboard', { filter: 'EXPIRED' })} style={{ marginHorizontal: 15, marginBottom: 15 }}>
                  <LinearGradient colors={COLORS.gradientDanger} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 }}>
                    <MaterialCommunityIcons name="alert" size={22} color="white" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>⚠️ {stats.expired + stats.edToday} alat perlu ditangani</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <View style={{ paddingHorizontal: 15, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: T.text }}>Menu Utama</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 15 }}>
                <MenuCard label="Dashboard" icon="view-dashboard" color={COLORS.menu1} description="Monitoring" onPress={() => changeView('dashboard')} />
                <MenuCard label="Input Data" icon="plus-circle" color={COLORS.menu2} description="Tambah data" onPress={() => changeView('input')} />
                <MenuCard label="Laporan" icon="file-chart" color={COLORS.menu3} description="Riwayat & PDF" onPress={() => changeView('laporan')} />
                <MenuCard label="Statistik" icon="chart-bar" color={COLORS.menu5} description="Grafik & Analisis" onPress={() => changeView('statistik')} />
                <MenuCard label="Hand Over" icon="clipboard-text" color={COLORS.success} description="Serah terima pasien" onPress={() => changeView('handover')} />
                {isAdmin && <MenuCard label="Kelola User" icon="account-group" color={COLORS.menu6} description="Manajemen akun" onPress={() => { fetchData('getUsers'); setShowUserModal(true); }} />}
                <MenuCard label="Isi Set" icon="format-list-bulleted" color={COLORS.menu4} description="Daftar instrument" onPress={() => changeView('isiset')} />
              </View>

              <View style={{ paddingHorizontal: 15, marginTop: 15, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: T.text }}>📋 Aktivitas Terbaru</Text>
                  <TouchableOpacity onPress={() => changeView('laporan')}>
                    <Text style={{ fontSize: 12, color: COLORS.primary }}>Semua →</Text>
                  </TouchableOpacity>
                </View>
                {recentActivity.length > 0
                  ? recentActivity.map((i, idx) => (
                    <RecentActivityItem key={`a-${idx}`} item={i} onPress={() => { setDetailItem(i); setDetailSource('laporan'); }} />
                  ))
                  : (
                    <View style={[cS.activityItem, { backgroundColor: T.card, borderColor: T.border, justifyContent: 'center' }]}>
                      <Text style={{ color: T.sub }}>Belum ada aktivitas</Text>
                    </View>
                  )}
              </View>
              <View style={{ alignItems: 'center', paddingBottom: 25 }}>
                <Text style={{ color: T.sub, fontSize: 10 }}>SIMAS {APP_VERSION} | {currentUser?.nama}</Text>
              </View>
            </ScrollView>
          )}

          {/* ==================== DASHBOARD ==================== */}
          {view === 'dashboard' && (
            <View style={{ flex: 1 }}>
              <View style={{ backgroundColor: T.bg, paddingTop: 10, paddingBottom: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
                  {FILTER_CONFIG.map(({ key, color, statKey }) => (
                    <FilterCard key={key} label={key} value={stats[statKey]} color={color} isActive={currentFilter === key} onPress={() => setCurrentFilter(key)} />
                  ))}
                </ScrollView>
              </View>
              <View style={{ paddingHorizontal: 15, paddingVertical: 10, backgroundColor: T.bg }}>
                <SearchBar value={search} onChangeText={setSearch} placeholder="Cari alat/petugas..." />
              </View>
              <View style={styles.tableHeader}>
                <TouchableOpacity style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleDashSort('alat')}>
                  <Text style={styles.tableHeaderText}>ALAT</Text>
                  {dashSort.sortField === 'alat' && <Ionicons name={dashSort.sortOrder === 'asc' ? 'caret-up' : 'caret-down'} size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }} onPress={() => handleDashSort('sisa')}>
                  <Text style={styles.tableHeaderText}>SISA</Text>
                  {dashSort.sortField === 'sisa' && <Ionicons name={dashSort.sortOrder === 'asc' ? 'caret-up' : 'caret-down'} size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>STATUS</Text>
              </View>
              <FlatList data={filteredDashData} keyExtractor={dkE} contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                removeClippedSubviews maxToRenderPerBatch={10} windowSize={10} initialNumToRender={10}
                ListEmptyComponent={<EmptyState icon="package-variant" message="Tidak ada data" />}
                renderItem={renderDashItem} />
            </View>
          )}

          {/* ==================== INPUT ==================== */}
          {view === 'input' && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                <Text style={{ color: T.text, marginBottom: 8, fontWeight: '600' }}>Petugas</Text>
                <TouchableOpacity style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => { setModalType('petugas'); setModalVisible(true); }}>
                  <Text style={{ color: form.petugas ? T.text : T.sub }}>{form.petugas || "Pilih"}</Text>
                  <Ionicons name="chevron-down" size={20} color={T.sub} />
                </TouchableOpacity>

                <Text style={{ color: T.text, marginBottom: 8, fontWeight: '600' }}>Instrument</Text>
                <TouchableOpacity style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => { setModalType('alat'); setModalVisible(true); }}>
                  <Text style={{ color: form.instrument ? T.text : T.sub, flex: 1 }} numberOfLines={1}>{form.instrument || "Pilih"}</Text>
                  <Ionicons name="chevron-down" size={20} color={T.sub} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ width: '48%' }}>
                    <Text style={{ color: T.text, marginBottom: 8, fontWeight: '600' }}>Tgl Steril</Text>
                    <TouchableOpacity style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]} onPress={() => setShowPicker('steril')}>
                      <Ionicons name="calendar" size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
                      <Text style={{ color: form.tglSteril ? T.text : T.sub }}>{form.tglSteril || "Pilih"}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ width: '48%' }}>
                    <Text style={{ color: T.text, marginBottom: 8, fontWeight: '600' }}>Expired</Text>
                    <TouchableOpacity style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]} onPress={() => setShowPicker('ed')}>
                      <Ionicons name="calendar" size={18} color={COLORS.danger} style={{ marginRight: 10 }} />
                      <Text style={{ color: form.tglED ? T.text : T.sub }}>{form.tglED || "Pilih"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isEditMode && isAdmin && (
                  <View style={{ backgroundColor: mode === 'dark' ? '#1a365d' : '#e3f2fd', padding: 15, borderRadius: 12, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: COLORS.statKotor }}>
                    <Text style={{ color: mode === 'dark' ? '#fff' : '#1a365d', fontWeight: 'bold', marginBottom: 10 }}>📦 Pemakaian (KELUAR)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity style={[styles.input, { marginBottom: 0, flex: 1, backgroundColor: T.card }]} onPress={() => setShowPicker('pakai')}>
                        <Text style={{ color: form.tglPakai ? T.text : T.sub }}>{form.tglPakai || "Pilih tanggal"}</Text>
                      </TouchableOpacity>
                      {form.tglPakai ? <TouchableOpacity onPress={() => setForm(p => ({ ...p, tglPakai: '' }))} style={{ marginLeft: 10 }}><Ionicons name="refresh-circle" size={35} color={COLORS.danger} /></TouchableOpacity> : null}
                    </View>
                  </View>
                )}

                <Text style={{ color: T.text, marginBottom: 8, fontWeight: '600' }}>Keterangan</Text>
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="Opsional" placeholderTextColor={T.sub} value={form.keterangan} onChangeText={t => setForm(p => ({ ...p, keterangan: t }))} />

                <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: isEditMode ? COLORS.warning : COLORS.primary }]} onPress={handleSubmitForm} disabled={loading}>
                  {loading ? <ActivityIndicator color="white" /> : (
                    <>
                      <MaterialCommunityIcons name={isEditMode ? "content-save" : "plus-circle"} size={20} color="white" style={{ marginRight: 10 }} />
                      <Text style={{ color: 'white', fontWeight: 'bold' }}>{isEditMode ? 'SIMPAN' : 'TAMBAH'}</Text>
                    </>
                  )}
                </TouchableOpacity>
                {!isEditMode && <View style={{ backgroundColor: COLORS.statSteril + '15', padding: 12, borderRadius: 10, marginTop: 15 }}><Text style={{ color: COLORS.statSteril, fontSize: 11, textAlign: 'center' }}>💡 Tercatat sebagai MASUK</Text></View>}
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* ==================== LAPORAN — ★ CHANGED: support 'Semua Bulan' ==================== */}
          {view === 'laporan' && (
            <View style={{ flex: 1 }}>
              <View style={{ padding: 15, backgroundColor: T.card, elevation: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', flex: 1 }}>
                    {/* ★ CHANGED: width lebih lebar, label support 'semua' */}
                    <TouchableOpacity style={[styles.input, { marginBottom: 0, flex: 1, marginRight: 8, backgroundColor: T.bg, borderColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => { setModalType('bulan'); setModalVisible(true); }}>
                      <Text style={{ color: T.text, fontSize: 12 }} numberOfLines={1}>{lapBulan === 'semua' ? 'Semua Bulan' : MONTHS[lapBulan]}</Text>
                      <Ionicons name="chevron-down" size={14} color={T.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.input, { marginBottom: 0, width: 75, backgroundColor: T.bg, borderColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => { setModalType('tahun'); setModalVisible(true); }}>
                      <Text style={{ color: T.text, fontSize: 12 }}>{lapTahun}</Text><Ionicons name="chevron-down" size={14} color={T.sub} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                    <TouchableOpacity onPress={() => setShowSearch(p => !p)} style={{ backgroundColor: COLORS.secondary, padding: 12, borderRadius: 10, marginRight: 8 }}>
                      <MaterialCommunityIcons name={showSearch ? "close" : "magnify"} size={18} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCetakOptions(true)} style={{ backgroundColor: '#E53935', padding: 12, borderRadius: 10 }}>
                      <MaterialCommunityIcons name="file-pdf-box" size={18} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* ★ ADDED: Tombol reset "Bulan Ini" */}
                {(lapBulan !== new Date().getMonth() || lapTahun !== new Date().getFullYear().toString()) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                    <TouchableOpacity onPress={() => { setLapBulan(new Date().getMonth()); setLapTahun(new Date().getFullYear().toString()); }} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.primary + '20' }}> 
                      <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: 'bold' }}>↻ Bulan Ini</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {showSearch && <TextInput style={[styles.input, { marginTop: 12, marginBottom: 0 }]} placeholder="Cari..." placeholderTextColor={T.sub} value={search} onChangeText={setSearch} autoFocus />}
              </View>
              {/* ★ CHANGED: label periode */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: T.bg, borderBottomWidth: 1, borderColor: T.border }}>
                <Text style={{ color: T.sub, fontSize: 11 }}>Total: <Text style={{ fontWeight: 'bold', color: T.text }}>{reportStats.total}</Text></Text>
                <Text style={{ color: T.sub, fontSize: 11 }}>Masuk: <Text style={{ fontWeight: 'bold', color: COLORS.statSteril }}>{reportStats.masuk}</Text></Text>
                <Text style={{ color: T.sub, fontSize: 11 }}>Keluar: <Text style={{ fontWeight: 'bold', color: COLORS.danger }}>{reportStats.keluar}</Text></Text>
              </View>
              <View style={[styles.tableHeader, { marginTop: 5 }]}>
                <TouchableOpacity style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleLaporanSort('tgl')}>
                  <Text style={styles.tableHeaderText}>TGL</Text>
                  {laporanSort.sortField === 'tgl' && <Ionicons name={laporanSort.sortOrder === 'asc' ? 'caret-up' : 'caret-down'} size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleLaporanSort('alat')}>
                  <Text style={styles.tableHeaderText}>ALAT</Text>
                  {laporanSort.sortField === 'alat' && <Ionicons name={laporanSort.sortOrder === 'asc' ? 'caret-up' : 'caret-down'} size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                <Text style={[styles.tableHeaderText, { flex: 0.8, textAlign: 'right' }]}>STATUS</Text>
              </View>
              <FlatList data={filteredReport} keyExtractor={lkE} contentContainerStyle={{ padding: 15, paddingTop: 8 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                removeClippedSubviews maxToRenderPerBatch={10} windowSize={10} initialNumToRender={10}
                ListEmptyComponent={<EmptyState icon="file-document-outline" message="Tidak ada laporan" />}
                renderItem={renderLapItem} />
            </View>
          )}
          {/* ==================== STATISTIK ==================== */}
          {view === 'statistik' && (
            <View style={{ flex: 1 }}>
              <View style={{ padding: 15, backgroundColor: T.card, elevation: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', flex: 1 }}>
                    <TouchableOpacity style={[styles.input, { marginBottom: 0, flex: 1, marginRight: 8, backgroundColor: T.bg, borderColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => { setModalType('statBulan'); setModalVisible(true); }}>
                      <Text style={{ color: T.text, fontSize: 12 }} numberOfLines={1}>{statBulan === 'semua' ? 'Semua Bulan' : MONTHS[statBulan]}</Text>
                      <Ionicons name="chevron-down" size={14} color={T.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.input, { marginBottom: 0, width: 80, backgroundColor: T.bg, borderColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => { setModalType('statTahun'); setModalVisible(true); }}>
                      <Text style={{ color: T.text, fontSize: 12 }}>{statTahun}</Text>
                      <Ionicons name="chevron-down" size={14} color={T.sub} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => fetchStatistik(statBulan, statTahun, true)} style={{ backgroundColor: COLORS.secondary, padding: 12, borderRadius: 10, marginLeft: 8 }}>
                    <MaterialCommunityIcons name="refresh" size={18} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setCetakStatistik(true)} style={{ backgroundColor: '#E53935', padding: 12, borderRadius: 10, marginLeft: 8 }}>
                    <MaterialCommunityIcons name="file-pdf-box" size={18} color="white" />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <View style={{ backgroundColor: COLORS.secondary + '15', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, flex: 1 }}>
                    <Text style={{ color: COLORS.secondary, fontWeight: 'bold', fontSize: 12, textAlign: 'center' }}>
                      📊 {statBulan === 'semua' ? `Semua Bulan ${statTahun}` : `${MONTHS[statBulan]} ${statTahun}`}
                    </Text>
                  </View>
                  {(statBulan !== new Date().getMonth() || statTahun !== new Date().getFullYear().toString()) && (
                    <TouchableOpacity onPress={() => { setStatBulan(new Date().getMonth()); setStatTahun(new Date().getFullYear().toString()); }} style={{ marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.primary + '20' }}>
                      <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: 'bold' }}>Bulan Ini</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {!statistikData ? (
                  <View style={{ alignItems: 'center', paddingTop: 50 }}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={{ color: T.sub, marginTop: 15 }}>Memuat statistik...</Text></View>
                ) : statistikData.error ? (
                  <View style={{ alignItems: 'center', paddingTop: 50 }}><MaterialCommunityIcons name="alert-circle" size={50} color={COLORS.danger} /><Text style={{ color: COLORS.danger, marginTop: 15 }}>{statistikData.error}</Text></View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                      <StatNumber label="Total Masuk" value={statistikData.totalMasuk} icon="arrow-down-circle" color={COLORS.statSteril} T={T} />
                      <StatNumber label="Total Keluar" value={statistikData.totalKeluar} icon="arrow-up-circle" color={COLORS.danger} T={T} />
                      <StatNumber label="Rata² Umur" value={`${statistikData.avgUmurSteril}h`} icon="clock" color={COLORS.secondary} T={T} />
                    </View>
                    <View style={{ backgroundColor: T.card, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 }}>
                      <PieChart T={T} title="📊 Status Alat Saat Ini" data={[
                        { label: 'Steril', value: statistikData.statusCount?.steril || 0, color: COLORS.statSteril },
                        { label: 'ED Hari Ini', value: statistikData.statusCount?.edHariIni || 0, color: COLORS.statEd },
                        { label: 'Expired', value: statistikData.statusCount?.expired || 0, color: COLORS.statExp },
                        { label: 'Kotor', value: statistikData.statusCount?.kotor || 0, color: COLORS.statKotor }
                      ]} />
                    </View>
                    <View style={{ backgroundColor: T.card, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 }}>
                      <BarChart T={T} title={`📈 Masuk per Bulan ${statistikData.tahun || statTahun}`} data={statistikData.monthly?.map(m => m.masuk) || []} labels={MONTHS_SHORT} colors={[COLORS.statSteril]} maxVal={safeMax(statistikData.monthly?.map(m => m.masuk) || [], statistikData.monthly?.map(m => m.keluar) || [])} />
                    </View>
                    <View style={{ backgroundColor: T.card, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 }}>
                      <BarChart T={T} title={`📉 Keluar per Bulan ${statistikData.tahun || statTahun}`} data={statistikData.monthly?.map(m => m.keluar) || []} labels={MONTHS_SHORT} colors={[COLORS.danger]} maxVal={safeMax(statistikData.monthly?.map(m => m.masuk) || [], statistikData.monthly?.map(m => m.keluar) || [])} />
                    </View>
                    <View style={{ backgroundColor: T.card, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 }}>
                      <PieChart T={T} title={`📥 Alasan Masuk (${statPeriodLabel})`} data={[
                        { label: 'Sterilisasi Baru', value: statistikData.masukBaruCount || 0, color: COLORS.statSteril },
                        { label: 'Re-Sterilisasi', value: statistikData.masukUlangCount || 0, color: COLORS.chart1 }
                      ]} />
                    </View>
                    <View style={{ backgroundColor: T.card, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 }}>
                      <PieChart T={T} title={`🔄 Alasan Keluar (${statPeriodLabel})`} data={[
                        { label: 'Dipakai', value: statistikData.dipakaiCount || 0, color: COLORS.success },
                        { label: 'Expired', value: statistikData.expiredCount || 0, color: COLORS.danger }
                      ]} />
                    </View>
                    <View style={{ backgroundColor: T.card, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 }}>
                      <HorizontalBar T={T} title={`🏆 Alat Sering Dipakai (${statPeriodLabel})`} data={statistikData.topAlat || []} maxItems={7} />
                    </View>
                    <View style={{ backgroundColor: T.card, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 }}>
                      <HorizontalBar T={T} title={`👤 Petugas Paling Aktif (${statPeriodLabel})`} data={statistikData.topPetugas || []} maxItems={5} />
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          )}

          {/* ==================== ISI SET ==================== */}
          {view === 'isiset' && (
            <View style={{ flex: 1, padding: 20 }}>
              <Text style={{ color: T.text, fontWeight: 'bold', marginBottom: 10, fontSize: 16 }}>🔍 Cari Set</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 15 }}>
                <Ionicons name="search" size={20} color={COLORS.primary} />
                <TextInput style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: T.text }} placeholder="Ketik nama set..." placeholderTextColor={T.sub} value={isiSetSearch} onFocus={() => setShowSetDropdown(true)} onChangeText={t => { setIsiSetSearch(t); setShowSetDropdown(true); }} />
              </View>
              {showSetDropdown && (
                <View style={{ maxHeight: 280, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, marginTop: 8, elevation: 10 }}>
                  <FlatList data={isiSet.filter(s => s.nama?.toLowerCase().includes(isiSetSearch.toLowerCase()))} keyExtractor={(x, i) => `s-${i}`} keyboardShouldPersistTaps='handled'
                    ListEmptyComponent={<View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: T.sub }}>Tidak ditemukan</Text></View>}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={{ padding: 15, borderBottomWidth: 1, borderColor: T.border }} onPress={() => { setSelectedSet(item); setIsiSetSearch(item.nama); setShowSetDropdown(false); }}>
                        <Text style={{ color: T.text, fontWeight: 'bold' }}>{item.nama}</Text>
                      </TouchableOpacity>
                    )} />
                  <TouchableOpacity style={{ padding: 12, alignItems: 'center', backgroundColor: COLORS.secondary, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} onPress={() => setShowSetDropdown(false)}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Tutup</Text>
                  </TouchableOpacity>
                </View>
              )}
              {selectedSet && (
                <View style={{ flex: 1, backgroundColor: T.card, padding: 20, borderRadius: 15, marginTop: 15, elevation: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderColor: T.border }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.secondary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                      <MaterialCommunityIcons name="medical-bag" size={26} color={COLORS.secondary} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.secondary, flex: 1 }}>{selectedSet.nama}</Text>
                  </View>
                  <ScrollView><Text style={{ color: T.text, lineHeight: 26, fontSize: 14 }}>{selectedSet.isi}</Text></ScrollView>
                </View>
              )}
            </View>
          )}

          {/* ==================== HAND OVER ==================== */}
          {view === 'handover' && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">

                <View style={{ backgroundColor: T.card, borderRadius: 16, padding: 18, marginBottom: 15, elevation: 3, borderWidth: 1, borderColor: T.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.success + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <MaterialCommunityIcons name="clipboard-text" size={24} color={COLORS.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 16 }}>Hand Over Pasien</Text>
                      <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Serah terima antar shift</Text>
                    </View>
                    <TouchableOpacity onPress={() => setHoShowPreview(true)} style={{ padding: 8, backgroundColor: COLORS.primary + '15', borderRadius: 10, marginRight: 8 }}>
                      <MaterialCommunityIcons name="table-eye" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Linking.openURL(SHEET_URL)} style={{ padding: 8, backgroundColor: COLORS.success + '15', borderRadius: 10 }}>
                      <MaterialCommunityIcons name="google-spreadsheet" size={20} color={COLORS.success} />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: T.sub, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>📅 Tanggal</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBg, borderWidth: 1, borderColor: COLORS.success, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginRight: 8 }} onPress={() => setShowPicker('handover')}>
                      <Ionicons name="calendar" size={18} color={COLORS.success} style={{ marginRight: 10 }} />
                      <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>{formatDate(hoTanggal)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => fetchHandOver(hoTanggal)} style={{ backgroundColor: COLORS.success, padding: 14, borderRadius: 12, elevation: 2 }}>
                      <MaterialCommunityIcons name="refresh" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { fetchHoRiwayat(); setHoShowRiwayat(true); }} style={{ backgroundColor: COLORS.secondary, padding: 14, borderRadius: 12, elevation: 2, marginLeft: 8 }}>
                      <MaterialCommunityIcons name="history" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: hoSheetExists ? COLORS.success + '15' : COLORS.warning + '15' }}>
                    <MaterialCommunityIcons name={hoSheetExists ? 'check-circle' : 'alert-circle'} size={18} color={hoSheetExists ? COLORS.success : COLORS.warning} />
                    <Text style={{ color: hoSheetExists ? COLORS.success : COLORS.warning, fontSize: 12, marginLeft: 8, fontWeight: '600', flex: 1 }}>
                      {hoLoading ? 'Memuat...' : hoSheetExists ? `Sheet "${hoSheetName}" ✓ • ${hoFilledPasienCount} pasien` : `Sheet belum ada — dibuat otomatis`}
                    </Text>
                  </View>
                </View>

                {hoLoading ? (
                  <View style={{ alignItems: 'center', paddingTop: 50 }}>
                    <ActivityIndicator size="large" color={COLORS.success} />
                    <Text style={{ color: T.sub, marginTop: 15 }}>Memuat data hand over...</Text>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <MaterialCommunityIcons name="account-group" size={20} color={COLORS.success} />
                      <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 15, marginLeft: 8 }}>Data Pasien ({hoPasien.length})</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: T.border, marginLeft: 12 }} />
                    </View>

                    {hoPasien.map((p, idx) => {
                      const isExp = hoExpandedIdx === idx;
                      const hasD = pasienHasData(p);
                      return (
                        <View key={`ho-p-${idx}`} style={{ backgroundColor: T.card, borderRadius: 14, marginBottom: 10, elevation: 2, borderWidth: 1, borderColor: isExp ? COLORS.success : T.border, overflow: 'hidden' }}>
                          <TouchableOpacity onPress={() => setHoExpandedIdx(isExp ? null : idx)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: isExp ? COLORS.success + '10' : 'transparent' }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: hasD ? COLORS.success : T.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                              <Text style={{ color: hasD ? '#fff' : T.sub, fontWeight: 'bold', fontSize: 14 }}>{idx + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{p.identitas?.trim() ? p.identitas : `Pasien ${idx + 1} (kosong)`}</Text>
                              {hasD && <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{[p.diagnosa, p.tindakan].filter(s => s?.trim()).join(' • ') || '-'}</Text>}
                            </View>
                            {hasD && (
                              <TouchableOpacity onPress={() => setHoDetailPasien(p)} style={{ padding: 6, marginRight: 4 }}>
                                <MaterialCommunityIcons name="eye" size={20} color={COLORS.primary} />
                              </TouchableOpacity>
                            )}
                            <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={22} color={T.sub} />
                          </TouchableOpacity>

                          {isExp && (
                            <View style={{ padding: 14, paddingTop: 0, borderTopWidth: 1, borderColor: T.border }}>
                              <Text style={{ color: T.sub, fontSize: 11, fontWeight: '600', marginTop: 12, marginBottom: 4 }}>Identitas Pasien</Text>
                              <TextInput style={{ backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, color: T.text, fontSize: 14, minHeight: 50, textAlignVertical: 'top' }} placeholder="Nama / No. RM" placeholderTextColor={T.sub} value={p.identitas} onChangeText={v => updateHoPasien(idx, 'identitas', v)} multiline />
                              <Text style={{ color: T.sub, fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 }}>Diagnosa</Text>
                              <TextInput style={{ backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, color: T.text, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }} placeholder="Diagnosa" placeholderTextColor={T.sub} value={p.diagnosa} onChangeText={v => updateHoPasien(idx, 'diagnosa', v)} multiline />
                              <Text style={{ color: T.sub, fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 }}>Tindakan</Text>
                              <TextInput style={{ backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, color: T.text, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }} placeholder="Tindakan" placeholderTextColor={T.sub} value={p.tindakan} onChangeText={v => updateHoPasien(idx, 'tindakan', v)} multiline />
                              <Text style={{ color: T.sub, fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 }}>DPJP - PPJP</Text>
                              <TextInput style={{ backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, color: T.text, fontSize: 14, minHeight: 50, textAlignVertical: 'top' }} placeholder="Nama DPJP / PPJP" placeholderTextColor={T.sub} value={p.dpjp} onChangeText={v => updateHoPasien(idx, 'dpjp', v)} multiline />
                              <Text style={{ color: T.sub, fontSize: 11, fontWeight: '600', marginTop: 14, marginBottom: 8 }}>Uraian Tugas Per Shift</Text>

                              <View style={{ marginBottom: 10, borderWidth: 1, borderColor: COLORS.success + '40', borderRadius: 12, overflow: 'hidden' }}>
                                <View style={{ backgroundColor: COLORS.success, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🌅 PAGI</Text></View>
                                <TextInput style={{ backgroundColor: T.inputBg, padding: 14, color: T.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top' }} placeholder="Uraian tugas pagi..." placeholderTextColor={T.sub} value={p.pagi} onChangeText={v => updateHoPasien(idx, 'pagi', v)} multiline />
                              </View>
                              <View style={{ marginBottom: 10, borderWidth: 1, borderColor: COLORS.warning + '40', borderRadius: 12, overflow: 'hidden' }}>
                                <View style={{ backgroundColor: COLORS.warning, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🌇 SORE</Text></View>
                                <TextInput style={{ backgroundColor: T.inputBg, padding: 14, color: T.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top' }} placeholder="Uraian tugas sore..." placeholderTextColor={T.sub} value={p.sore} onChangeText={v => updateHoPasien(idx, 'sore', v)} multiline />
                              </View>
                              <View style={{ marginBottom: 10, borderWidth: 1, borderColor: COLORS.secondary + '40', borderRadius: 12, overflow: 'hidden' }}>
                                <View style={{ backgroundColor: COLORS.secondary, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🌙 MALAM</Text></View>
                                <TextInput style={{ backgroundColor: T.inputBg, padding: 14, color: T.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top' }} placeholder="Uraian tugas malam..." placeholderTextColor={T.sub} value={p.malam} onChangeText={v => updateHoPasien(idx, 'malam', v)} multiline />
                              </View>

                              {hasD && (
                                <TouchableOpacity onPress={() => Alert.alert('Hapus?', `Bersihkan data pasien ${idx + 1}?`, [{ text: 'Batal' }, { text: 'Hapus', style: 'destructive', onPress: () => updateHoPasien(idx, null, { no: idx + 1, identitas: '', diagnosa: '', tindakan: '', dpjp: '', pagi: '', sore: '', malam: '' }) }])} style={{ alignSelf: 'flex-end', marginTop: 6, flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: COLORS.danger + '15', borderRadius: 8 }}>
                                  <MaterialCommunityIcons name="eraser" size={16} color={COLORS.danger} />
                                  <Text style={{ color: COLORS.danger, fontSize: 11, marginLeft: 4, fontWeight: '600' }}>Bersihkan</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                      <TouchableOpacity onPress={tambahPasien} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.success + '15', padding: 14, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: COLORS.success + '40', borderStyle: 'dashed' }}>
                        <MaterialCommunityIcons name="plus-circle" size={20} color={COLORS.success} />
                        <Text style={{ color: COLORS.success, fontWeight: 'bold', fontSize: 13, marginLeft: 8 }}>Tambah Pasien</Text>
                      </TouchableOpacity>
                      {hoPasien.length > 1 && (
                        <TouchableOpacity onPress={hapusPasienTerakhir} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger + '15', padding: 14, borderRadius: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: COLORS.danger + '40' }}>
                          <MaterialCommunityIcons name="minus-circle" size={20} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <MaterialCommunityIcons name="swap-horizontal" size={20} color={COLORS.success} />
                      <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 15, marginLeft: 8 }}>Serah Terima</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: T.border, marginLeft: 12 }} />
                    </View>

                    <View style={{ flexDirection: 'row', backgroundColor: T.card, borderRadius: 14, padding: 4, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: T.border }}>
                      {[{ key: 'pagi', label: '🌅 Pagi', sub: '07:00', color: COLORS.success }, { key: 'sore', label: '🌇 Sore', sub: '14:00', color: COLORS.warning }, { key: 'malam', label: '🌙 Malam', sub: '21:00', color: COLORS.secondary }].map(s => (
                        <TouchableOpacity key={s.key} onPress={() => setHoActiveShift(s.key)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: hoActiveShift === s.key ? s.color : 'transparent' }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 13, color: hoActiveShift === s.key ? '#fff' : T.text }}>{s.label}</Text>
                          <Text style={{ fontSize: 10, color: hoActiveShift === s.key ? 'rgba(255,255,255,0.7)' : T.sub, marginTop: 2 }}>{s.sub}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {['pagi', 'sore', 'malam'].map(shift => {
                      if (hoActiveShift !== shift) return null;
                      const sc = shift === 'pagi' ? COLORS.success : shift === 'sore' ? COLORS.warning : COLORS.secondary;
                      const sl = shift === 'pagi' ? 'Pagi (07:00)' : shift === 'sore' ? 'Sore (14:00)' : 'Malam (21:00)';
                      const stData = hoSerahTerima[shift] || { menyerahkan: '', menerima: '' };
                      const menyerahkanNames = stData.menyerahkan ? stData.menyerahkan.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
                      const menerimaNames = stData.menerima ? stData.menerima.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

                      return (
                        <View key={`st-${shift}`} style={{ backgroundColor: T.card, borderRadius: 14, padding: 18, elevation: 2, borderWidth: 1, borderColor: sc + '50', marginBottom: 12 }}>
                          <Text style={{ color: sc, fontWeight: 'bold', fontSize: 14, marginBottom: 15, textAlign: 'center' }}>Shift {sl}</Text>

                          <View style={{ backgroundColor: sc + '10', padding: 14, borderRadius: 12, marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <MaterialCommunityIcons name="arrow-up-circle" size={18} color={sc} />
                              <Text style={{ color: sc, fontWeight: 'bold', fontSize: 13, marginLeft: 6 }}>Menyerahkan</Text>
                              {menyerahkanNames.length > 0 && <View style={{ backgroundColor: sc, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{menyerahkanNames.length} orang</Text></View>}
                            </View>
                            {menyerahkanNames.length > 0 && (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                                {menyerahkanNames.map((nm, ni) => (
                                  <View key={`my-${ni}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: sc + '25', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 6, marginBottom: 4 }}>
                                    <Text style={{ color: sc, fontSize: 12, fontWeight: '600' }}>{nm}</Text>
                                    <TouchableOpacity onPress={() => { const nn = menyerahkanNames.filter((_, i) => i !== ni); updateHoST(shift, 'menyerahkan', nn.join(', ')); }} style={{ marginLeft: 6 }}><Ionicons name="close-circle" size={16} color={sc} /></TouchableOpacity>
                                  </View>
                                ))}
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TextInput style={{ flex: 1, backgroundColor: T.inputBg, borderWidth: 1, borderColor: sc + '40', borderRadius: 10, padding: 12, color: T.text, fontSize: 14 }} placeholder="Ketik nama atau pilih →" placeholderTextColor={T.sub} value={stData.menyerahkan} onChangeText={v => updateHoST(shift, 'menyerahkan', v)} />
                              <TouchableOpacity onPress={() => openHoPetugasModal(shift, 'menyerahkan')} style={{ marginLeft: 8, backgroundColor: sc, padding: 12, borderRadius: 10 }}><Ionicons name="people" size={18} color="#fff" /></TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: 'row', marginTop: 6 }}>
                              <TouchableOpacity onPress={() => { const cur = stData.menyerahkan; const myName = currentUser?.nama || ''; if (cur && !cur.split(',').map(s => s.trim()).includes(myName)) updateHoST(shift, 'menyerahkan', cur + ', ' + myName); else if (!cur) updateHoST(shift, 'menyerahkan', myName); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: sc + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8 }}>
                                <Ionicons name="person" size={12} color={sc} /><Text style={{ color: sc, fontSize: 10, marginLeft: 4 }}>+ Nama saya</Text>
                              </TouchableOpacity>
                              {stData.menyerahkan !== '' && (
                                <TouchableOpacity onPress={() => updateHoST(shift, 'menyerahkan', '')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                                  <Ionicons name="trash" size={12} color={COLORS.danger} /><Text style={{ color: COLORS.danger, fontSize: 10, marginLeft: 4 }}>Hapus semua</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          <View style={{ backgroundColor: COLORS.primary + '10', padding: 14, borderRadius: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <MaterialCommunityIcons name="arrow-down-circle" size={18} color={COLORS.primary} />
                              <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13, marginLeft: 6 }}>Menerima</Text>
                              {menerimaNames.length > 0 && <View style={{ backgroundColor: COLORS.primary, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{menerimaNames.length} orang</Text></View>}
                            </View>
                            {menerimaNames.length > 0 && (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                                {menerimaNames.map((nm, ni) => (
                                  <View key={`mn-${ni}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '25', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 6, marginBottom: 4 }}>
                                    <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>{nm}</Text>
                                    <TouchableOpacity onPress={() => { const nn = menerimaNames.filter((_, i) => i !== ni); updateHoST(shift, 'menerima', nn.join(', ')); }} style={{ marginLeft: 6 }}><Ionicons name="close-circle" size={16} color={COLORS.primary} /></TouchableOpacity>
                                  </View>
                                ))}
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TextInput style={{ flex: 1, backgroundColor: T.inputBg, borderWidth: 1, borderColor: COLORS.primary + '40', borderRadius: 10, padding: 12, color: T.text, fontSize: 14 }} placeholder="Ketik nama atau pilih →" placeholderTextColor={T.sub} value={stData.menerima} onChangeText={v => updateHoST(shift, 'menerima', v)} />
                              <TouchableOpacity onPress={() => openHoPetugasModal(shift, 'menerima')} style={{ marginLeft: 8, backgroundColor: COLORS.primary, padding: 12, borderRadius: 10 }}><Ionicons name="people" size={18} color="#fff" /></TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: 'row', marginTop: 6 }}>
                              <TouchableOpacity onPress={() => { const cur = stData.menerima; const myName = currentUser?.nama || ''; if (cur && !cur.split(',').map(s => s.trim()).includes(myName)) updateHoST(shift, 'menerima', cur + ', ' + myName); else if (!cur) updateHoST(shift, 'menerima', myName); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8 }}>
                                <Ionicons name="person" size={12} color={COLORS.primary} /><Text style={{ color: COLORS.primary, fontSize: 10, marginLeft: 4 }}>+ Nama saya</Text>
                              </TouchableOpacity>
                              {stData.menerima !== '' && (
                                <TouchableOpacity onPress={() => updateHoST(shift, 'menerima', '')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                                  <Ionicons name="trash" size={12} color={COLORS.danger} /><Text style={{ color: COLORS.danger, fontSize: 10, marginLeft: 4 }}>Hapus semua</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    <TouchableOpacity style={{ backgroundColor: COLORS.success, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, elevation: 5, flexDirection: 'row', justifyContent: 'center' }} onPress={saveHandOver} disabled={loading}>
                      {loading ? <ActivityIndicator color="white" /> : (
                        <><MaterialCommunityIcons name="content-save" size={22} color="white" style={{ marginRight: 10 }} /><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>SIMPAN HAND OVER</Text></>
                      )}
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                      <TouchableOpacity onPress={() => setHoShowPreview(true)} style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', marginRight: 8 }}>
                        <MaterialCommunityIcons name="table-eye" size={18} color={COLORS.primary} style={{ marginRight: 8 }} /><Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 13 }}>Preview Sheet</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => Linking.openURL(SHEET_URL)} style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.success, flexDirection: 'row', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name="google-spreadsheet" size={18} color={COLORS.success} style={{ marginRight: 8 }} /><Text style={{ color: COLORS.success, fontWeight: '600', fontSize: 13 }}>Google Sheets</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}><Text style={{ color: T.sub, fontSize: 10 }}>Data tersimpan ke spreadsheet Hand Over</Text></View>
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          )}

        </View>

        {/* ==================== NAV BAR ==================== */}
        <View style={styles.navBarContainer}>
          <Animated.View style={[styles.activeBall, { transform: [{ translateX: navAnim }], opacity: isNavView ? 1 : 0 }]}>
            <MaterialCommunityIcons name={getActiveNavIcon()} size={26} color="white" />
          </Animated.View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
            {NAV_ITEMS.map(({ key, icon }) => {
              if (key === 'input') return (
                <TouchableOpacity key={key} style={{ width: TAB_WIDTH, height: 50, justifyContent: 'center', alignItems: 'center' }} onPress={() => changeView('input')}>
                  <MaterialCommunityIcons name="plus-circle" size={40} color={COLORS.primary} style={{ opacity: view === 'input' ? 0 : 1 }} />
                </TouchableOpacity>
              );
              return <NavButton key={key} icon={icon} onPress={() => changeView(key)} isActive={view === key} />;
            })}
          </View>
        </View>

        {/* ==================== SIDEBAR ==================== */}
        <Modal visible={sidebar} transparent animationType="fade">
          <View style={styles.sidebarOverlay}>
            <View style={styles.sidebarContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 25 }}>
                  <LinearGradient colors={COLORS.gradientSecondary} style={{ width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                    <MaterialCommunityIcons name="hospital-building" size={30} color="white" />
                  </LinearGradient>
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.white }}>SIMAS</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{APP_VERSION}</Text>
                  <View style={{ backgroundColor: COLORS.primary + '30', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 8 }}>
                    <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: 'bold' }}>👤 {currentUser?.nama} </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={toggleMode} style={styles.sideItem}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={mode === 'light' ? 'weather-night' : 'white-balance-sunny'} size={20} color={COLORS.primary} />
                  </View>
                  <Text style={{ marginLeft: 12, color: COLORS.white, fontWeight: '600' }}>Mode {mode === 'light' ? 'Dark' : 'Light'}</Text>
                </TouchableOpacity>
                {[...NAV_ITEMS, { key: 'handover', icon: 'clipboard-text', label: 'Hand Over' }, { key: 'isiset', icon: 'format-list-bulleted', label: 'Isi Set' }].map(({ key, icon, label }) => (
                  <TouchableOpacity key={key} style={styles.sideItem} onPress={() => { changeView(key); setSidebar(false); }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: view === key ? (key === 'handover' ? COLORS.success + '30' : COLORS.primary + '30') : 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}> 
                      <MaterialCommunityIcons name={icon} size={20} color={view === key ? (key === 'handover' ? COLORS.success : COLORS.primary) : COLORS.white} />
                    </View>
                    <Text style={{ marginLeft: 12, color: view === key ? (key === 'handover' ? COLORS.success : COLORS.primary) : COLORS.white, fontWeight: view === key ? 'bold' : 'normal' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 }} />
                <TouchableOpacity style={styles.sideItem} onPress={() => { setSidebar(false); setShowChangePin(true); }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.warning + '20', justifyContent: 'center', alignItems: 'center' }}><Ionicons name="key" size={20} color={COLORS.warning} /></View>
                  <Text style={{ marginLeft: 12, color: COLORS.white }}>Ubah PIN</Text>
                </TouchableOpacity>
                {isAdmin && (
                  <TouchableOpacity style={styles.sideItem} onPress={() => { fetchData('getUsers'); setShowUserModal(true); setSidebar(false); }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.menu6 + '20', justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="account-group" size={20} color={COLORS.menu6} /></View>
                    <Text style={{ marginLeft: 12, color: COLORS.white }}>Kelola User</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.sideItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.danger + '20', justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="logout" size={20} color={COLORS.danger} /></View>
                  <Text style={{ marginLeft: 12, color: COLORS.danger, fontWeight: 'bold' }}>Logout</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSidebar(false)} style={{ marginTop: 15, alignSelf: 'center', backgroundColor: COLORS.danger + '20', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20 }}>
                  <Text style={{ color: COLORS.danger, fontWeight: 'bold' }}>✕ Tutup</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setSidebar(false)} activeOpacity={1} />
          </View>
        </Modal>

        {/* ==================== MODAL DROPDOWN — ★ CHANGED: bulan pakai MONTHS_WITH_ALL ==================== */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }} activeOpacity={1} onPress={() => { if (modalType !== 'hoMultiPetugas') setModalVisible(false); }}>
            <View style={{ backgroundColor: T.card, borderRadius: 20, maxHeight: '70%', overflow: 'hidden' }}>
              <View style={{ padding: 20, borderBottomWidth: 1, borderColor: T.border }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: T.text, marginBottom: 15 }}>
                  {modalType === 'petugas' ? '👤 Petugas' : modalType === 'alat' ? '🔧 Instrument' : modalType === 'bulan' ? '📅 Bulan Laporan' : modalType === 'statBulan' ? '📅 Bulan Statistik' : modalType === 'statTahun' ? '📅 Tahun Statistik' : modalType === 'hoMultiPetugas' ? '👥 Pilih Petugas (Multi)' : '📅 Tahun'}
                </Text>
                {modalType === 'hoMultiPetugas' && hoMultiSelect.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
                    {hoMultiSelect.map((nm, ni) => (
                      <View key={`ms-${ni}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 6, marginBottom: 4 }}>
                        <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>{nm}</Text>
                        <TouchableOpacity onPress={() => toggleHoMultiSelect(nm)} style={{ marginLeft: 6 }}><Ionicons name="close-circle" size={16} color={COLORS.primary} /></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBg, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: T.border }}>
                  <Ionicons name="search" size={18} color={T.sub} />
                  <TextInput style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: T.text }} placeholder="Cari..." placeholderTextColor={T.sub} autoFocus onChangeText={setModalSearch} value={modalSearch} />
                </View>
              </View>
              <FlatList
                data={(modalType === 'petugas' ? dropdownList.petugas : modalType === 'alat' ? dropdownList.alat : modalType === 'bulan' ? MONTHS_WITH_ALL : modalType === 'statBulan' ? MONTHS_WITH_ALL : (modalType === 'tahun' || modalType === 'statTahun') ? YEARS : modalType === 'hoMultiPetugas' ? dropdownList.petugas : []).filter(i => i?.toString().toLowerCase().includes(modalSearch.toLowerCase()))}
                keyExtractor={(x, i) => `m-${i}`} keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = modalType === 'hoMultiPetugas' && hoMultiSelect.includes(item);
                  return (
                    <TouchableOpacity style={{ padding: 16, borderBottomWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? COLORS.primary + '15' : 'transparent' }} onPress={() => handleModalSelect(item)}>
                      {modalType === 'hoMultiPetugas' && (
                        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: isSelected ? COLORS.primary : T.sub, backgroundColor: isSelected ? COLORS.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                        </View>
                      )}
                      <Ionicons name={modalType === 'petugas' || modalType === 'hoMultiPetugas' ? 'person' : modalType === 'alat' ? 'construct' : 'calendar'} size={18} color={isSelected ? COLORS.primary : T.sub} style={{ marginRight: 12 }} />
                      <Text style={{ color: isSelected ? COLORS.primary : T.text, fontSize: 15, fontWeight: isSelected ? 'bold' : 'normal' }}>{item}</Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<View style={{ padding: 30, alignItems: 'center' }}><Text style={{ color: T.sub }}>Tidak ditemukan</Text></View>}
              />
              {modalType === 'hoMultiPetugas' && (
                <View style={{ padding: 15, borderTopWidth: 1, borderColor: T.border, flexDirection: 'row' }}>
                  <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: T.bg, marginRight: 8 }} onPress={() => { setModalVisible(false); setHoMultiSelect([]); }}>
                    <Text style={{ color: T.text, fontWeight: '600' }}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary }} onPress={confirmHoMultiSelect}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>✓ Pilih ({hoMultiSelect.length})</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ==================== DETAIL DASHBOARD ==================== */}
        <Modal visible={detailItem !== null && detailItem !== 'editLapor' && detailSource === 'dashboard'} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: T.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, maxHeight: '80%' }}>
              <View style={{ width: 40, height: 5, backgroundColor: T.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}><MaterialCommunityIcons name="medical-bag" size={30} color={COLORS.primary} /></View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.secondary, textAlign: 'center' }}>{detailItem?.alat}</Text>
                {detailItem?.tglED && detailItem?.status !== 'KOTOR' && (() => { const d = getDaysRemaining(detailItem.tglED); return d !== null ? (<View style={{ marginTop: 12, backgroundColor: T.bg, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: COLORS.primary + '50' }}><Text style={{ fontSize: 10, color: T.sub, textAlign: 'center' }}>Sisa Steril</Text><Text style={{ fontSize: 24, fontWeight: 'bold', color: d <= 0 ? COLORS.danger : COLORS.primary, textAlign: 'center' }}>{d} Hari</Text></View>) : null; })()}
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                <DetailRow icon="person" l="Petugas" v={detailItem?.petugas} />
                <DetailRow icon="shield-checkmark" l="Status" v={detailItem?.status} />
                <DetailRow icon="calendar" l="Steril" v={formatDate(detailItem?.tglSteril)} />
                <DetailRow icon="calendar-outline" l="Expired" v={formatDate(detailItem?.tglED)} />
                <DetailRow icon="document-text" l="Ket" v={detailItem?.ket || '-'} />
              </ScrollView>
              <View style={{ flexDirection: 'row', marginTop: 20 }}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: COLORS.secondary, padding: 14, borderRadius: 12, alignItems: 'center', marginRight: 10 }} onPress={closeDetail}><Text style={{ color: 'white', fontWeight: 'bold' }}>TUTUP</Text></TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, backgroundColor: COLORS.warning, padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }} onPress={() => { handleEditFromDashboard(detailItem); closeDetail(); }}><MaterialCommunityIcons name="pencil" size={16} color="black" style={{ marginRight: 6 }} /><Text style={{ color: 'black', fontWeight: 'bold' }}>EDIT</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ==================== DETAIL LAPORAN ==================== */}
        <Modal visible={detailItem !== null && detailItem !== 'editLapor' && detailSource === 'laporan'} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: T.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, maxHeight: '80%' }}>
              <View style={{ width: 40, height: 5, backgroundColor: T.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                {(() => { const im = detailItem?.aksi === 'MASUK'; const c = im ? COLORS.statSteril : COLORS.danger; return (<><View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}><MaterialCommunityIcons name={im ? 'arrow-down-circle' : 'arrow-up-circle'} size={30} color={c} /></View><Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.secondary, textAlign: 'center' }}>{detailItem?.alat}</Text><View style={{ marginTop: 10, backgroundColor: c, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{detailItem?.aksi}</Text></View></>); })()}
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                <DetailRow icon="person" l="Petugas" v={detailItem?.petugas} />
                <DetailRow icon="calendar" l="Tanggal" v={formatDate(detailItem?.tgl)} />
                <DetailRow icon="document-text" l="Ket" v={getKeteranganLaporan(detailItem)} />
              </ScrollView>
              <View style={{ marginTop: 20 }}>
                <TouchableOpacity style={{ backgroundColor: COLORS.secondary, padding: 14, borderRadius: 12, alignItems: 'center' }} onPress={closeDetail}><Text style={{ color: 'white', fontWeight: 'bold' }}>TUTUP</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ==================== CETAK PDF LAPORAN — ★ CHANGED: label periode ==================== */}
        <Modal visible={cetakOptions} transparent animationType="fade">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => !loading && setCetakOptions(false)}>
            <View style={{ backgroundColor: T.card, width: width - 60, padding: 25, borderRadius: 20 }}>
              <View style={{ alignItems: 'center', marginBottom: 25 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#E53935' + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}><MaterialCommunityIcons name="file-pdf-box" size={30} color="#E53935" /></View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: T.text }}>Cetak PDF</Text>
                {/* ★ CHANGED: gunakan lapPeriodLabel */}
                <Text style={{ color: T.sub, fontSize: 13, marginTop: 6 }}>{lapPeriodLabel} • {exportData.length} data</Text>
              </View>
              {exportStatus ? <View style={{ backgroundColor: COLORS.primary + '15', padding: 12, borderRadius: 10, marginBottom: 15, alignItems: 'center' }}><ActivityIndicator size="small" color={COLORS.primary} /><Text style={{ color: COLORS.primary, marginTop: 8, fontSize: 12 }}>{exportStatus}</Text></View> : null}
              <TouchableOpacity style={{ backgroundColor: '#E53935', padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, opacity: loading ? 0.6 : 1 }} onPress={cetakPDFLangsung} disabled={loading}>
                <MaterialCommunityIcons name="printer" size={22} color="white" style={{ marginRight: 12 }} />
                <Text style={{ color: 'white', fontWeight: 'bold', flex: 1 }}>Cetak Langsung</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: '#1976D2', padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 20, opacity: loading ? 0.6 : 1 }} onPress={downloadPDF} disabled={loading}>
                <MaterialCommunityIcons name="download" size={22} color="white" style={{ marginRight: 12 }} />
                <Text style={{ color: 'white', fontWeight: 'bold', flex: 1 }}>Simpan PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: T.bg, borderWidth: 1, borderColor: T.border }} onPress={() => setCetakOptions(false)} disabled={loading}>
                <Text style={{ color: T.text, fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ==================== CETAK STATISTIK PDF ==================== */}
        <Modal visible={cetakStatistik} transparent animationType="fade">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => !loading && setCetakStatistik(false)}>
            <View style={{ backgroundColor: T.card, width: width - 60, padding: 25, borderRadius: 20 }}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.chart1 + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <MaterialCommunityIcons name="chart-box" size={30} color={COLORS.chart1} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: T.text }}>Cetak Statistik</Text>
                <Text style={{ color: T.sub, fontSize: 13, marginTop: 6 }}>
                  📊 {statBulan === 'semua' ? `Semua Bulan ${statTahun}` : `${MONTHS[statBulan]} ${statTahun}`}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
                  <View style={{ backgroundColor: COLORS.statSteril + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8, marginBottom: 4 }}>
                    <Text style={{ color: COLORS.statSteril, fontSize: 10, fontWeight: 'bold' }}>Masuk: {statistikData?.totalMasuk || 0}</Text>
                  </View>
                  <View style={{ backgroundColor: COLORS.danger + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 4 }}>
                    <Text style={{ color: COLORS.danger, fontSize: 10, fontWeight: 'bold' }}>Keluar: {statistikData?.totalKeluar || 0}</Text>
                  </View>
                </View>
              </View>
              <View style={{ marginBottom: 18 }}>
                <Text style={{ color: T.sub, fontSize: 11, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>Tipe Grafik Trend Bulanan</Text>
                <View style={{ flexDirection: 'row', backgroundColor: T.bg, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: T.border }}>
                  <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: statChartType === 'bar' ? COLORS.primary : 'transparent' }} onPress={() => setStatChartType('bar')}>
                    <MaterialCommunityIcons name="chart-bar" size={18} color={statChartType === 'bar' ? 'white' : T.sub} style={{ marginRight: 6 }} />
                    <Text style={{ color: statChartType === 'bar' ? 'white' : T.sub, fontWeight: statChartType === 'bar' ? 'bold' : 'normal', fontSize: 13 }}>Bar Chart</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: statChartType === 'line' ? COLORS.primary : 'transparent' }} onPress={() => setStatChartType('line')}>
                    <MaterialCommunityIcons name="chart-line" size={18} color={statChartType === 'line' ? 'white' : T.sub} style={{ marginRight: 6 }} />
                    <Text style={{ color: statChartType === 'line' ? 'white' : T.sub, fontWeight: statChartType === 'line' ? 'bold' : 'normal', fontSize: 13 }}>Line Chart</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {exportStatus ? (
                <View style={{ backgroundColor: COLORS.primary + '15', padding: 12, borderRadius: 10, marginBottom: 15, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={{ color: COLORS.primary, marginTop: 8, fontSize: 12 }}>{exportStatus}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={{ backgroundColor: '#E53935', padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, opacity: loading ? 0.6 : 1 }} onPress={cetakStatistikPDF} disabled={loading}>
                <MaterialCommunityIcons name="printer" size={22} color="white" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Cetak Langsung</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Print ke printer ({statChartType === 'line' ? 'Line' : 'Bar'} Chart)</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: '#1976D2', padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 20, opacity: loading ? 0.6 : 1 }} onPress={downloadStatistikPDF} disabled={loading}>
                <MaterialCommunityIcons name="download" size={22} color="white" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Simpan / Share PDF</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Download atau bagikan ({statChartType === 'line' ? 'Line' : 'Bar'} Chart)</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={{ padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: T.bg, borderWidth: 1, borderColor: T.border }} onPress={() => setCetakStatistik(false)} disabled={loading}>
                <Text style={{ color: T.text, fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ==================== EDIT LAPORAN ==================== */}
        <Modal visible={detailItem === 'editLapor'} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: T.card, padding: 25, borderRadius: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: T.text, marginBottom: 20 }}>✏️ Edit Laporan</Text>
              <Text style={{ color: T.sub, marginBottom: 8 }}>Tanggal</Text>
              <TouchableOpacity style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]} onPress={() => setShowPicker('lapor')}>
                <Ionicons name="calendar" size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
                <Text style={{ color: T.text }}>{tempHist?.tgl}</Text>
              </TouchableOpacity>
              <Text style={{ color: T.sub, marginBottom: 8 }}>Keterangan</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={tempHist?.ket} onChangeText={t => setTempHist(p => ({ ...p, ket: t }))} placeholder="Ket..." placeholderTextColor={T.sub} multiline />
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: COLORS.warning }]} onPress={handleEditLaporanSubmit}>
                <MaterialCommunityIcons name="content-save" size={20} color="black" style={{ marginRight: 8 }} />
                <Text style={{ color: 'black', fontWeight: 'bold' }}>SIMPAN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: COLORS.danger }]} onPress={() => { setAlasanAction('hapusLapor'); setAlasanText(''); setAlasanModal(true); }}>
                <MaterialCommunityIcons name="delete" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={{ color: 'white', fontWeight: 'bold' }}>HAPUS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 15, padding: 12, backgroundColor: COLORS.secondary, paddingHorizontal: 30, borderRadius: 12 }} onPress={() => setDetailItem(null)}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ==================== ALASAN ==================== */}
        <Modal visible={alasanModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: T.card, padding: 25, borderRadius: 20 }}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.warning + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}><MaterialCommunityIcons name="alert" size={26} color={COLORS.warning} /></View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: T.text }}>Alasan (min {MIN_ALASAN_WORDS} kata)</Text>
              </View>
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline placeholder="Alasan..." placeholderTextColor={T.sub} onChangeText={setAlasanText} value={alasanText} />
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAlasanSubmit}><Text style={{ color: 'white', fontWeight: 'bold' }}>KONFIRMASI</Text></TouchableOpacity>
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 15, padding: 12, backgroundColor: COLORS.secondary, paddingHorizontal: 30, borderRadius: 12 }} onPress={() => setAlasanModal(false)}><Text style={{ color: 'white', fontWeight: 'bold' }}>Batal</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ==================== KELOLA USER ==================== */}
        <Modal visible={showUserModal} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: T.card, borderRadius: 20, maxHeight: '85%', padding: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: T.text, marginBottom: 15 }}>👥 Kelola User</Text>
              <View style={{ backgroundColor: T.bg, padding: 15, borderRadius: 12, marginBottom: 15 }}>
                <Text style={{ color: T.text, fontWeight: 'bold', marginBottom: 10 }}>{editingUser ? '✏️ Edit User' : '➕ Tambah User'}</Text>
                <TextInput style={[styles.input, { marginBottom: 10 }]} placeholder="Username" placeholderTextColor={T.sub} value={userForm.username} onChangeText={t => setUserForm(p => ({ ...p, username: t }))} autoCapitalize="none" />
                <TextInput style={[styles.input, { marginBottom: 10 }]} placeholder={editingUser ? "PIN (kosong=tidak ubah)" : "PIN (min 4 digit)"} placeholderTextColor={T.sub} value={userForm.pin} onChangeText={t => setUserForm(p => ({ ...p, pin: t }))} keyboardType="number-pad" maxLength={6} secureTextEntry />
                <TextInput style={[styles.input, { marginBottom: 10 }]} placeholder="Nama Lengkap" placeholderTextColor={T.sub} value={userForm.nama} onChangeText={t => setUserForm(p => ({ ...p, nama: t }))} />
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  {['petugas', 'admin'].map(r => (
                    <TouchableOpacity key={r} onPress={() => setUserForm(p => ({ ...p, role: r }))} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: userForm.role === r ? (r === 'admin' ? COLORS.danger : COLORS.primary) : T.inputBg, marginHorizontal: 4, alignItems: 'center' }}>
                      <Text style={{ color: userForm.role === r ? 'white' : T.text, fontWeight: 'bold', fontSize: 13 }}>{r.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 0, backgroundColor: editingUser ? COLORS.warning : COLORS.success }]} onPress={() => {
                  if (!userForm.username || userForm.username.length < 3) { Alert.alert('Error', 'Username minimal 3 karakter'); return; }
                  if (!/^[a-zA-Z0-9_]+$/.test(userForm.username)) { Alert.alert('Error', 'Username hanya huruf, angka, underscore'); return; }
                  if (!editingUser && (!userForm.pin || userForm.pin.length < 4)) { Alert.alert('Error', 'PIN minimal 4 digit'); return; }
                  if (userForm.pin && !/^\d+$/.test(userForm.pin)) { Alert.alert('Error', 'PIN harus angka'); return; }
                  if (editingUser) kirim('updateUser', { id: editingUser.id, oldUsername: editingUser.username, ...userForm });
                  else kirim('tambahUser', userForm);
                }}><Text style={{ color: 'white', fontWeight: 'bold' }}>{editingUser ? 'UPDATE' : 'TAMBAH'}</Text></TouchableOpacity>
                {editingUser && <TouchableOpacity onPress={() => { setEditingUser(null); setUserForm({ username: '', pin: '', nama: '', role: 'petugas' }); }} style={{ alignSelf: 'center', marginTop: 8 }}><Text style={{ color: COLORS.primary, fontSize: 12 }}>Batal Edit</Text></TouchableOpacity>}
              </View>
              <FlatList data={users} keyExtractor={(i, idx) => `u-${idx}`} style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: T.bg, borderRadius: 10, marginBottom: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: item.role === 'admin' ? COLORS.danger + '20' : COLORS.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <MaterialCommunityIcons name={item.role === 'admin' ? 'shield-account' : 'account'} size={18} color={item.role === 'admin' ? COLORS.danger : COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}><Text style={{ color: T.text, fontWeight: 'bold', fontSize: 13 }}>{item.nama}</Text><Text style={{ color: T.sub, fontSize: 11 }}>@{item.username} • {item.role}</Text></View>
                    <TouchableOpacity onPress={() => { setEditingUser(item); setUserForm({ username: item.username, pin: '', nama: item.nama, role: item.role }); }} style={{ padding: 6 }}><MaterialCommunityIcons name="pencil" size={18} color={COLORS.warning} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Hapus?', `User "${item.nama}"?`, [{ text: 'Batal' }, { text: 'Hapus', style: 'destructive', onPress: () => kirim('hapusUser', { id: item.id, username: item.username }) }])} style={{ padding: 6 }}><MaterialCommunityIcons name="delete" size={18} color={COLORS.danger} /></TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ color: T.sub, textAlign: 'center', padding: 20 }}>Belum ada user</Text>} />
              <TouchableOpacity style={{ marginTop: 15, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.secondary }} onPress={() => { setShowUserModal(false); setEditingUser(null); setUserForm({ username: '', pin: '', nama: '', role: 'petugas' }); }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ==================== DETAIL PASIEN HAND OVER ==================== */}
        <Modal visible={hoDetailPasien !== null} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: T.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, maxHeight: '90%' }}>
              <View style={{ width: 40, height: 5, backgroundColor: T.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.success + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.success }}>{hoDetailPasien?.no}</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: T.text, textAlign: 'center' }}>{hoDetailPasien?.identitas || '-'}</Text>
                <Text style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>Pasien #{hoDetailPasien?.no}</Text>
              </View>
              <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: T.bg, padding: 16, borderRadius: 14, marginBottom: 12 }}>
                  <Text style={{ color: COLORS.success, fontWeight: 'bold', fontSize: 13, marginBottom: 12 }}>📋 Informasi Pasien</Text>
                  {[{ label: 'Identitas', value: hoDetailPasien?.identitas }, { label: 'Diagnosa', value: hoDetailPasien?.diagnosa }, { label: 'Tindakan', value: hoDetailPasien?.tindakan }, { label: 'DPJP - PPJP', value: hoDetailPasien?.dpjp }].map((field, i) => (
                    <React.Fragment key={i}>
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: T.sub, fontSize: 11, fontWeight: '600' }}>{field.label}</Text>
                        <Text style={{ color: T.text, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{field.value || '-'}</Text>
                      </View>
                      {i < 3 && <View style={{ height: 1, backgroundColor: T.border, marginBottom: 10 }} />}
                    </React.Fragment>
                  ))}
                </View>
                <View style={{ backgroundColor: T.bg, padding: 16, borderRadius: 14, marginBottom: 12 }}>
                  <Text style={{ color: COLORS.success, fontWeight: 'bold', fontSize: 13, marginBottom: 12 }}>📝 Uraian Tugas</Text>
                  {[{ key: 'pagi', label: '🌅 PAGI (07:00)', color: COLORS.success }, { key: 'sore', label: '🌇 SORE (14:00)', color: COLORS.warning }, { key: 'malam', label: '🌙 MALAM (21:00)', color: COLORS.secondary }].map((shift, i) => (
                    <View key={shift.key} style={{ marginBottom: i < 2 ? 12 : 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: shift.color, marginRight: 8 }} />
                        <Text style={{ color: shift.color, fontWeight: 'bold', fontSize: 12 }}>{shift.label}</Text>
                      </View>
                      <View style={{ backgroundColor: T.card, padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: shift.color, minHeight: 40 }}>
                        <Text style={{ color: T.text, fontSize: 13, lineHeight: 22 }}>{hoDetailPasien?.[shift.key] || '—'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={{ flexDirection: 'row', marginTop: 15 }}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: COLORS.secondary, padding: 14, borderRadius: 12, alignItems: 'center', marginRight: 10 }} onPress={() => setHoDetailPasien(null)}><Text style={{ color: 'white', fontWeight: 'bold' }}>TUTUP</Text></TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, backgroundColor: COLORS.success, padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }} onPress={() => { setHoExpandedIdx((hoDetailPasien?.no || 1) - 1); setHoDetailPasien(null); }}>
                  <MaterialCommunityIcons name="pencil" size={16} color="white" style={{ marginRight: 6 }} /><Text style={{ color: 'white', fontWeight: 'bold' }}>EDIT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ==================== RIWAYAT SHEET HO ==================== */}
        <Modal visible={hoShowRiwayat} transparent animationType="fade">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }} activeOpacity={1} onPress={() => setHoShowRiwayat(false)}>
            <View style={{ backgroundColor: T.card, borderRadius: 20, maxHeight: '70%', overflow: 'hidden' }}>
              <View style={{ padding: 20, borderBottomWidth: 1, borderColor: T.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><MaterialCommunityIcons name="history" size={24} color={COLORS.secondary} /><Text style={{ fontSize: 18, fontWeight: 'bold', color: T.text, marginLeft: 10 }}>Riwayat Hand Over</Text></View>
                <Text style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>Pilih tanggal untuk memuat data</Text>
              </View>
              <FlatList data={hoRiwayat} keyExtractor={(item, i) => `ho-r-${i}`} keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity style={{ padding: 16, borderBottomWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center' }} onPress={() => hoSelectRiwayat(item)}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.success + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}><MaterialCommunityIcons name="calendar-check" size={18} color={COLORS.success} /></View>
                    <Text style={{ color: T.text, fontSize: 15, flex: 1 }}>{item}</Text><Ionicons name="chevron-forward" size={18} color={T.sub} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<View style={{ padding: 30, alignItems: 'center' }}><MaterialCommunityIcons name="calendar-blank" size={40} color={T.sub} /><Text style={{ color: T.sub, marginTop: 10 }}>Belum ada sheet</Text></View>} />
              <TouchableOpacity style={{ padding: 16, alignItems: 'center', backgroundColor: COLORS.secondary, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }} onPress={() => setHoShowRiwayat(false)}><Text style={{ color: 'white', fontWeight: 'bold' }}>Tutup</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ==================== PREVIEW SHEET HAND OVER ==================== */}
        <Modal visible={hoShowPreview} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View style={{ flex: 1, marginTop: 40, backgroundColor: T.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: T.border, backgroundColor: COLORS.primary + '10' }}>
                <MaterialCommunityIcons name="table-eye" size={24} color={COLORS.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 16 }}>Preview Sheet</Text>
                  <Text style={{ color: T.sub, fontSize: 11 }}>{hoSheetName || formatDate(hoTanggal)}</Text>
                </View>
                <TouchableOpacity onPress={() => setHoShowPreview(false)} style={{ padding: 8, backgroundColor: COLORS.danger + '20', borderRadius: 10 }}>
                  <Ionicons name="close" size={22} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View>
                    <View style={{ backgroundColor: '#4a86c8', padding: 12, borderTopLeftRadius: 8, borderTopRightRadius: 8, minWidth: 1070 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, textAlign: 'center' }}>{hoSheetName || formatDate(hoTanggal)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', backgroundColor: '#d9e2f3', borderWidth: 1, borderColor: '#999', minWidth: 1070 }}>
                      <Text style={{ width: 35, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderColor: '#999', color: '#333' }}>No</Text>
                      <Text style={{ width: 160, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderColor: '#999', color: '#333' }}>IDENTITAS</Text>
                      <Text style={{ width: 150, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderColor: '#999', color: '#333' }}>DIAGNOSA</Text>
                      <Text style={{ width: 150, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderColor: '#999', color: '#333' }}>TINDAKAN</Text>
                      <Text style={{ width: 120, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderColor: '#999', color: '#333' }}>DPJP</Text>
                      <Text style={{ width: 150, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderColor: '#999', color: COLORS.success }}>PAGI</Text>
                      <Text style={{ width: 150, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderColor: '#999', color: COLORS.warning }}>SORE</Text>
                      <Text style={{ width: 150, padding: 6, fontSize: 9, fontWeight: 'bold', textAlign: 'center', borderColor: '#999', color: COLORS.secondary }}>MALAM</Text>
                    </View>
                    {hoPasien.map((p, idx) => (
                      <View key={`pv-${idx}`} style={{ flexDirection: 'row', borderWidth: 1, borderTopWidth: 0, borderColor: '#999', backgroundColor: idx % 2 === 0 ? '#fff' : '#f5f5f5', minWidth: 1070 }}>
                        <Text style={{ width: 35, padding: 6, fontSize: 9, textAlign: 'center', borderRightWidth: 1, borderColor: '#ccc', color: '#333' }}>{idx + 1}</Text>
                        <Text style={{ width: 160, padding: 6, fontSize: 9, borderRightWidth: 1, borderColor: '#ccc', color: '#333' }}>{p.identitas || '-'}</Text>
                        <Text style={{ width: 150, padding: 6, fontSize: 9, borderRightWidth: 1, borderColor: '#ccc', color: '#333' }}>{p.diagnosa || '-'}</Text>
                        <Text style={{ width: 150, padding: 6, fontSize: 9, borderRightWidth: 1, borderColor: '#ccc', color: '#333' }}>{p.tindakan || '-'}</Text>
                        <Text style={{ width: 120, padding: 6, fontSize: 9, borderRightWidth: 1, borderColor: '#ccc', color: '#333' }}>{p.dpjp || '-'}</Text>
                        <Text style={{ width: 150, padding: 6, fontSize: 9, borderRightWidth: 1, borderColor: '#ccc', color: '#333' }}>{p.pagi || '-'}</Text>
                        <Text style={{ width: 150, padding: 6, fontSize: 9, borderRightWidth: 1, borderColor: '#ccc', color: '#333' }}>{p.sore || '-'}</Text>
                        <Text style={{ width: 150, padding: 6, fontSize: 9, color: '#333' }}>{p.malam || '-'}</Text>
                      </View>
                    ))}
                    <View style={{ marginTop: 20, minWidth: 1070 }}>
                      <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#999', backgroundColor: '#e8f5e9' }}>
                        <View style={{ flex: 1 }} />
                        <Text style={{ width: 150, padding: 8, fontSize: 10, fontWeight: 'bold', textAlign: 'center', borderLeftWidth: 1, borderColor: '#999' }}>Jam 07</Text>
                        <Text style={{ width: 150, padding: 8, fontSize: 10, fontWeight: 'bold', textAlign: 'center', borderLeftWidth: 1, borderColor: '#999' }}>Jam 14</Text>
                        <Text style={{ width: 150, padding: 8, fontSize: 10, fontWeight: 'bold', textAlign: 'center', borderLeftWidth: 1, borderColor: '#999' }}>Jam 21</Text>
                      </View>
                      <View style={{ flexDirection: 'row', borderWidth: 1, borderTopWidth: 0, borderColor: '#999', backgroundColor: '#fff3e0' }}>
                        <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 10 }}><Text style={{ fontSize: 10, fontWeight: 'bold', color: '#e65100' }}>Menyerahkan</Text></View>
                        <Text style={{ width: 150, padding: 8, fontSize: 9, textAlign: 'center', borderLeftWidth: 1, borderColor: '#999', color: '#333' }}>{hoSerahTerima.pagi?.menyerahkan || '-'}</Text>
                        <Text style={{ width: 150, padding: 8, fontSize: 9, textAlign: 'center', borderLeftWidth: 1, borderColor: '#999', color: '#333' }}>{hoSerahTerima.sore?.menyerahkan || '-'}</Text>
                        <Text style={{ width: 150, padding: 8, fontSize: 9, textAlign: 'center', borderLeftWidth: 1, borderColor: '#999', color: '#333' }}>{hoSerahTerima.malam?.menyerahkan || '-'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', borderWidth: 1, borderTopWidth: 0, borderColor: '#999', backgroundColor: '#e3f2fd' }}>
                        <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 10 }}><Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1565c0' }}>Menerima</Text></View>
                        <Text style={{ width: 150, padding: 8, fontSize: 9, textAlign: 'center', borderLeftWidth: 1, borderColor: '#999', color: '#333' }}>{hoSerahTerima.pagi?.menerima || '-'}</Text>
                        <Text style={{ width: 150, padding: 8, fontSize: 9, textAlign: 'center', borderLeftWidth: 1, borderColor: '#999', color: '#333' }}>{hoSerahTerima.sore?.menerima || '-'}</Text>
                        <Text style={{ width: 150, padding: 8, fontSize: 9, textAlign: 'center', borderLeftWidth: 1, borderColor: '#999', color: '#333' }}>{hoSerahTerima.malam?.menerima || '-'}</Text>
                      </View>
                    </View>
                    <View style={{ padding: 15, marginTop: 10, minWidth: 1070 }}>
                      <Text style={{ color: T.sub, fontSize: 10, textAlign: 'center' }}>
                        📊 Total Baris: {hoPasien.length} | Pasien Terisi: {hoFilledPasienCount} | Kosong: {hoPasien.length - hoFilledPasienCount}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              </ScrollView>
              <View style={{ flexDirection: 'row', padding: 15, borderTopWidth: 1, borderColor: T.border }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.secondary, marginRight: 8 }} onPress={() => setHoShowPreview(false)}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>TUTUP</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.success, flexDirection: 'row', justifyContent: 'center' }} onPress={() => { setHoShowPreview(false); Linking.openURL(SHEET_URL); }}>
                  <MaterialCommunityIcons name="google-spreadsheet" size={16} color="white" style={{ marginRight: 6 }} />
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Buka Sheets</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ==================== CHANGE PIN & DATE PICKER ==================== */}
        <ChangePinModal visible={showChangePin} onClose={() => setShowChangePin(false)} currentUser={currentUser} />

        {showPicker && (
          <DateTimePicker
            value={getPickerDate()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        {/* ==================== LOADING OVERLAY ==================== */}
        {loading && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
            <View style={{ backgroundColor: T.card, padding: 25, borderRadius: 16, alignItems: 'center', minWidth: 150 }}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={{ color: T.text, marginTop: 12, fontWeight: '600' }}>{exportStatus || 'Memproses...'}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}
