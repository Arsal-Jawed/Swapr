import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebaseConfig';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';

export default function ScanScreen() {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'myCode'>('scan');
  const [isProcessing, setIsProcessing] = useState(false);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || isProcessing || !user) return;
    setScanned(true);
    setIsProcessing(true);

    try {
      await addDoc(collection(db, 'meetings'), {
        scannedById: user.uid,
        scannedUserId: data,
        verified: true,
        timestamp: serverTimestamp(),
      });
      
      setTargetUserId(data);
      setRatingModalVisible(true);
    } catch {
      Alert.alert(
        'Error',
        'Could not verify meeting. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              setScanned(false);
              setIsProcessing(false);
            },
          },
        ]
      );
    }
  }

  async function submitReview() {
    if (!user || rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }

    setIsSubmittingReview(true);

    try {
      await addDoc(collection(db, 'reviews'), {
        reviewerId: user.uid,
        reviewerName: user.displayName || 'Swapr User',
        targetId: targetUserId,
        rating,
        text: reviewText.trim(),
        timestamp: serverTimestamp(),
      });

      const userRef = doc(db, 'users', targetUserId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const currentRating = data.rating || 0;
        const currentSwaps = data.swapsCompleted || 0;
        
        const newSwaps = currentSwaps + 1;
        const newRating = ((currentRating * currentSwaps) + rating) / newSwaps;

        await updateDoc(userRef, {
          rating: newRating,
          swapsCompleted: newSwaps,
        });
      }

      closeModal();
      Alert.alert('Success', 'Feedback submitted successfully!');
    } catch {
      Alert.alert('Error', 'Failed to submit feedback.');
      setIsSubmittingReview(false);
    }
  }

  function closeModal() {
    setRatingModalVisible(false);
    setRating(0);
    setReviewText('');
    setTargetUserId('');
    setIsSubmittingReview(false);
    setScanned(false);
    setIsProcessing(false);
  }

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.instructionText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.instructionText}>No access to camera requested.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scan' && styles.activeTab]}
          onPress={() => setActiveTab('scan')}
        >
          <Text style={[styles.tabText, activeTab === 'scan' && styles.activeTabText]}>
            Scan Code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myCode' && styles.activeTab]}
          onPress={() => setActiveTab('myCode')}
        >
          <Text style={[styles.tabText, activeTab === 'myCode' && styles.activeTabText]}>
            My Code
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'scan' ? (
        <View style={styles.scanContainer}>
          <Text style={styles.instructionText}>
            Align QR code within the frame to verify meeting
          </Text>

          <View style={styles.cameraFrame}>
            <View style={styles.cameraBorder} />
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.myCodeContainer}>
          <Text style={styles.instructionText}>
            Show this code to verify your skill swap meeting
          </Text>
          
          <View style={styles.qrWrapper}>
            {user?.uid ? (
              <QRCode
                value={user.uid}
                size={220}
                color={Colors.primary}
                backgroundColor={Colors.white}
              />
            ) : (
              <Text style={styles.instructionText}>User ID missing.</Text>
            )}
          </View>

          <View style={styles.profileBadge}>
            <Ionicons name="person-circle-outline" size={24} color={Colors.primary} />
            <Text style={styles.userIdText}>
              ID: {user?.uid.substring(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>
      )}

      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.primary} />
                <Text style={styles.modalTitle}>Meeting Verified!</Text>
                <Text style={styles.modalSubtitle}>Rate your skill swap experience</Text>
              </View>

              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((starIndex) => (
                  <TouchableOpacity
                    key={starIndex}
                    onPress={() => setRating(starIndex)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={starIndex <= rating ? 'star' : 'star-outline'}
                      size={42}
                      color={starIndex <= rating ? Colors.primary : Colors.accent}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.reviewInput}
                placeholder="Write a short review..."
                placeholderTextColor={Colors.accent}
                multiline
                numberOfLines={4}
                value={reviewText}
                onChangeText={setReviewText}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn} 
                  onPress={closeModal}
                  disabled={isSubmittingReview}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, rating === 0 && styles.modalSubmitBtnDisabled]} 
                  onPress={submitReview}
                  disabled={rating === 0 || isSubmittingReview}
                >
                  {isSubmittingReview ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Submit Review</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  activeTabText: {
    color: Colors.primary,
  },
  scanContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  myCodeContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  instructionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  cameraFrame: {
    width: 280,
    height: 280,
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
  },
  cameraBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: Colors.accent,
    borderRadius: 24,
    zIndex: 10,
    pointerEvents: 'none',
  },
  qrWrapper: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 32,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  userIdText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  reviewInput: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    minHeight: 100,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitBtnDisabled: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
});
