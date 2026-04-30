import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { db } from '@/firebaseConfig';
import { resolveAvatarUri, isRemoteAvatarUrl } from '@/lib/localAvatar';
import { useAuth } from '@/context/AuthContext';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  where,
  addDoc,
  getDocs,
  serverTimestamp,
  limit,
  getDoc,
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };

const SKILL_CATEGORIES = ['All', 'Design', 'Tech', 'Art', 'Music', 'Writing', 'Photo'];

interface NearbyUser {
  uid: string;
  name: string;
  avatar: string;
  skillsOffered: string;
  skillsNeeded: string;
  latitude: number;
  longitude: number;
  rating: number;
  swapsCompleted: number;
}

interface SelectedMarker extends NearbyUser {
  distance: string;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (d < 1) return `${Math.round(d * 1000)} m`;
  return `${d.toFixed(1)} km`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function getHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SelectedMarker | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  // Current user's own Firestore profile (needed for propose request doc)
  const [myProfile, setMyProfile] = useState<{ name: string; avatar: string; skillsOffered: string } | null>(null);

  // Per-selected-user propose state: 'idle' | 'sending' | 'sent'
  const [proposeState, setProposeState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const [activePartnerIds, setActivePartnerIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Fetch own profile once on mount
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setMyProfile({
          name: d.name ?? user.displayName ?? 'Swapr User',
          avatar: d.avatar ?? '',
          skillsOffered: d.skillsOffered ?? '',
        });
      }
    });
  }, [user]);

  const saveLocationToFirestore = useCallback(
    async (latitude: number, longitude: number) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'users', user.uid), { latitude, longitude });
      } catch {
      }
    },
    [user]
  );

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    async function initLocation() {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        setLocationLoading(false);
        Alert.alert(
          'Location Required',
          'Swapr needs your location to show nearby skill swappers. Please enable location access in settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setMyLocation(coords);
      setLocationLoading(false);
      await saveLocationToFirestore(coords.latitude, coords.longitude);

      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
        async (loc) => {
          const updated = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setMyLocation(updated);
          await saveLocationToFirestore(updated.latitude, updated.longitude);
        }
      );
    }

    initLocation();
    return () => {
      locationSubscription?.remove();
    };
  }, [saveLocationToFirestore]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users'),
      where('latitude', '!=', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: NearbyUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          docSnap.id !== user.uid &&
          typeof data.latitude === 'number' &&
          typeof data.longitude === 'number'
        ) {
          users.push({
            uid: docSnap.id,
            name: data.name ?? 'Swapr User',
            avatar: data.avatar ?? '',
            skillsOffered: data.skillsOffered ?? '',
            skillsNeeded: data.skillsNeeded ?? '',
            latitude: data.latitude,
            longitude: data.longitude,
            rating: data.rating ?? 0,
            swapsCompleted: data.swapsCompleted ?? 0,
          });
        }
      });
      setNearbyUsers(users);
    });

    const qSwaps1 = query(collection(db, 'swaps'), where('user1Id', '==', user.uid), where('status', '==', 'active'));
    const qSwaps2 = query(collection(db, 'swaps'), where('user2Id', '==', user.uid), where('status', '==', 'active'));

    let p1: string[] = [];
    let p2: string[] = [];
    const updatePartners = () => {
      setActivePartnerIds(new Set([...p1, ...p2]));
    };

    const unsubSwaps1 = onSnapshot(qSwaps1, (snap) => {
      p1 = snap.docs.map(d => d.data().user2Id);
      updatePartners();
    });
    const unsubSwaps2 = onSnapshot(qSwaps2, (snap) => {
      p2 = snap.docs.map(d => d.data().user1Id);
      updatePartners();
    });

    return () => {
      unsubscribe();
      unsubSwaps1();
      unsubSwaps2();
    };
  }, [user]);

  function centerOnMe() {
    if (!myLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...myLocation, ...DELTA },
      600
    );
  }

  function handleMarkerPress(nearUser: NearbyUser) {
    const distance =
      myLocation
        ? getDistance(myLocation.latitude, myLocation.longitude, nearUser.latitude, nearUser.longitude)
        : '—';
    setSelectedUser({ ...nearUser, distance });
    setProposeState('idle'); // reset state for each new user
  }

  async function handlePropose() {
    if (!user || !selectedUser || !myProfile) return;
    if (proposeState !== 'idle') return;

    setProposeState('sending');
    try {
      // Guard: check if pending/accepted request already exists
      const existingQ = query(
        collection(db, 'swapRequests'),
        where('fromUserId', '==', user.uid),
        where('toUserId', '==', selectedUser.uid),
        where('status', 'in', ['pending', 'accepted']),
        limit(1)
      );
      const existingSnap = await getDocs(existingQ);

      if (!existingSnap.empty) {
        setProposeState('sent');
        Alert.alert('Already Sent', `You already have an active request with ${selectedUser.name}.`);
        return;
      }

      if (activePartnerIds.has(selectedUser.uid)) {
        setProposeState('sent');
        Alert.alert('Active Swap', `You are already swapping with ${selectedUser.name}.`);
        return;
      }

      await addDoc(collection(db, 'swapRequests'), {
        fromUserId: user.uid,
        fromUserName: myProfile.name,
        fromUserAvatar: isRemoteAvatarUrl(myProfile.avatar) ? myProfile.avatar : '',
        fromSkillsOffered: myProfile.skillsOffered,
        toUserId: selectedUser.uid,
        type: 'propose',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setProposeState('sent');
      Alert.alert('Request Sent! 🎉', `Swap request sent to ${selectedUser.name}. They will be notified in their Swaps tab.`);
    } catch {
      setProposeState('idle');
      Alert.alert('Error', 'Could not send request. Please try again.');
    }
  }

  const filteredUsers = nearbyUsers.filter((u) => {
    const skills = u.skillsOffered.toLowerCase();
    const name = u.name.toLowerCase();
    const catMatch =
      activeCategory === 'All' ||
      skills.includes(activeCategory.toLowerCase());
    const searchMatch =
      searchText.length === 0 ||
      name.includes(searchText.toLowerCase()) ||
      skills.includes(searchText.toLowerCase());
    return catMatch && searchMatch;
  });

  const sheetAvatarUri = selectedUser ? resolveAvatarUri(selectedUser.avatar) : null;

  const initialRegion: Region | undefined = myLocation
    ? { ...myLocation, ...DELTA }
    : undefined;

  return (
    <View style={styles.container}>
      {locationLoading ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTitle}>Finding your location…</Text>
            <Text style={styles.loadingSubtitle}>Discovering skill swappers near you</Text>
          </View>
        </View>
      ) : locationError ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Ionicons name="location-outline" size={48} color={Colors.accent} />
            <Text style={styles.loadingTitle}>Location Unavailable</Text>
            <Text style={styles.loadingSubtitle}>Enable location access to see swappers near you</Text>
          </View>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            mapType={mapType}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            showsScale={false}
          >
            {filteredUsers.map((nearUser) => {
              const markerAvatarUri = resolveAvatarUri(nearUser.avatar);
              return (
              <Marker
                key={nearUser.uid}
                coordinate={{ latitude: nearUser.latitude, longitude: nearUser.longitude }}
                onPress={() => handleMarkerPress(nearUser)}
              >
                <View style={styles.markerOuter}>
                  <View style={styles.markerInner}>
                    {markerAvatarUri ? (
                      <Image source={{ uri: markerAvatarUri }} style={styles.markerAvatar} />
                    ) : (
                      <View style={styles.markerInitialsWrapper}>
                        <Text style={styles.markerInitials}>{getInitials(nearUser.name)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.markerTail} />
                </View>
              </Marker>
            );
            })}
          </MapView>

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <View style={styles.topBarLeft}>
              <View style={styles.greetingCard}>
                <Text style={styles.greetingText}>Good {getHour()} 👋</Text>
                <Text style={styles.greetingTitle}>Find Skills Near You</Text>
              </View>
            </View>

            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => setShowSearch((v) => !v)}
              >
                <Ionicons name={showSearch ? 'close' : 'search-outline'} size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => setMapType((t) => (t === 'standard' ? 'satellite' : 'standard'))}
              >
                <Ionicons name="layers-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBarBtn}>
                <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
                <View style={styles.notifDot} />
              </TouchableOpacity>
            </View>
          </View>

          {showSearch && (
            <View style={[styles.searchBarWrapper, { top: insets.top + 72 }]}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={17} color={Colors.accent} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search skills or names…"
                  placeholderTextColor={Colors.accent}
                  value={searchText}
                  onChangeText={setSearchText}
                  autoFocus
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <Ionicons name="close-circle" size={17} color={Colors.accent} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={styles.categoryBarWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            >
              {SKILL_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.statsBar}>
            <View style={styles.statsBadge}>
              <View style={styles.statsBadgeIndicator} />
              <Text style={styles.statsBadgeText}>
                {filteredUsers.length} swapper{filteredUsers.length !== 1 ? 's' : ''} nearby
              </Text>
            </View>
          </View>

          <View style={[styles.fabColumn, { bottom: insets.bottom + 100 }]}>
            <TouchableOpacity style={styles.fabSecondary} onPress={() => setMapType((t) => (t === 'standard' ? 'satellite' : 'standard'))}>
              <Ionicons name="globe-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabPrimary} onPress={centerOnMe}>
              <Ionicons name="navigate" size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={!!selectedUser}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedUser(null)}
        >
          {selectedUser && (
            <View style={styles.userSheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={styles.sheetAvatarWrapper}>
                  {sheetAvatarUri ? (
                    <Image source={{ uri: sheetAvatarUri }} style={styles.sheetAvatar} />
                  ) : (
                    <View style={[styles.sheetAvatar, styles.sheetAvatarPlaceholder]}>
                      <Text style={styles.sheetAvatarInitials}>{getInitials(selectedUser.name)}</Text>
                    </View>
                  )}
                  <View style={styles.sheetOnlineDot} />
                </View>

                <View style={styles.sheetMeta}>
                  <Text style={styles.sheetName}>{selectedUser.name}</Text>
                  <View style={styles.sheetDistanceRow}>
                    <Ionicons name="location-outline" size={12} color={Colors.primary} />
                    <Text style={styles.sheetDistance}>{selectedUser.distance} away</Text>
                  </View>
                  <View style={styles.sheetRatingRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.sheetRating}>
                      {selectedUser.rating > 0 ? selectedUser.rating.toFixed(1) : 'New'} · {selectedUser.swapsCompleted} swaps
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sheetSkills}>
                <View style={styles.sheetSkillBlock}>
                  <View style={styles.sheetSkillLabel}>
                    <Ionicons name="flash" size={13} color={Colors.primary} />
                    <Text style={styles.sheetSkillLabelText}>Offers</Text>
                  </View>
                  <View style={styles.sheetChipRow}>
                    {selectedUser.skillsOffered.split(',').filter(Boolean).slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.offerChip}>
                        <Text style={styles.offerChipText}>{s.trim()}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sheetSkillDivider} />

                <View style={styles.sheetSkillBlock}>
                  <View style={styles.sheetSkillLabel}>
                    <Ionicons name="search-outline" size={13} color="#B45309" />
                    <Text style={[styles.sheetSkillLabelText, { color: '#B45309' }]}>Needs</Text>
                  </View>
                  <View style={styles.sheetChipRow}>
                    {selectedUser.skillsNeeded.split(',').filter(Boolean).slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.needChip}>
                        <Text style={styles.needChipText}>{s.trim()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.sheetActions}>
                {activePartnerIds.has(selectedUser.uid) ? (
                  <TouchableOpacity
                    style={[styles.sheetActionPrimary, { backgroundColor: '#10B981' }]}
                    onPress={() => {
                      setSelectedUser(null);
                      router.push('/(tabs)/swaps');
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="swap-horizontal" size={18} color={Colors.white} />
                    <Text style={styles.sheetActionPrimaryText}>Active Swap - View</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.sheetActionPrimary,
                      proposeState === 'sent' && styles.sheetActionPrimaryDone,
                      proposeState === 'sending' && styles.sheetActionPrimaryLoading,
                    ]}
                    onPress={handlePropose}
                    disabled={proposeState !== 'idle'}
                    activeOpacity={0.85}
                  >
                    {proposeState === 'sending' ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : proposeState === 'sent' ? (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                        <Text style={styles.sheetActionPrimaryText}>Request Sent</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="swap-horizontal" size={18} color={Colors.white} />
                        <Text style={styles.sheetActionPrimaryText}>Propose Swap</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBarLeft: {
    flex: 1,
    marginRight: 10,
  },
  greetingCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  greetingText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 1,
  },
  greetingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  topBarBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  searchBarWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  categoryBarWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 170,
    left: 0,
    right: 0,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryTextActive: {
    color: Colors.white,
  },
  statsBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 220 : 210,
    left: 16,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsBadgeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  fabColumn: {
    position: 'absolute',
    right: 16,
    gap: 10,
    alignItems: 'center',
  },
  fabSecondary: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fabPrimary: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  markerOuter: {
    alignItems: 'center',
  },
  markerInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    padding: 2.5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  markerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  markerInitialsWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
    marginTop: -1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  userSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  sheetAvatarWrapper: {
    position: 'relative',
  },
  sheetAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  sheetAvatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
  },
  sheetOnlineDot: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success,
    borderWidth: 2.5,
    borderColor: Colors.background,
  },
  sheetMeta: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  sheetName: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.text,
  },
  sheetDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sheetDistance: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  sheetRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sheetRating: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sheetSkills: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 18,
  },
  sheetSkillBlock: {
    padding: 16,
  },
  sheetSkillLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  sheetSkillLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  offerChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
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
    paddingHorizontal: 11,
    paddingVertical: 6,
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
  sheetSkillDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 14,
  },
  sheetActions: {
    flexDirection: 'row',
  },
  sheetActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  sheetActionPrimaryDone: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
  },
  sheetActionPrimaryLoading: {
    opacity: 0.75,
  },
  sheetActionPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
});
