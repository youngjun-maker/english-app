import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import UserBubble from '@/components/chat/UserBubble';
import AIBubble from '@/components/chat/AIBubble';
import RecordButton from '@/components/chat/RecordButton';
import TypingIndicator from '@/components/chat/TypingIndicator';
import { useAppStore } from '@/store';
import type { AITurnContent } from '@/types';

// ---------------------------------------------------------------------------
// Dummy conversation data (2 turns)
// ---------------------------------------------------------------------------
type DummyTurn = {
  id: string;
  userText: string;
  ai: AITurnContent;
};

const DUMMY_TURNS: DummyTurn[] = [
  {
    id: 'turn-1',
    userText: 'I want to order a coffee.',
    ai: {
      feedback: [
        {
          original: 'I want to order',
          corrected: 'I would like to order',
          is_perfect: false,
        },
      ],
      next_response: 'Sure! What size would you like?',
    },
  },
  {
    id: 'turn-2',
    userText: 'I would like a large latte, please.',
    ai: {
      feedback: [
        {
          original: null,
          corrected: null,
          is_perfect: true,
        },
      ],
      next_response: 'Great choice! That will be $5.50.',
    },
  },
];

// ---------------------------------------------------------------------------
// ChatScreen
// ---------------------------------------------------------------------------
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const showToast = useAppStore((s) => s.showToast);

  const [isRecording, setIsRecording] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');

  const flatListRef = useRef<FlatList<DummyTurn>>(null);

  function handleEndConversation() {
    router.replace('/(tabs)/');
  }

  function handleRecordStart() {
    setIsRecording(true);
  }

  const handleRecordStop = useCallback(() => {
    setIsRecording(false);
  }, []);

  function handleTextSend() {
    if (!textInput.trim()) return;
    showToast('텍스트 전송 기능은 Phase 4에서 연동됩니다.');
    setTextInput('');
  }

  const renderItem: ListRenderItem<DummyTurn> = useCallback(({ item: turn }) => (
    <View>
      <UserBubble text={turn.userText} />
      <AIBubble
        feedback={turn.ai.feedback}
        nextResponse={turn.ai.next_response}
        messageId={turn.id}
      />
    </View>
  ), []);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100 flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-xs text-gray-400 mb-0.5">대화 #{id}</Text>
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            카페에서 커피 주문하기
          </Text>
        </View>
        <Pressable
          onPress={handleEndConversation}
          className="bg-gray-100 rounded-xl px-4 py-2 active:opacity-60"
        >
          <Text className="text-sm font-medium text-gray-700">대화 끝내기</Text>
        </Pressable>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Message list                                                        */}
      {/* ------------------------------------------------------------------ */}
      <FlatList
        ref={flatListRef}
        data={DUMMY_TURNS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        className="flex-1 px-4 pt-4"
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <>
            <TypingIndicator />
            <View className="h-6" />
          </>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Input bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <View className="bg-white border-t border-gray-100 px-4 py-3">
        <View className="flex-row items-center gap-3">
          {isTextMode ? (
            <>
              <Pressable
                onPress={() => setIsTextMode(false)}
                className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:opacity-60"
              >
                <Ionicons name="mic-outline" size={20} color="#6B7280" />
              </Pressable>

              <TextInput
                className="flex-1 bg-gray-50 rounded-2xl px-4 py-2 text-gray-800 text-sm"
                value={textInput}
                onChangeText={setTextInput}
                placeholder="메시지 입력..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="send"
                onSubmitEditing={handleTextSend}
                multiline
              />

              <Pressable
                onPress={handleTextSend}
                className="w-10 h-10 rounded-full bg-blue-500 items-center justify-center active:opacity-80"
              >
                <Ionicons name="arrow-up" size={20} color="white" />
              </Pressable>
            </>
          ) : (
            <>
              <View className="w-10" />

              <View className="flex-1 items-center">
                <RecordButton
                  isRecording={isRecording}
                  onRecordStart={handleRecordStart}
                  onRecordStop={handleRecordStop}
                />
              </View>

              <Pressable
                onPress={() => setIsTextMode(true)}
                className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:opacity-60"
              >
                <Ionicons name="keypad-outline" size={20} color="#6B7280" />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
