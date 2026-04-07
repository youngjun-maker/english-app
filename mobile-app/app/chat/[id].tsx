import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Modal,
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
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store';
import { transcribeAudio, sendMessage, fetchMessages, saveExpression } from '@/api/chat';
import type { AITurnContent, Message } from '@/types';
import { cancelTodayStreakReminder } from '@/utils/notifications';
import { SITUATIONS } from '@/constants/situations';

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
  const { id, topicLabel, missionBar, topicId, level: levelParam } = useLocalSearchParams<{
    id: string;
    topicLabel?: string;
    missionBar?: string;
    topicId?: string;
    level?: string;
  }>();

  const difficultyLevel = ([1, 2, 3].includes(Number(levelParam)) ? Number(levelParam) : 2) as 1 | 2 | 3;
  const router = useRouter();

  const showToast = useAppStore((s) => s.showToast);
  const isOffline = useAppStore((s) => s.isOffline);

  const conversationId = id;

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sttFailed, setSttFailed] = useState(false);
  const [missionCleared, setMissionCleared] = useState(false);
  const [currentHint, setCurrentHint] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<ChatTurn>>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const currentSituation = SITUATIONS.find((s) => s.id === topicId);

  /** 돌발 상황 수신 시 붉은 flash + 햅틱 2회 */
  const triggerSurpriseEffect = useCallback(() => {
    // 햅틱 2회
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    // 빨간 테두리 fade in → fade out
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [flashOpacity]);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      const { message_id, user_message_id, content } = await sendMessage(conversationId, text, difficultyLevel);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === tempId
            ? { id: message_id, userMsgId: user_message_id, userText: text, aiContent: content }
            : t
        )
      );
      // 돌발 상황 플래그 처리
      if (content.is_surprise) {
        triggerSurpriseEffect();
      }
      if (content.goal_achieved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMissionCleared(true);
        setCurrentHint(null);
      } else {
        setCurrentHint(content.hint ?? null);
      }
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

        if (turns.length === 0) {
        }

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
  async function handleTextSend(overrideText?: string) {
    const text = (overrideText !== undefined ? overrideText : textInput).trim();
    if (!text || isProcessing) return;

    if (turns.length === 0) {
      cancelTodayStreakReminder().catch(() => {});
    }

    if (overrideText === undefined) setTextInput('');
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

  const topicEmoji = currentSituation?.emoji ?? '💬';

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
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs text-gray-400">Situation Talking</Text>
            <View className={`px-1.5 py-0.5 rounded-full ${
              difficultyLevel === 1 ? 'bg-green-100' :
              difficultyLevel === 3 ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <Text className={`text-[9px] font-bold ${
                difficultyLevel === 1 ? 'text-green-700' :
                difficultyLevel === 3 ? 'text-red-700' : 'text-amber-700'
              }`}>
                {difficultyLevel === 1 ? 'Lv.1 초급' : difficultyLevel === 3 ? 'Lv.3 고급' : 'Lv.2 중급'}
              </Text>
            </View>
          </View>
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

      {/* 미션 바 */}
      {missionBar && (
        <View className="bg-amber-50 border-b border-amber-100 px-4 py-2">
          <Text className="text-amber-700 text-xs font-semibold text-center">
            {missionBar}
          </Text>
        </View>
      )}

      {/* 미션 힌트 배너 */}
      {currentHint && missionBar && (
        <Pressable
          className="bg-indigo-50 border-b border-indigo-100 px-4 py-2.5 flex-row items-center gap-2 active:opacity-70"
          onPress={() => {
            setTextInput(currentHint);
            setIsTextMode(true);
            setCurrentHint(null);
          }}
        >
          <Text className="text-base">💡</Text>
          <Text className="text-xs text-indigo-700 flex-1" numberOfLines={1}>
            {'Try: "' + currentHint + '"'}
          </Text>
          <Text className="text-xs text-indigo-400">탭하면 입력돼요</Text>
        </Pressable>
      )}

      {/* 미션 클리어 모달 */}
      <Modal visible={missionCleared} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/50 px-8">
          <View className="bg-white rounded-3xl px-6 py-8 items-center w-full">
            <Text className="text-5xl mb-4">🎯</Text>
            <Text className="text-2xl font-black text-gray-900 mb-2">미션 클리어!</Text>
            <Text className="text-sm text-gray-500 text-center leading-5 mb-6">
              완벽하게 해냈어요!{'\n'}실전에서도 충분히 통할 실력이에요.
            </Text>
            <Pressable
              className="bg-indigo-500 rounded-2xl py-3.5 px-8 active:opacity-80"
              onPress={() => router.replace('/(tabs)')}
            >
              <Text className="text-white font-bold text-base">홈으로 돌아가기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
        ListHeaderComponent={
          /* AI-first 상황: AI 오프닝 버블 상단 고정 */
          currentSituation?.aiFirst && currentSituation.aiOpeningLine ? (
            <View className="flex-row gap-2.5 items-start mb-4 max-w-[90%]">
              <View className="w-7 h-7 mt-0.5 rounded-full bg-red-50 items-center justify-center flex-shrink-0">
                <BearMascot size="small" />
              </View>
              <View className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 flex-1 border border-gray-100 shadow-sm">
                <Text className="text-sm text-gray-800 leading-5">{currentSituation.aiOpeningLine}</Text>
              </View>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            <TypingIndicator contextText={currentSituation?.typingText} />
            <View className="h-6" />
          </>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Cold-start starter prompt bubbles (user-first 상황, 영어 프롬프트)  */}
      {/* ------------------------------------------------------------------ */}
      {turns.length === 0 && !isProcessing && !isTextMode &&
        !currentSituation?.aiFirst &&
        (currentSituation?.starterPrompts ?? []).length > 0 && (
        <View className="px-4 pb-2 gap-2 items-end">
          {(currentSituation?.starterPrompts ?? []).map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => handleTextSend(prompt)}
              className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2.5 active:opacity-70"
            >
              <Text className="text-sm text-indigo-700">{prompt}</Text>
            </Pressable>
          ))}
        </View>
      )}

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

      {/* ------------------------------------------------------------------ */}
      {/* 돌발 상황 Flash 오버레이                                             */}
      {/* ------------------------------------------------------------------ */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderWidth: 4,
          borderColor: '#EF4444',
          borderRadius: 0,
          opacity: flashOpacity,
        }}
      />
    </KeyboardAvoidingView>
  );
}
