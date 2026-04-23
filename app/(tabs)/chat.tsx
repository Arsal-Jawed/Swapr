import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';

const CONVERSATIONS = [
  {
    id: '1',
    user: 'Alex Reyes',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    lastMessage: 'Sounds great! Can we meet Thursday?',
    timeAgo: '2m',
    unread: 3,
    online: true,
    skill: 'UI/UX Design',
  },
  {
    id: '2',
    user: 'Maya Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    lastMessage: 'I\'d love to swap illustration for dev',
    timeAgo: '14m',
    unread: 1,
    online: true,
    skill: 'Illustration',
  },
  {
    id: '3',
    user: 'Jordan Park',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    lastMessage: 'Sent you the portfolio link!',
    timeAgo: '1h',
    unread: 0,
    online: false,
    skill: 'Photography',
  },
  {
    id: '4',
    user: 'Sam Oliver',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    lastMessage: 'Looking forward to our swap!',
    timeAgo: '3h',
    unread: 0,
    online: false,
    skill: 'Video Editing',
  },
  {
    id: '5',
    user: 'Priya Nair',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
    lastMessage: 'Thanks for the session, really helpful!',
    timeAgo: '1d',
    unread: 0,
    online: true,
    skill: 'Writing',
  },
  {
    id: '6',
    user: 'Leo Martinez',
    avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200&h=200&fit=crop',
    lastMessage: 'When are you free next week?',
    timeAgo: '2d',
    unread: 0,
    online: false,
    skill: 'Music Production',
  },
];

export default function ChatScreen() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filtered = CONVERSATIONS.filter(
    (c) =>
      c.user.toLowerCase().includes(search.toLowerCase()) ||
      c.skill.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.composeBtn}>
          <Ionicons name="create-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
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

      <View style={styles.requestBanner}>
        <View style={styles.requestBannerLeft}>
          <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.requestBannerTitle}>2 Swap Requests</Text>
            <Text style={styles.requestBannerSub}>People want to swap skills with you</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Text style={styles.requestBannerCta}>View</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {filtered.map((convo) => (
          <TouchableOpacity 
            key={convo.id} 
            style={styles.row}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: convo.id, user: convo.user, avatar: convo.avatar } })}
          >
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: convo.avatar }} style={styles.avatar} />
              {convo.online && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.rowContent}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{convo.user}</Text>
                <Text style={[styles.rowTime, convo.unread > 0 && styles.rowTimeUnread]}>
                  {convo.timeAgo}
                </Text>
              </View>
              <View style={styles.rowFooter}>
                <Text
                  style={[styles.rowMessage, convo.unread > 0 && styles.rowMessageUnread]}
                  numberOfLines={1}
                >
                  {convo.lastMessage}
                </Text>
                {convo.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{convo.unread}</Text>
                  </View>
                )}
              </View>
              <View style={styles.skillTag}>
                <Ionicons name="flash-outline" size={10} color={Colors.primary} />
                <Text style={styles.skillTagText}>{convo.skill}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  composeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  requestBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  requestBannerSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  requestBannerCta: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
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
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  rowTime: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '500',
  },
  rowTimeUnread: {
    color: Colors.primary,
    fontWeight: '700',
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowMessage: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400',
    flex: 1,
    marginRight: 8,
  },
  rowMessageUnread: {
    color: Colors.text,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  skillTagText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
});
