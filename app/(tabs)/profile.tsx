import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { resolveAvatarUri, saveAvatarFromPickedUri } from '@/lib/localAvatar';
import { signOut } from 'firebase/auth';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTFOLIO_ITEM_SIZE = (SCREEN_WIDTH - 52) / 3;

interface UserProfile {
  name: string;
  email: string;
  skillsOffered: string;
  skillsNeeded: string;
  avatar: string;
  rating: number;
  swapsCompleted: number;
  followers: number;
}

interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar: string;
  rating: number;
  text: string;
  createdAt: any;
}

const PORTFOLIO_PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=300&h=300&fit=crop',
];

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'skills' | 'reviews'>('portfolio');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
      setLoadingProfile(false);
    }, (error) => {
      console.error("Error fetching profile:", error);
      setLoadingProfile(false);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'reviews'), where('targetId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revs: Review[] = [];
      snapshot.forEach(docSnap => revs.push({ id: docSnap.id, ...docSnap.data() } as Review));
      revs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReviews(revs);
    });
    return unsubscribe;
  }, [user]);

  async function requestCameraPermission() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }

  async function requestMediaPermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  async function pickFromCamera() {
    setShowPhotoModal(false);
    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take a photo. Please enable it in your device settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadAvatar(result.assets[0].uri);
    }
  }

  async function pickFromGallery() {
    setShowPhotoModal(false);
    const granted = await requestMediaPermission();
    if (!granted) {
      Alert.alert('Permission Required', 'Photo library access is needed. Please enable it in your device settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadAvatar(result.assets[0].uri);
    }
  }

  async function uploadAvatar(uri: string) {
    if (!user || !uri) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      setUploadProgress(40);
      const relativePath = await saveAvatarFromPickedUri(uri, user.uid);
      setUploadProgress(85);
      await updateDoc(doc(db, 'users', user.uid), { avatar: relativePath });
      setProfile((prev) => (prev ? { ...prev, avatar: relativePath } : prev));
      setUploadProgress(100);
    } catch (err) {
      console.error('Avatar save failed:', err);
      Alert.alert('Save Failed', 'Could not save your photo locally. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function parseSkills(raw: string): string[] {
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  const skillsOffered = parseSkills(profile?.skillsOffered ?? '');
  const skillsNeeded = parseSkills(profile?.skillsNeeded ?? '');
  const displayName = profile?.name ?? user?.displayName ?? 'Swapr User';
  const emailHandle = (profile?.email ?? user?.email ?? '').split('@')[0];
  const profileAvatarUri = resolveAvatarUri(profile?.avatar);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerBar}>
          <Text style={styles.headerBarTitle}>My Profile</Text>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.coverWrapper}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&h=300&fit=crop' }}
            style={styles.coverImage}
            resizeMode="cover"
          />
          <View style={styles.coverGradient} />
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              {uploading ? (
                <View style={[styles.avatar, styles.avatarUploading]}>
                  <View style={styles.uploadProgressRing}>
                    <Text style={styles.uploadProgressText}>{uploadProgress}%</Text>
                  </View>
                </View>
              ) : profileAvatarUri ? (
                <Image source={{ uri: profileAvatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.editAvatarBtn}
                onPress={() => setShowPhotoModal(true)}
                disabled={uploading}
              >
                <Ionicons name="camera" size={14} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              {[
                { label: 'Swaps', value: String(profile?.swapsCompleted ?? 0) },
                { label: 'Rating', value: profile?.rating ? profile.rating.toFixed(1) : '—' },
                { label: 'Followers', value: String(profile?.followers ?? 0) },
              ].map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bio}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              </View>
            </View>
            <Text style={styles.profileHandle}>@{emailHandle}</Text>

            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={13} color={Colors.accent} />
              <Text style={styles.emailText}>{profile?.email ?? user?.email}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.editBtn} 
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="qr-code-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentTabBar}>
          {(['portfolio', 'skills', 'reviews'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.contentTab, activeTab === tab && styles.contentTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === 'portfolio' ? 'grid-outline' : tab === 'skills' ? 'flash-outline' : 'star-outline'}
                size={16}
                color={activeTab === tab ? Colors.primary : Colors.accent}
              />
              <Text style={[styles.contentTabText, activeTab === tab && styles.contentTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'portfolio' && (
          <View style={styles.portfolioGrid}>
            {PORTFOLIO_PLACEHOLDERS.map((uri, idx) => (
              <TouchableOpacity key={idx} style={styles.portfolioCell} activeOpacity={0.85}>
                <Image source={{ uri }} style={styles.portfolioImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'skills' && (
          <View style={styles.skillsContainer}>
            <View style={styles.skillsSection}>
              <View style={styles.skillsSectionHeader}>
                <View style={[styles.skillsSectionDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.skillsSectionTitle}>Skills I Offer</Text>
              </View>
              {skillsOffered.length > 0 ? (
                <View style={styles.chipRow}>
                  {skillsOffered.map((skill, i) => (
                    <View key={i} style={styles.offerChip}>
                      <Ionicons name="flash" size={12} color={Colors.primary} />
                      <Text style={styles.offerChipText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptySkillText}>No skills added yet.</Text>
              )}
            </View>

            <View style={styles.skillsDivider} />

            <View style={styles.skillsSection}>
              <View style={styles.skillsSectionHeader}>
                <View style={[styles.skillsSectionDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.skillsSectionTitle}>Skills I Need</Text>
              </View>
              {skillsNeeded.length > 0 ? (
                <View style={styles.chipRow}>
                  {skillsNeeded.map((skill, i) => (
                    <View key={i} style={styles.needChip}>
                      <Ionicons name="search-outline" size={12} color="#B45309" />
                      <Text style={styles.needChipText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptySkillText}>No skills added yet.</Text>
              )}
            </View>
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.reviewsList}>
            {reviews.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40, gap: 10 }}>
                <Ionicons name="star-outline" size={40} color={Colors.border} />
                <Text style={{ color: Colors.textSecondary, fontWeight: '500' }}>No reviews yet.</Text>
              </View>
            ) : (
              reviews.map((review) => {
                let timeAgo = 'Just now';
                if (review.createdAt) {
                  const diff = Date.now() - review.createdAt.toMillis();
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  if (days > 0) timeAgo = `${days}d ago`;
                  else {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    if (hours > 0) timeAgo = `${hours}h ago`;
                  }
                }
                return (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      {resolveAvatarUri(review.reviewerAvatar) ? (
                        <Image source={{ uri: resolveAvatarUri(review.reviewerAvatar)! }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={[styles.reviewAvatar, { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{getInitials(review.reviewerName)}</Text>
                        </View>
                      )}
                      <View style={styles.reviewMeta}>
                        <Text style={styles.reviewUser}>{review.reviewerName}</Text>
                        <View style={styles.reviewStars}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Ionicons key={i} name="star" size={13} color={i < review.rating ? '#F59E0B' : Colors.border} />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.reviewTime}>{timeAgo}</Text>
                    </View>
                    <Text style={styles.reviewText}>{review.text}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={showPhotoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowPhotoModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Update Profile Photo</Text>
            <Text style={styles.modalSubtitle}>Choose how you'd like to add a photo</Text>

            <TouchableOpacity style={styles.modalOption} onPress={pickFromCamera}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="camera" size={24} color={Colors.primary} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Take a Photo</Text>
                <Text style={styles.modalOptionSub}>Open your camera and snap a live photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={pickFromGallery}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="images" size={24} color={Colors.primary} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.modalOptionSub}>Pick an existing photo from your library</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPhotoModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerBarTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  signOutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverWrapper: {
    height: 130,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  profileSection: {
    paddingHorizontal: 20,
    marginTop: -30,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  avatarUploading: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderColor: Colors.primaryLight,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  uploadProgressRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadProgressText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.background,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    paddingBottom: 6,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 1,
  },
  bio: {
    marginBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  profileName: {
    fontSize: 21,
    fontWeight: '800',
    color: Colors.text,
  },
  verifiedBadge: {
    marginTop: 1,
  },
  profileHandle: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 6,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  emailText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentTabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  contentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 13,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  contentTabActive: {
    borderBottomColor: Colors.primary,
  },
  contentTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },
  contentTabTextActive: {
    color: Colors.primary,
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 4,
  },
  portfolioCell: {
    width: PORTFOLIO_ITEM_SIZE,
    height: PORTFOLIO_ITEM_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  skillsContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  skillsSection: {
    padding: 18,
  },
  skillsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  skillsSectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skillsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  offerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  needChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  needChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  emptySkillText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  skillsDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  reviewsList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewUser: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 3,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewTime: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '500',
  },
  reviewText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    fontWeight: '400',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  modalOptionSub: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.error,
  },
});
