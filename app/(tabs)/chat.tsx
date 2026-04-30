import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebaseConfig';
import { resolveAvatarUri } from '@/lib/localAvatar';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

interface ConversationItem {
  swapId: string;
  conversationId: string;
  partnerName: string;
  partnerAvatar: string;
  partnerSkill: string;
  updatedAt: number;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Stores the last message for each conversationId
  const [lastMessages, setLastMessages] = useState<Record<string, { text: string; time: string }>>({});

  useEffect(() => {
    if (!user) return;

    // 1. Pending requests count
    const reqQ = query(
      collection(db, 'swapRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubReq = onSnapshot(reqQ, (snap) => {
      setPendingCount(snap.size);
    });

    // 2. Active swaps as user1
    const swapQ1 = query(collection(db, 'swaps'), where('user1Id', '==', user.uid), where('status', '==', 'active'));
    // 3. Active swaps as user2
    const swapQ2 = query(collection(db, 'swaps'), where('user2Id', '==', user.uid), where('status', '==', 'active'));

    let swaps1: any[] = [];
    let swaps2: any[] = [];

    const updateConversations = () => {
      const allSwaps = [...swaps1, ...swaps2];
      const items: ConversationItem[] = allSwaps.map((s) => {
        const isUser1 = s.user1Id === user.uid;
        return {
          swapId: s.id,
          conversationId: s.conversationId,
          partnerName: isUser1 ? s.user2Name : s.user1Name,
          partnerAvatar: isUser1 ? s.user2Avatar : s.user1Avatar,
          partnerSkill: isUser1 ? s.user2SkillsOffered : s.user1SkillsOffered,
          updatedAt: s.createdAt?.toMillis?.() || 0,
        };
      });
      // Sort initially by swap creation time
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(items);
      setLoading(false);
    };

    const unsub1 = onSnapshot(swapQ1, (snap) => {
      swaps1 = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateConversations();
    });
    const unsub2 = onSnapshot(swapQ2, (snap) => {
      swaps2 = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateConversations();
    });

    return () => {
      unsubReq();
      unsub1();
      unsub2();
    };
  }, [user]);

  // Fetch the last message for each active conversation
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    conversations.forEach((conv) => {
      const msgQ = query(
        collection(db, 'conversations', conv.conversationId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const unsub = onSnapshot(msgQ, (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          let timeAgo = 'Just now';
          
          if (data.createdAt) {
            const diffMs = Date.now() - data.createdAt.toMillis();
            const mins = Math.floor(diffMs / 60000);
            if (mins < 1) timeAgo = 'Just now';
            else if (mins < 60) timeAgo = `${mins}m`;
            else if (mins < 1440) timeAgo = `${Math.floor(mins / 60)}h`;
            else timeAgo = `${Math.floor(mins / 1440)}d`;
          }

          setLastMessages((prev) => ({
            ...prev,
            [conv.conversationId]: {
              text: data.text || '📷 Attachment',
              time: timeAgo,
            },
          }));
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [conversations]);

  function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
  }

  const filtered = conversations.filter(
    (c) =>
      c.partnerName.toLowerCase().includes(search.toLowerCase()) ||
      c.partnerSkill.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={17} color={Colors.accent} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={Colors.accent}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {pendingCount > 0 && (
        <TouchableOpacity 
          style={styles.requestBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/swaps')}
        >
          <View style={styles.requestBannerLeft}>
            <View style={styles.bannerIconWrapper}>
              <Ionicons name="swap-horizontal" size={20} color={Colors.white} />
            </View>
            <View>
              <Text style={styles.requestBannerTitle}>{pendingCount} Swap Request{pendingCount > 1 ? 's' : ''}</Text>
              <Text style={styles.requestBannerSub}>People want to swap skills with you</Text>
            </View>
          </View>
          <View style={styles.requestBannerRight}>
            <Text style={styles.requestBannerCta}>View</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </View>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No active conversations</Text>
              <Text style={styles.emptySubText}>Accept a swap request to start chatting</Text>
            </View>
          ) : (
            filtered.map((convo) => {
              const lastMsg = lastMessages[convo.conversationId];
              const rowAvatarUri = resolveAvatarUri(convo.partnerAvatar);
              return (
                <TouchableOpacity 
                  key={convo.swapId} 
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => router.push({ 
                    pathname: '/chat/[id]', 
                    params: { id: convo.conversationId, user: convo.partnerName, avatar: convo.partnerAvatar } 
                  })}
                >
                  <View style={styles.avatarWrapper}>
                    {rowAvatarUri ? (
                      <Image source={{ uri: rowAvatarUri }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.placeholderAvatar]}>
                        <Text style={styles.initialsText}>{getInitials(convo.partnerName)}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.rowContent}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowName}>{convo.partnerName}</Text>
                      {lastMsg && (
                        <Text style={styles.rowTime}>{lastMsg.time}</Text>
                      )}
                    </View>
                    <View style={styles.rowFooter}>
                      <Text style={styles.rowMessage} numberOfLines={1}>
                        {lastMsg ? lastMsg.text : 'Tap to start chatting...'}
                      </Text>
                    </View>
                    <View style={styles.skillTag}>
                      <Ionicons name="flash-outline" size={10} color={Colors.primary} />
                      <Text style={styles.skillTagText}>{convo.partnerSkill || 'No skills listed'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  requestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#D8B4FE',
  },
  requestBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  requestBannerSub: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
  requestBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  requestBannerCta: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  placeholderAvatar: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  rowTime: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400',
    flex: 1,
    marginRight: 8,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skillTagText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptySubText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
