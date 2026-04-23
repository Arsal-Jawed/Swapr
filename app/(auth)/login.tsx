import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HERO_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=600&fit=crop';

interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}

function InputField({ label, placeholder, value, onChangeText, icon, secure, keyboardType, autoCapitalize }: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const isSecure = secure && !showPassword;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
        <Ionicons
          name={icon}
          size={18}
          color={isFocused ? Colors.primary : Colors.accent}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.accent}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          secureTextEntry={isSecure}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={Colors.accent}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroWrapper}>
        <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroOverlay} />
        <View style={styles.heroBadge}>
          <View style={styles.heroBadgeIcon}>
            <Text style={styles.heroBadgeIconText}>S</Text>
          </View>
          <Text style={styles.heroBadgeLabel}>Swapr</Text>
        </View>
        <View style={styles.heroTextWrapper}>
          <Text style={styles.heroTitle}>Swap Skills,</Text>
          <Text style={styles.heroSubtitle}>Grow Together.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSubtitle}>Sign in to your Swapr account</Text>

        {error.length > 0 && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <InputField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          icon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <InputField
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          icon="lock-closed-outline"
          secure={true}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.forgotLink}>
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.secondaryBtnText}>
            Don't have an account?{' '}
            <Text style={styles.secondaryBtnHighlight}>Create one</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={styles.flex}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  heroWrapper: {
    width: SCREEN_WIDTH,
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(76, 29, 149, 0.55)',
  },
  heroBadge: {
    position: 'absolute',
    top: 54,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeIconText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
  },
  heroBadgeLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  heroTextWrapper: {
    position: 'absolute',
    bottom: 28,
    left: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 38,
  },
  heroSubtitle: {
    fontSize: 32,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 38,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '500',
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -6,
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
  },
  secondaryBtn: {
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  secondaryBtnHighlight: {
    color: Colors.primary,
    fontWeight: '800',
  },
});
