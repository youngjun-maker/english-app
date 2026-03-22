import { View, Text, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import UserBubble from '@/components/chat/UserBubble';
import AIBubble from '@/components/chat/AIBubble';
import TTSButton from '@/components/common/TTSButton';
import { fetchMessages } from '@/api/chat';
import { useTTSButton } from '@/hooks/useTTSButton';
import type { AITurnContent } from '@/types';

const SOURCE_BLOCK_LABEL: Record<string, string> = {
  user_speech: '내 발화',
  feedback: '교정 표현',
  response: 'AI 응답',
};

type ContextTurn = {
  id: string;
  userText: string;
  aiContent: AITurnContent;
};

export default function ExpressionDetailScreen() {
  const {
    expressionId,
    conversationId,
    messageId,
    expressionText,
    topicLabel,
    sourceBlock,
  } = useLocalSearchParams<{
    expressionId: string;
    conversationId: string;
    messageId: string;
    expressionText?: string;
    topicLabel?: string;
    sourceBlock?: string;
  }>();
  const router = useRouter();

  const { isPlaying, handlePress } = useTTSButton(expressionText ?? '');
  const [contextTurns, setContextTurns] = useState<ContextTurn[]>([]);
  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    fetchMessages(conversationId)
      .then((msgs) => {
        const turns: ContextTurn[] = [];
        const userMsgs = msgs.filter((m) => m.content_type === 'user_speech');
        for (const userMsg of userMsgs) {
          const aiMsg = msgs.find(
            (m) =>
              m.content_type === 'ai_turn' &&
              m.turn_number === userMsg.turn_number + 1
          );
          if (!aiMsg) continue;
          turns.push({
            id: aiMsg.id,
            userText: (userMsg.content as { text: string }).text,
            aiContent: aiMsg.content as AITurnContent,
          });
          if (aiMsg.id === messageId) {
            setHighlightedTurnId(aiMsg.id);
          }
        }
        setContextTurns(turns);
      })
      .catch(() => {});
  }, [conversationId, messageId]);

  if (!expressionText) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-400">표현을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* 헤더 */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={20} color="#111827" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {topicLabel ?? '표현 상세'}
          </Text>
          <Text className="text-xs text-gray-400">
            {SOURCE_BLOCK_LABEL[sourceBlock ?? ''] ?? sourceBlock ?? ''}에서 저장
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Section 1: 저장한 표현 강조 */}
        <View className="mx-4 mt-4 mb-6 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4">
          <Text className="text-xs text-blue-500 font-medium mb-2">저장한 표현</Text>
          <Text className="text-xl font-bold text-blue-700 mb-2">
            {expressionText}
          </Text>
          <TTSButton
            text={expressionText}
            isPlaying={isPlaying}
            onPress={handlePress}
          />
        </View>

        {/* Section 2: 원본 대화 문맥 */}
        {contextTurns.length > 0 && (
          <View className="mb-6">
            <Text className="text-base font-bold text-gray-900 px-4 mb-3">원본 대화</Text>
            <View className="px-4">
              {contextTurns.map((turn) => {
                const isHighlighted = turn.id === highlightedTurnId;
                return (
                  <View
                    key={turn.id}
                    className={
                      isHighlighted
                        ? 'bg-blue-50 border border-blue-200 rounded-2xl px-2 py-2 mb-4'
                        : 'mb-4'
                    }
                  >
                    {isHighlighted && (
                      <Text className="text-blue-500 text-xs font-medium mb-1 px-2">
                        📌 저장된 표현이 포함된 대화
                      </Text>
                    )}
                    <UserBubble text={turn.userText} />
                    <AIBubble
                      feedback={turn.aiContent.feedback}
                      nextResponse={turn.aiContent.next_response}
                      messageId={turn.id}
                      readonly
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
