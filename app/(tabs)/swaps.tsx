import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebaseConfig';
import { resolveAvatarUri, isRemoteAvatarUrl } from '@/lib/localAvatar';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  setDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';

interface SwapRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  fromSkillsOffered: string;
  toUserId: string;
  type: 'propose' | 'offer';
  sourceId?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

interface ActiveSwap {
  id: string;
  user1Id: string;
  user1Name: string;
  user1Avatar: string;
  user1SkillsOffered: string;
  user2Id: string;
  user2Name: string;
  user2Avatar: string;
  user2SkillsOffered: string;
  conversationId: string;
  status: 'active' | 'completed';
  activitiesCount: number;
  swapLimit: number;
  user1Rated?: boolean;
  user2Rated?: boolean;
  createdAt: any;
}

interface SwapActivity {
  id: string;
  createdBy: string;
  title: string;
  completedBy: string | null;
  completed: boolean;
  createdAt: any;
}

export default function SwapsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [myProfile, setMyProfile] = useState<{ name: string; avatar: string; skillsOffered: string } | null>(null);

  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [swapsAsUser1, setSwapsAsUser1] = useState<ActiveSwap[]>([]);
  const [swapsAsUser2, setSwapsAsUser2] = useState<ActiveSwap[]>([]);

  const [loadingReqs, setLoadingReqs] = useState(true);
  const [loadingSwaps1, setLoadingSwaps1] = useState(true);
  const [loadingSwaps2, setLoadingSwaps2] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [expandedSwapId, setExpandedSwapId] = useState<string | null>(null);
  const [activities, setActivities] = useState<SwapActivity[]>([]);
  const [newActivityTitle, setNewActivityTitle] = useState('');

  // Rating Modal State
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingSwap, setRatingSwap] = useState<ActiveSwap | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingText, setRatingText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Fetch own profile
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

  // Fetch pending requests
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'swapRequests'), where('toUserId', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs: SwapRequest[] = [];
      snapshot.forEach((docSnap) => reqs.push({ id: docSnap.id, ...docSnap.data() } as SwapRequest));
      reqs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRequests(reqs);
      setLoadingReqs(false);
    });
    return unsubscribe;
  }, [user]);

  // Fetch active & completed swaps (User1)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'swaps'), where('user1Id', '==', user.uid), where('status', 'in', ['active', 'completed']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const swaps: ActiveSwap[] = [];
      snapshot.forEach((docSnap) => swaps.push({ id: docSnap.id, ...docSnap.data() } as ActiveSwap));
      setSwapsAsUser1(swaps);
      setLoadingSwaps1(false);
    });
    return unsubscribe;
  }, [user]);

  // Fetch active & completed swaps (User2)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'swaps'), where('user2Id', '==', user.uid), where('status', 'in', ['active', 'completed']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const swaps: ActiveSwap[] = [];
      snapshot.forEach((docSnap) => swaps.push({ id: docSnap.id, ...docSnap.data() } as ActiveSwap));
      setSwapsAsUser2(swaps);
      setLoadingSwaps2(false);
    });
    return unsubscribe;
  }, [user]);

  // Fetch activities for expanded swap
  useEffect(() => {
    if (!expandedSwapId) {
      setActivities([]);
      return;
    }
    const q = query(collection(db, 'swaps', expandedSwapId, 'activities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const acts: SwapActivity[] = [];
      snapshot.forEach((docSnap) => acts.push({ id: docSnap.id, ...docSnap.data() } as SwapActivity));
      acts.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      setActivities(acts);
    });
    return unsubscribe;
  }, [expandedSwapId]);

  const allSwaps = [...swapsAsUser1, ...swapsAsUser2].sort(
    (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
  );

  const activeSwaps = allSwaps.filter((s) => s.status === 'active');
  const completedSwaps = allSwaps.filter((s) => s.status === 'completed');

  function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
  }

  async function handleAccept(req: SwapRequest) {
    if (!user || !myProfile) return;
    setProcessingId(req.id);
    try {
      await updateDoc(doc(db, 'swapRequests', req.id), { status: 'accepted' });
      const conversationId = [user.uid, req.fromUserId].sort().join('_');
      await addDoc(collection(db, 'swaps'), {
        user1Id: user.uid,
        user1Name: myProfile.name,
        user1Avatar: isRemoteAvatarUrl(myProfile.avatar) ? myProfile.avatar : '',
        user1SkillsOffered: myProfile.skillsOffered,
        user2Id: req.fromUserId,
        user2Name: req.fromUserName,
        user2Avatar: req.fromUserAvatar,
        user2SkillsOffered: req.fromSkillsOffered,
        conversationId,
        status: 'active',
        activitiesCount: 0,
        swapLimit: 5,
        user1Rated: false,
        user2Rated: false,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'conversations', conversationId), {
        participants: [user.uid, req.fromUserId],
        createdAt: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Swap Accepted! 🎉', 'You can now chat and track activities with your swap partner.');
    } catch {
      Alert.alert('Error', 'Could not accept request.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(req: SwapRequest) {
    setProcessingId(req.id);
    try {
      await updateDoc(doc(db, 'swapRequests', req.id), { status: 'rejected' });
    } catch {
      Alert.alert('Error', 'Could not reject request.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAddActivity(swapId: string) {
    if (!newActivityTitle.trim() || !user) return;
    try {
      await addDoc(collection(db, 'swaps', swapId, 'activities'), {
        createdBy: user.uid,
        title: newActivityTitle.trim(),
        completed: false,
        completedBy: null,
        createdAt: serverTimestamp(),
      });
      setNewActivityTitle('');
    } catch {
      Alert.alert('Error', 'Could not add activity.');
    }
  }

  async function handleMarkDone(swapId: string, activity: SwapActivity, currentCount: number, limit: number, swapRef: ActiveSwap) {
    if (!user) return;
    if (activity.createdBy === user.uid) {
      Alert.alert('Not allowed', 'Only your partner can mark this task as done.');
      return;
    }
    try {
      await updateDoc(doc(db, 'swaps', swapId, 'activities', activity.id), {
        completed: true,
        completedBy: user.uid,
      });
      const newCount = currentCount + 1;
      await updateDoc(doc(db, 'swaps', swapId), { activitiesCount: newCount });

      if (newCount >= limit) {
        await updateDoc(doc(db, 'swaps', swapId), {
          status: 'completed',
          completedAt: serverTimestamp(),
        });
        setExpandedSwapId(null);
        openRatingModal(swapRef);
      }
    } catch {
      Alert.alert('Error', 'Could not mark as done.');
    }
  }

  function openRatingModal(swap: ActiveSwap) {
    setRatingSwap(swap);
    setRatingScore(0);
    setRatingText('');
    setRatingModalVisible(true);
  }

  async function handleSubmitRating() {
    if (!user || !myProfile || !ratingSwap) return;
    if (ratingScore === 0) {
      Alert.alert('Error', 'Please select a star rating.');
      return;
    }

    setSubmittingRating(true);
    try {
      const isUser1 = ratingSwap.user1Id === user.uid;
      const targetId = isUser1 ? ratingSwap.user2Id : ratingSwap.user1Id;

      // 1. Create Review Document
      await addDoc(collection(db, 'reviews'), {
        swapId: ratingSwap.id,
        reviewerId: user.uid,
        reviewerName: myProfile.name,
        reviewerAvatar: isRemoteAvatarUrl(myProfile.avatar) ? myProfile.avatar : '',
        targetId: targetId,
        rating: ratingScore,
        text: ratingText.trim(),
        createdAt: serverTimestamp(),
      });

      // 2. Update Swap Document (Mark as rated)
      const updateField = isUser1 ? 'user1Rated' : 'user2Rated';
      await updateDoc(doc(db, 'swaps', ratingSwap.id), {
        [updateField]: true,
      });

      // 3. Update Target User Profile Rating (Weighted Average)
      const targetUserRef = doc(db, 'users', targetId);
      const targetSnap = await getDoc(targetUserRef);
      if (targetSnap.exists()) {
        const data = targetSnap.data();
        const currentRating = data.rating || 0;
        const currentCount = data.swapsCompleted || 0; // Using swapsCompleted as rating count for simplicity
        
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + ratingScore) / newCount;

        await updateDoc(targetUserRef, {
          rating: newRating,
          swapsCompleted: newCount,
        });
      } else {
        await updateDoc(targetUserRef, {
          rating: ratingScore,
          swapsCompleted: 1,
        });
      }

      setRatingModalVisible(false);
      Alert.alert('Thank You!', 'Your feedback has been submitted.');
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Could not submit rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  }

  const isLoading = loadingReqs || loadingSwaps1 || loadingSwaps2;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Swaps</Text>
        <Text style={styles.headerSubtitle}>Manage your skill exchanges</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ACTIVE SWAPS SECTION */}
          {activeSwaps.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Swaps</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{activeSwaps.length}</Text></View>
              </View>

              {activeSwaps.map((swap) => {
                const partnerName = swap.user1Id === user?.uid ? swap.user2Name : swap.user1Name;
                const partnerAvatar = swap.user1Id === user?.uid ? swap.user2Avatar : swap.user1Avatar;
                const partnerAvatarUri = resolveAvatarUri(partnerAvatar);
                const partnerSkills = swap.user1Id === user?.uid ? swap.user2SkillsOffered : swap.user1SkillsOffered;
                const isExpanded = expandedSwapId === swap.id;
                const progress = (swap.activitiesCount / swap.swapLimit) * 100;

                return (
                  <View key={swap.id} style={styles.activeSwapCard}>
                    <View style={styles.activeSwapHeader}>
                      <View style={styles.swapPartnerInfo}>
                        {partnerAvatarUri ? (
                          <Image source={{ uri: partnerAvatarUri }} style={styles.avatarSm} />
                        ) : (
                          <View style={[styles.avatarSm, styles.placeholderAvatar]}>
                            <Text style={styles.initialsTextSm}>{getInitials(partnerName)}</Text>
                          </View>
                        )}
                        <View style={styles.userDetails}>
                          <Text style={styles.userName}>{partnerName}</Text>
                          <Text style={styles.skillText} numberOfLines={1}>Offers: {partnerSkills || 'No skills listed'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => router.push(`/chat/${swap.conversationId}` as any)}
                      >
                        <Ionicons name="chatbubbles" size={16} color={Colors.primary} />
                        <Text style={styles.chatBtnText}>Chat</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.progressContainer}>
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressText}>Activities Completed</Text>
                        <Text style={styles.progressCount}>{swap.activitiesCount} / {swap.swapLimit}</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.expandBtn}
                      onPress={() => setExpandedSwapId(isExpanded ? null : swap.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.expandBtnText}>{isExpanded ? 'Hide Activities' : 'View Activities'}</Text>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.activitiesSection}>
                        {activities.map((act) => (
                          <View key={act.id} style={styles.activityItem}>
                            <View style={styles.activityLeft}>
                              <Ionicons
                                name={act.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={act.completed ? Colors.success : Colors.textMuted}
                              />
                              <View>
                                <Text style={[styles.activityTitle, act.completed && styles.activityTitleDone]}>
                                  {act.title}
                                </Text>
                                <Text style={styles.activitySub}>
                                  Added by {act.createdBy === user?.uid ? 'you' : partnerName}
                                </Text>
                              </View>
                            </View>
                            {!act.completed && act.createdBy !== user?.uid && (
                              <TouchableOpacity
                                style={styles.markDoneBtn}
                                onPress={() => handleMarkDone(swap.id, act, swap.activitiesCount, swap.swapLimit, swap)}
                              >
                                <Text style={styles.markDoneText}>Mark Done</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}

                        <View style={styles.addActivityRow}>
                          <TextInput
                            style={styles.activityInput}
                            placeholder="Add a new task..."
                            value={newActivityTitle}
                            onChangeText={setNewActivityTitle}
                            placeholderTextColor={Colors.textMuted}
                          />
                          <TouchableOpacity
                            style={[styles.addBtn, !newActivityTitle.trim() && styles.addBtnDisabled]}
                            onPress={() => handleAddActivity(swap.id)}
                            disabled={!newActivityTitle.trim()}
                          >
                            <Ionicons name="add" size={20} color={Colors.white} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* COMPLETED SWAPS SECTION */}
          {completedSwaps.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Completed Swaps</Text>
              </View>
              {completedSwaps.map((swap) => {
                const partnerName = swap.user1Id === user?.uid ? swap.user2Name : swap.user1Name;
                const partnerAvatar = swap.user1Id === user?.uid ? swap.user2Avatar : swap.user1Avatar;
                const completedPartnerAvatarUri = resolveAvatarUri(partnerAvatar);
                const hasRated = swap.user1Id === user?.uid ? swap.user1Rated : swap.user2Rated;

                return (
                  <View key={swap.id} style={[styles.activeSwapCard, { opacity: 0.8 }]}>
                    <View style={styles.activeSwapHeader}>
                      <View style={styles.swapPartnerInfo}>
                        {completedPartnerAvatarUri ? (
                          <Image source={{ uri: completedPartnerAvatarUri }} style={styles.avatarSm} />
                        ) : (
                          <View style={[styles.avatarSm, styles.placeholderAvatar]}>
                            <Text style={styles.initialsTextSm}>{getInitials(partnerName)}</Text>
                          </View>
                        )}
                        <View style={styles.userDetails}>
                          <Text style={styles.userName}>{partnerName}</Text>
                          <Text style={styles.skillText}>Completed</Text>
                        </View>
                      </View>
                      {!hasRated ? (
                        <TouchableOpacity style={styles.rateBtn} onPress={() => openRatingModal(swap)}>
                          <Ionicons name="star" size={16} color="#FFF" />
                          <Text style={styles.rateBtnText}>Rate</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.ratedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                          <Text style={styles.ratedText}>Rated</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* INCOMING REQUESTS SECTION */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Incoming Requests</Text>
            {requests.length > 0 && (
              <View style={styles.countBadge}><Text style={styles.countText}>{requests.length}</Text></View>
            )}
          </View>

          {requests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="mail-open-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptySubtitle}>You don't have any incoming swap requests right now.</Text>
            </View>
          ) : (
            requests.map((item) => {
              const isProcessing = processingId === item.id;
              const requesterAvatarUri = resolveAvatarUri(item.fromUserAvatar);
              return (
                <View key={item.id} style={styles.requestCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.badge, item.type === 'propose' ? styles.badgePropose : styles.badgeOffer]}>
                      <Ionicons name={item.type === 'propose' ? 'map' : 'newspaper'} size={12} color={item.type === 'propose' ? Colors.primary : '#D97706'} />
                      <Text style={[styles.badgeText, item.type === 'propose' ? styles.badgeTextPropose : styles.badgeTextOffer]}>
                        {item.type === 'propose' ? 'Map Proposal' : 'Board Offer'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.userInfo}>
                    {requesterAvatarUri ? (
                      <Image source={{ uri: requesterAvatarUri }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.placeholderAvatar]}>
                        <Text style={styles.initialsText}>{getInitials(item.fromUserName)}</Text>
                      </View>
                    )}
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>{item.fromUserName}</Text>
                      <View style={styles.skillRow}>
                        <Ionicons name="flash" size={12} color={Colors.primary} />
                        <Text style={styles.skillText} numberOfLines={1}>Offers: {item.fromSkillsOffered || 'No specific skills listed'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(item)} disabled={isProcessing}>
                      <Ionicons name="close" size={18} color={Colors.error} />
                      <Text style={styles.rejectText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleAccept(item)} disabled={isProcessing}>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color={Colors.white} />
                          <Text style={styles.acceptText}>Accept Swap</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* RATING MODAL */}
      <Modal visible={ratingModalVisible} transparent animationType="slide" onRequestClose={() => setRatingModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRatingModalVisible(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Rate Your Swap</Text>
            <Text style={styles.modalSubtitle}>
              How was your experience swapping with {ratingSwap ? (ratingSwap.user1Id === user?.uid ? ratingSwap.user2Name : ratingSwap.user1Name) : 'your partner'}?
            </Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingScore(star)}>
                  <Ionicons name="star" size={40} color={star <= ratingScore ? '#F59E0B' : Colors.border} />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Leave an optional review..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              value={ratingText}
              onChangeText={setRatingText}
            />

            <TouchableOpacity
              style={[styles.submitRatingBtn, (ratingScore === 0 || submittingRating) && styles.submitRatingBtnDisabled]}
              onPress={handleSubmitRating}
              disabled={ratingScore === 0 || submittingRating}
            >
              {submittingRating ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitRatingText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  countBadge: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Active Swaps
  activeSwapCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  activeSwapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  swapPartnerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatarSm: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary },
  initialsTextSm: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3E8FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chatBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  
  progressContainer: { marginBottom: 16 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  progressCount: { fontSize: 12, color: Colors.primary, fontWeight: '800' },
  progressBarBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  
  expandBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  expandBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  
  activitiesSection: { marginTop: 16 },
  activityItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  activityTitle: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  activityTitleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  activitySub: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  markDoneBtn: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  markDoneText: { color: Colors.success, fontSize: 11, fontWeight: '700' },
  
  addActivityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  activityInput: { flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.5 },

  // Completed Swaps specific
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  rateBtnText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  ratedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  ratedText: { color: Colors.success, fontSize: 12, fontWeight: '700' },

  // Incoming Requests
  requestCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
  badgePropose: { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' },
  badgeOffer: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextPropose: { color: Colors.primary },
  badgeTextOffer: { color: '#D97706' },
  userInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.primary },
  placeholderAvatar: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  userDetails: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skillText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  rejectBtn: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.error },
  rejectText: { color: Colors.error, fontWeight: '700', fontSize: 14 },
  acceptBtn: { backgroundColor: Colors.primary },
  acceptText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  
  emptyContainer: { padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 },
  emptyIconWrapper: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 44 : 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, fontWeight: '400', textAlign: 'center', marginBottom: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 },
  reviewInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, fontSize: 15, color: Colors.text, textAlignVertical: 'top', minHeight: 100, marginBottom: 24 },
  submitRatingBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitRatingBtnDisabled: { opacity: 0.6 },
  submitRatingText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
