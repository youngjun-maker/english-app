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
  user_speech: 'My Speech',
  feedback: 'Correction',
  response: 'AI Response',
};

const SOURCE_BLOCK_BADGE: Record<string, { bg: string; text: string }> = {
  user_speech: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  feedback: { bg: 'bg-indigo-50', text: 'text-indigo-500' },
  response: { bg: 'bg-purple-50', text: 'text-purple-600' },
};

type ContextTurn = {
  id: string;
  userText: string;
  aiContent: AITurnContent;
};

export default function ExpressionDetailScreen() {
  const {
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

  const { isLoading, isPlaying, handlePress } = useTTSButton(expressionText ?? '');
  const [contextTurns, setContextTurns] = useState<ContextTurn[]>([]);
  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(null);

  const badgeConfig = SOURCE_BLOCK_BADGE[sourceBlock ?? ''] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
  const sourceLabel = SOURCE_BLOCK_LABEL[sourceBlock ?? ''] ?? sourceBlock ?? '';

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
      <View className="flex-1 items-center justify-center bg-[#FAF9F7]">
        <Text className="text-gray-400">표현을 찾을 수 없습니다.</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-3 bg-blue-500 rounded-2xl">
          <Text className="text-white font-semibold">돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#FAF9F7]">
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
            {topicLabel ?? 'Expression Detail'}
          </Text>
          <Text className="text-xs text-gray-400">{sourceLabel}에서 저장</Text>
        </View>
        <View className="w-9 h-9" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* 저장된 표현 카드 */}
        <View className="mx-4 mt-4 mb-5 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-4">
          <Text className="text-xs text-indigo-500 font-semibold uppercase tracking-wide mb-2">
            Saved Expression
          </Text>
          <Text className="text-lg font-bold text-indigo-800 mb-3">
            {expressionText}
          </Text>

          {/* 배지 + 날짜 | Listen 버튼 */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className={`rounded-full px-2 py-0.5 ${badgeConfig.bg}`}>
                <Text className={`text-xs font-medium ${badgeConfig.text}`}>
                  {sourceLabel}
                </Text>
              </View>
            </View>
            <View className="bg-indigo-100 rounded-full px-3 py-1.5 flex-row items-center gap-1.5">
              <TTSButton
                text={expressionText}
                isLoading={isLoading}
                isPlaying={isPlaying}
                onPress={handlePress}
              />
              <Text className="text-xs text-indigo-600 font-medium">Listen</Text>
            </View>
          </View>
        </View>

        {/* 원본 대화 섹션 */}
        {contextTurns.length > 0 && (
          <View className="mb-8">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 mb-3">
              Original Conversation
            </Text>
            <View className="px-4">
              {contextTurns.map((turn) => {
                const isHighlighted = turn.id === highlightedTurnId;
                return (
                  <View
                    key={turn.id}
                    className={
                      isHighlighted
                        ? 'bg-white border-2 border-indigo-200 rounded-2xl px-3 pt-2 pb-3 mb-4'
                        : 'mb-4 opacity-55'
                    }
                  >
                    {isHighlighted && (
                      <Text className="text-indigo-500 text-xs font-medium mb-2">
                        📌 Saved expression in this turn
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
