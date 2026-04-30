import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebaseConfig';
import { resolveAvatarUri, isRemoteAvatarUrl } from '@/lib/localAvatar';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  getDoc,
  arrayUnion,
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FILTER_TABS = ['All', 'Urgent', 'Design', 'Tech', 'Art', 'Writing', 'Music'] as const;
type FilterTab = typeof FILTER_TABS[number];

const URGENCY_LEVELS = ['Normal', 'Urgent', 'Critical'] as const;
type UrgencyLevel = typeof URGENCY_LEVELS[number];

const FALLBACK_AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200&h=200&fit=crop',
];

interface RequestDoc {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  requestText: string;
  skillCategory: string;
  urgency: UrgencyLevel;
  offeredBy: string[];
  createdAt: any;
}

function formatTimestamp(ts: any): string {
  if (!ts) return 'just now';
  const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getUrgencyStyle(urgency: UrgencyLevel) {
  switch (urgency) {
    case 'Critical':
      return { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', dot: '#DC2626' };
    case 'Urgent':
      return { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', dot: '#F59E0B' };
    default:
      return { bg: Colors.surface, border: Colors.border, text: Colors.textSecondary, dot: Colors.accent };
  }
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}

interface RequestCardProps {
  item: RequestDoc;
  currentUserId: string;
  isOwnPost: boolean;
  onOfferHelp: (item: RequestDoc) => void;
}

function RequestCard({ item, currentUserId, isOwnPost, onOfferHelp }: RequestCardProps) {
  const urgencyStyle = getUrgencyStyle(item.urgency);
  const hasOffered = item.offeredBy?.includes(currentUserId);
  const offerCount = item.offeredBy?.length ?? 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const authorAvatarUri = resolveAvatarUri(item.authorAvatar);

  function handleOfferPress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onOfferHelp(item);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={[styles.urgencyBadge, { backgroundColor: urgencyStyle.bg, borderColor: urgencyStyle.border }]}>
          <View style={[styles.urgencyDot, { backgroundColor: urgencyStyle.dot }]} />
          <Text style={[styles.urgencyText, { color: urgencyStyle.text }]}>{item.urgency}</Text>
        </View>
        <View style={styles.skillBadge}>
          <Ionicons name="flash-outline" size={10} color={Colors.primary} />
          <Text style={styles.skillBadgeText}>{item.skillCategory}</Text>
        </View>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardAuthorRow}>
        {authorAvatarUri ? (
          <Image source={{ uri: authorAvatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>{getInitials(item.authorName)}</Text>
          </View>
        )}
        <View style={styles.authorMeta}>
          <Text style={styles.authorName}>{item.authorName}</Text>
          <Text style={styles.authorTime}>
            <Ionicons name="time-outline" size={11} color={Colors.accent} />
            {'  '}{formatTimestamp(item.createdAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.requestText}>{item.requestText}</Text>

      <View style={styles.cardFooter}>
        <View style={styles.offerCountRow}>
          <View style={styles.offerAvatarStack}>
            {offerCount > 0 && (
              <View style={styles.offerCountBubble}>
                <Ionicons name="hand-left-outline" size={11} color={Colors.primary} />
                <Text style={styles.offerCountText}>{offerCount} helping</Text>
              </View>
            )}
          </View>
        </View>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {isOwnPost ? (
            <View style={[styles.offerBtn, styles.offerBtnOwn]}>
              <Ionicons name="person-outline" size={15} color={Colors.textMuted} />
              <Text style={[styles.offerBtnText, styles.offerBtnOwnText]}>Your Post</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.offerBtn, hasOffered && styles.offerBtnActive]}
              onPress={handleOfferPress}
              activeOpacity={0.85}
              disabled={hasOffered}
            >
              <Ionicons
                name={hasOffered ? 'checkmark-circle' : 'hand-left-outline'}
                size={15}
                color={hasOffered ? Colors.white : Colors.primary}
              />
              <Text style={[styles.offerBtnText, hasOffered && styles.offerBtnTextActive]}>
                {hasOffered ? 'Requested' : 'Offer Help'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

function EmptyState({ filter }: { filter: FilterTab }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrapper}>
        <Ionicons name="megaphone-outline" size={40} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {filter === 'All' ? 'No requests yet' : `No ${filter} requests`}
      </Text>
      <Text style={styles.emptySubtitle}>
        Be the first to post a skill request and connect with the community
      </Text>
    </View>
  );
}

export default function BoardScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<RequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');

  const [showPostModal, setShowPostModal] = useState(false);
  const [postText, setPostText] = useState('');
  const [postCategory, setPostCategory] = useState('Design');
  const [postUrgency, setPostUrgency] = useState<UrgencyLevel>('Normal');
  const [posting, setPosting] = useState(false);

  const [authorProfile, setAuthorProfile] = useState<{ name: string; avatar: string; skillsOffered: string }>({
    name: user?.displayName ?? 'Swapr User',
    avatar: '',
    skillsOffered: '',
  });

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAuthorProfile({
          name: data.name ?? user.displayName ?? 'Swapr User',
          avatar: data.avatar ?? '',
          skillsOffered: data.skillsOffered ?? '',
        });
      }
    });
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: RequestDoc[] = [];
        snapshot.forEach((docSnap) => {
          docs.push({ id: docSnap.id, ...docSnap.data() } as RequestDoc);
        });
        setRequests(docs);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Urgent') return r.urgency === 'Urgent' || r.urgency === 'Critical';
    return r.skillCategory?.toLowerCase() === activeFilter.toLowerCase();
  });

  const modalAuthorAvatarUri = resolveAvatarUri(authorProfile.avatar);

  const handleOfferHelp = useCallback(
    async (item: RequestDoc) => {
      if (!user) return;
      // Guard: own post or already offered
      if (item.authorId === user.uid) return;
      const hasOffered = item.offeredBy?.includes(user.uid);
      if (hasOffered) return;

      try {
        // Write swap request to Firestore
        await addDoc(collection(db, 'swapRequests'), {
          fromUserId: user.uid,
          fromUserName: authorProfile.name,
          fromUserAvatar: isRemoteAvatarUrl(authorProfile.avatar) ? authorProfile.avatar : '',
          fromSkillsOffered: authorProfile.skillsOffered,
          toUserId: item.authorId,
          type: 'offer',
          sourceId: item.id,
          status: 'pending',
          createdAt: serverTimestamp(),
        });

        // Update offeredBy array for visual count on the post card
        await updateDoc(doc(db, 'requests', item.id), {
          offeredBy: arrayUnion(user.uid),
        });
      } catch {
        Alert.alert('Error', 'Could not send offer. Please try again.');
      }
    },
    [user, authorProfile]
  );

  async function handlePost() {
    if (!user) return;
    if (!postText.trim()) {
      Alert.alert('Empty Request', 'Please describe what skill you need help with.');
      return;
    }
    setPosting(true);
    try {
      const fallbackAvatar = FALLBACK_AVATARS[Math.floor(Math.random() * FALLBACK_AVATARS.length)];
      const publicAuthorAvatar = isRemoteAvatarUrl(authorProfile.avatar) ? authorProfile.avatar : fallbackAvatar;
      await addDoc(collection(db, 'requests'), {
        authorId: user.uid,
        authorName: authorProfile.name,
        authorAvatar: publicAuthorAvatar,
        requestText: postText.trim(),
        skillCategory: postCategory,
        urgency: postUrgency,
        offeredBy: [],
        createdAt: serverTimestamp(),
      });
      setPostText('');
      setPostCategory('Design');
      setPostUrgency('Normal');
      setShowPostModal(false);
    } catch {
      Alert.alert('Error', 'Could not post your request. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  function renderItem({ item }: { item: RequestDoc }) {
    return (
      <RequestCard
        item={item}
        currentUserId={user?.uid ?? ''}
        isOwnPost={item.authorId === user?.uid}
        onOfferHelp={handleOfferHelp}
      />
    );
  }

  const SKILL_CATEGORIES = ['Design', 'Tech', 'Art', 'Writing', 'Music', 'Photo', 'Other'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Board</Text>
          <Text style={styles.headerSubtitle}>Urgent skill requests from the community</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
            <View style={styles.headerNotifDot} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          data={FILTER_TABS as unknown as FilterTab[]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab)}
            >
              {tab === 'Urgent' && (
                <View style={[styles.urgencyDot, { backgroundColor: '#F59E0B', marginRight: 4 }]} />
              )}
              <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading requests…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          ListEmptyComponent={<EmptyState filter={activeFilter} />}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 88 }]}
        onPress={() => setShowPostModal(true)}
        activeOpacity={0.88}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      <Modal
        visible={showPostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPostModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKAV}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPostModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Post a Request</Text>
                <Text style={styles.modalSubtitle}>Let the community know what skill you need</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPostModal(false)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalAuthorRow}>
              {modalAuthorAvatarUri ? (
                <Image source={{ uri: modalAuthorAvatarUri }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, styles.modalAvatarPlaceholder]}>
                  <Text style={styles.modalAvatarInitials}>{getInitials(authorProfile.name)}</Text>
                </View>
              )}
              <View>
                <Text style={styles.modalAuthorName}>{authorProfile.name}</Text>
                <Text style={styles.modalAuthorSub}>Posting publicly to the community</Text>
              </View>
            </View>

            <TextInput
              style={styles.postInput}
              placeholder="Describe the skill you urgently need help with…"
              placeholderTextColor={Colors.accent}
              multiline
              numberOfLines={4}
              value={postText}
              onChangeText={setPostText}
              textAlignVertical="top"
              maxLength={280}
            />
            <Text style={styles.charCount}>{postText.length}/280</Text>

            <Text style={styles.sectionLabel}>Skill Category</Text>
            <FlatList
              data={SKILL_CATEGORIES}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.chipList}
              renderItem={({ item: cat }) => (
                <TouchableOpacity
                  style={[styles.chip, postCategory === cat && styles.chipActive]}
                  onPress={() => setPostCategory(cat)}
                >
                  <Text style={[styles.chipText, postCategory === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <Text style={styles.sectionLabel}>Urgency Level</Text>
            <View style={styles.urgencyRow}>
              {URGENCY_LEVELS.map((level) => {
                const s = getUrgencyStyle(level);
                const active = postUrgency === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.urgencyOption,
                      { borderColor: active ? s.dot : Colors.border },
                      active && { backgroundColor: s.bg },
                    ]}
                    onPress={() => setPostUrgency(level)}
                  >
                    <View style={[styles.urgencyDot, { backgroundColor: s.dot }]} />
                    <Text style={[styles.urgencyOptionText, active && { color: s.text }]}>
                      {level}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark-circle" size={14} color={s.dot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.postBtn, (!postText.trim() || posting) && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!postText.trim() || posting}
              activeOpacity={0.85}
            >
              {posting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="megaphone-outline" size={18} color={Colors.white} />
                  <Text style={styles.postBtnText}>Post Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerNotifDot: {
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
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 10,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 4,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  filterTabTextActive: {
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  urgencyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skillBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  menuBtn: {
    marginLeft: 'auto',
    padding: 2,
  },
  cardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  authorTime: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '500',
  },
  requestText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    fontWeight: '400',
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  offerCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerCountBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offerCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  offerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  offerBtnActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  offerBtnOwn: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  offerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  offerBtnTextActive: {
    color: Colors.white,
  },
  offerBtnOwnText: {
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 19,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  modalKAV: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  modalAvatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  modalAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 1,
  },
  modalAuthorSub: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '500',
  },
  postInput: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400',
    minHeight: 100,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    textAlign: 'right',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chipList: {
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  urgencyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  urgencyOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  postBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  postBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
});
