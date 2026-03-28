import { useCallback, useEffect, useRef, useState } from 'react';
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
import BearMascot from '@/components/common/BearMascot';
import { useAppStore } from '@/store';
import { transcribeAudio, sendMessage, fetchMessages, saveExpression } from '@/api/chat';
import type { AITurnContent, Message } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ChatTurn = {
  id: string;
  userMsgId: string | null; // user_speech message_id (fetchMessages에서만 채워짐)
  userText: string;
  aiContent: AITurnContent | null;
};

// ---------------------------------------------------------------------------
// ChatScreen
// ---------------------------------------------------------------------------
export default function ChatScreen() {
  const { id, topicLabel } = useLocalSearchParams<{ id: string; topicLabel?: string }>();
  const router = useRouter();

  const showToast = useAppStore((s) => s.showToast);
  const isOffline = useAppStore((s) => s.isOffline);

  const conversationId = id;

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sttFailed, setSttFailed] = useState(false);

  const flatListRef = useRef<FlatList<ChatTurn>>(null);

  // -------------------------------------------------------------------------
  // 마운트 시 기존 메시지 로드
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!conversationId) return;
    fetchMessages(conversationId)
      .then((msgs: Message[]) => {
        const userMsgs = msgs.filter((m) => m.content_type === 'user_speech');
        const chatTurns: ChatTurn[] = userMsgs.map((userMsg) => {
          const userContent = userMsg.content as { text: string };
          const aiMsg = msgs.find(
            (m) =>
              m.content_type === 'ai_turn' &&
              m.turn_number === userMsg.turn_number + 1
          );
          const aiContent = aiMsg ? (aiMsg.content as AITurnContent) : null;
          return {
            id: aiMsg?.id ?? `ai-${userMsg.id}`,
            userMsgId: userMsg.id,
            userText: userContent.text,
            aiContent,
          };
        });
        setTurns(chatTurns);
      })
      .catch(() => showToast('메시지를 불러오지 못했어요.'));
  }, [conversationId]);

  // -------------------------------------------------------------------------
  // 표현 저장 핸들러
  // -------------------------------------------------------------------------
  const handleSaveExpression = useCallback(async (params: {
    messageId: string;
    expressionText: string;
    sourceBlock: 'user_speech' | 'feedback' | 'response';
    memo: string;
  }) => {
    try {
      await saveExpression({
        conversation_id: conversationId,
        message_id: params.messageId,
        expression_text: params.expressionText,
        source_block: params.sourceBlock,
        user_memo: params.memo,
      });
      showToast('표현이 저장되었습니다!');
    } catch {
      showToast('표현 저장에 실패했어요.');
    }
  }, [conversationId, showToast]);

  // -------------------------------------------------------------------------
  // 공통: AI 응답 fetching 흐름
  // -------------------------------------------------------------------------
  async function fetchAIResponse(tempId: string, text: string) {
    useAppStore.getState().setTypingIndicator(true);
    try {
      const { message_id, content } = await sendMessage(conversationId, text);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === tempId
            ? { id: message_id, userMsgId: t.userMsgId, userText: text, aiContent: content }
            : t
        )
      );
    } catch (err: unknown) {
      setTurns((prev) => prev.filter((t) => t.id !== tempId));
      const apiErr = err as { error?: { code?: string } };
      if (apiErr?.error?.code !== 'TURN_LIMIT_EXCEEDED') {
        showToast('AI 응답을 가져오지 못했어요. 다시 시도해주세요.');
      }
    } finally {
      useAppStore.getState().setTypingIndicator(false);
    }
  }

  // -------------------------------------------------------------------------
  // 녹음 완료 핸들러 — STT → sendMessage 2-Step
  // -------------------------------------------------------------------------
  const handleRecordingStop = useCallback(
    async (uri: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      const tempId = `temp-${Date.now()}`;
      try {
        const { text } = await transcribeAudio(uri);

        // 사용자 말풍선 즉시 표시 (optimistic — userMsgId는 아직 모름)
        setTurns((prev) => [...prev, { id: tempId, userMsgId: null, userText: text, aiContent: null }]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        await fetchAIResponse(tempId, text);
      } catch (err: unknown) {
        const code = (err as { error?: { code?: string } })?.error?.code;
        if (code === 'STT_FAILED') {
          setSttFailed(true);
        } else {
          showToast('음성 인식에 실패했어요. 다시 시도해주세요.');
        }
      } finally {
        setIsProcessing(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [conversationId, isProcessing, showToast]
  );

  // -------------------------------------------------------------------------
  // 텍스트 전송 핸들러
  // -------------------------------------------------------------------------
  async function handleTextSend() {
    const text = textInput.trim();
    if (!text || isProcessing) return;
    setTextInput('');
    setIsProcessing(true);
    const tempId = `temp-${Date.now()}`;
    setTurns((prev) => [...prev, { id: tempId, userMsgId: null, userText: text, aiContent: null }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      await fetchAIResponse(tempId, text);
    } finally {
      setIsProcessing(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function handleEndConversation() {
    router.replace('/(tabs)');
  }

  // -------------------------------------------------------------------------
  // FlatList renderItem
  // -------------------------------------------------------------------------
  const renderItem: ListRenderItem<ChatTurn> = useCallback(({ item: turn }) => (
    <View>
      <UserBubble
        text={turn.userText}
        onSave={
          turn.userMsgId
            ? (text, memo) =>
                handleSaveExpression({
                  messageId: turn.userMsgId!,
                  expressionText: text,
                  sourceBlock: 'user_speech',
                  memo,
                })
            : undefined
        }
      />
      {turn.aiContent && (
        <AIBubble
          feedback={turn.aiContent.feedback}
          nextResponse={turn.aiContent.next_response}
          messageId={turn.id}
          onSave={(text, memo) =>
            handleSaveExpression({
              messageId: turn.id,
              expressionText: text,
              sourceBlock: 'response',
              memo,
            })
          }
          onFeedbackSave={(_idx, text, memo) =>
            handleSaveExpression({
              messageId: turn.id,
              expressionText: text,
              sourceBlock: 'feedback',
              memo,
            })
          }
        />
      )}
    </View>
  ), [handleSaveExpression]);

  // 기본 토픽 이모지 (향후 topicId prop 추가 시 매핑 확장)
  const topicEmoji = '✈️';

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#FAF9F7]"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <View className="bg-white px-5 pt-1 pb-3 border-b border-gray-100 flex-row items-center gap-3">
        {/* Bear avatar + 토픽 이모지 배지 */}
        <View className="relative">
          <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center">
            <BearMascot size="medium" />
          </View>
          {/* 토픽 이모지 배지 — 우하단 */}
          <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-50 items-center justify-center border-2 border-white">
            <Text className="text-[9px]">{topicEmoji}</Text>
          </View>
        </View>

        {/* 타이틀 */}
        <View className="flex-1">
          <Text className="text-xs text-gray-400">Situation Talking · Barista</Text>
          <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
            {topicLabel ?? 'Conversation'}
          </Text>
        </View>

        {/* End 버튼 */}
        <Pressable
          onPress={handleEndConversation}
          className="bg-gray-100 rounded-xl px-3.5 py-1.5 active:opacity-60"
        >
          <Text className="text-sm font-medium text-gray-700">End</Text>
        </Pressable>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Message list                                                        */}
      {/* ------------------------------------------------------------------ */}
      <FlatList
        ref={flatListRef}
        data={turns}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        className="flex-1 px-4 pt-4 bg-[#FAF9F7]"
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
                disabled={isOffline}
                className={`w-10 h-10 rounded-full items-center justify-center ${isOffline ? 'bg-gray-300' : 'bg-blue-500 active:opacity-80'}`}
              >
                <Ionicons name="arrow-up" size={20} color="white" />
              </Pressable>
            </>
          ) : (
            <>
              <View className="w-10" />

              <View className="flex-1 items-center">
                {sttFailed ? (
                  <View className="items-center gap-2">
                    <Text className="text-sm text-red-500">음성 인식에 실패했어요</Text>
                    <Pressable
                      onPress={() => setSttFailed(false)}
                      className="bg-red-500 rounded-xl px-6 py-2 active:opacity-80"
                    >
                      <Text className="text-white text-sm font-medium">다시 말하기</Text>
                    </Pressable>
                  </View>
                ) : (
                  <RecordButton
                    onRecordStop={handleRecordingStop}
                    disabled={isProcessing || isOffline}
                  />
                )}
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
