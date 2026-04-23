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
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HERO_IMAGE = 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&h=600&fit=crop';

interface FieldConfig {
  key: 'name' | 'email' | 'password' | 'confirmPassword' | 'skillsOffered' | 'skillsNeeded';
  label: string;
  placeholder: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  keyboard?: 'default' | 'email-address';
  secure?: boolean;
  multiline?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Full Name', placeholder: 'Your full name', icon: 'person-outline', keyboard: 'default' },
  { key: 'email', label: 'Email', placeholder: 'you@example.com', icon: 'mail-outline', keyboard: 'email-address' },
  { key: 'password', label: 'Password', placeholder: 'Min. 6 characters', icon: 'lock-closed-outline', secure: true },
  { key: 'confirmPassword', label: 'Confirm Password', placeholder: 'Repeat your password', icon: 'lock-closed-outline', secure: true },
  { key: 'skillsOffered', label: 'Skills Offered', placeholder: 'e.g. UI Design, Photography', icon: 'flash-outline', multiline: true },
  { key: 'skillsNeeded', label: 'Skills Needed', placeholder: 'e.g. Web Dev, Copywriting', icon: 'search-outline', multiline: true },
];

type FormState = Record<FieldConfig['key'], string>;

export default function SignupScreen() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    skillsOffered: '',
    skillsNeeded: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<FieldConfig['key'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateField(key: FieldConfig['key'], value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string {
    if (!form.name.trim()) return 'Please enter your full name.';
    if (!form.email.trim()) return 'Please enter your email address.';
    if (!/\S+@\S+\.\S+/.test(form.email.trim())) return 'Please enter a valid email address.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!form.skillsOffered.trim()) return 'Please enter at least one skill you offer.';
    if (!form.skillsNeeded.trim()) return 'Please enter at least one skill you need.';
    return '';
  }

  async function handleSignup() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const { user } = credential;

      await updateProfile(user, { displayName: form.name.trim() });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: form.name.trim(),
        email: form.email.trim(),
        skillsOffered: form.skillsOffered.trim(),
        skillsNeeded: form.skillsNeeded.trim(),
        avatar: '',
        rating: 0,
        swapsCompleted: 0,
        followers: 0,
        createdAt: serverTimestamp(),
      });
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function renderField(field: FieldConfig) {
    const isFocused = focusedField === field.key;
    const isSecure = (field.key === 'password' && !showPassword) || (field.key === 'confirmPassword' && !showConfirm);
    const showToggle = field.key === 'password' || field.key === 'confirmPassword';

    return (
      <View key={field.key} style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          field.multiline && styles.inputWrapperMultiline,
        ]}>
          <Ionicons
            name={field.icon}
            size={18}
            color={isFocused ? Colors.primary : Colors.accent}
            style={[styles.inputIcon, field.multiline && styles.inputIconTop]}
          />
          <TextInput
            style={[styles.input, field.multiline && styles.inputMultiline]}
            placeholder={field.placeholder}
            placeholderTextColor={Colors.accent}
            keyboardType={field.keyboard ?? 'default'}
            autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'sentences'}
            autoCorrect={field.key === 'skillsOffered' || field.key === 'skillsNeeded'}
            secureTextEntry={isSecure}
            multiline={field.multiline}
            numberOfLines={field.multiline ? 2 : 1}
            value={form[field.key]}
            onChangeText={(v) => updateField(field.key, v)}
            onFocus={() => setFocusedField(field.key)}
            onBlur={() => setFocusedField(null)}
          />
          {showToggle && (
            <TouchableOpacity
              onPress={() => field.key === 'password' ? setShowPassword((v) => !v) : setShowConfirm((v) => !v)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={(field.key === 'password' ? showPassword : showConfirm) ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.accent}
              />
            </TouchableOpacity>
          )}
        </View>
        {field.key === 'skillsOffered' && (
          <Text style={styles.fieldHint}>Separate multiple skills with commas</Text>
        )}
        {field.key === 'skillsNeeded' && (
          <Text style={styles.fieldHint}>Separate multiple skills with commas</Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrapper}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.heroTextWrapper}>
            <Text style={styles.heroTitle}>Join Swapr</Text>
            <Text style={styles.heroSubtitle}>Share your skills. Find what you need.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.cardSubtitle}>It's free and only takes a minute</Text>

          {error.length > 0 && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.skillsSectionLabel}>
            <View style={styles.sectionLabelDivider} />
            <Text style={styles.sectionLabelText}>Basic Info</Text>
            <View style={styles.sectionLabelDivider} />
          </View>

          {FIELDS.slice(0, 4).map(renderField)}

          <View style={styles.skillsSectionLabel}>
            <View style={styles.sectionLabelDivider} />
            <Text style={styles.sectionLabelText}>Your Skills</Text>
            <View style={styles.sectionLabelDivider} />
          </View>

          <View style={styles.skillsInfoRow}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
            <Text style={styles.skillsInfoText}>Tell the community what you can offer and what you're looking for</Text>
          </View>

          {FIELDS.slice(4).map(renderField)}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
            <Text style={styles.loginLinkText}>
              Already have an account?{' '}
              <Text style={styles.loginLinkHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
    height: 240,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(76, 29, 149, 0.6)',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrapper: {
    position: 'absolute',
    bottom: 28,
    left: 24,
    right: 24,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
  },
  card: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
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
  skillsSectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
  },
  sectionLabelDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  skillsInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skillsInfoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 14,
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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapperMultiline: {
    height: 'auto',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputIconTop: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  inputMultiline: {
    minHeight: 48,
    textAlignVertical: 'top',
  },
  eyeBtn: {
    padding: 4,
  },
  fieldHint: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
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
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  loginLinkHighlight: {
    color: Colors.primary,
    fontWeight: '800',
  },
});
