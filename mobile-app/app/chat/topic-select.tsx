import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { createConversation } from '@/api/conversations';
import { useAppStore } from '@/store/useAppStore';
import { SITUATIONS, type Situation } from '@/constants/situations';
import { MISSIONS, type Mission } from '@/constants/missions';

type SituationCardProps = {
  situation: Situation;
  onPress: (situation: Situation) => void;
  isLoading: boolean;
  disabled: boolean;
};

function SituationCard({ situation, onPress, isLoading, disabled }: SituationCardProps) {
  return (
    <Pressable
      className={`flex-1 bg-white rounded-2xl p-4 m-1.5 border border-gray-100 shadow-sm active:opacity-70 active:scale-95 ${disabled ? 'opacity-50' : ''}`}
      onPress={() => onPress(situation)}
      disabled={disabled}
    >
      {isLoading ? (
        <View className="h-8 mb-2 items-start justify-center">
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      ) : (
        <Text className="text-3xl mb-2">{situation.emoji}</Text>
      )}
      <Text className="text-base font-bold text-gray-900 mb-1">{situation.label}</Text>
      <Text className="text-xs text-gray-400 leading-4">{situation.desc}</Text>
    </Pressable>
  );
}

export default function TopicSelectScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  // 선택된 상황 (미션 분기 모달용)
  const [selectedSituation, setSelectedSituation] = useState<Situation | null>(null);
  const [missionModalVisible, setMissionModalVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customLoading, setCustomLoading] = useState(false);

  const situationMissions = selectedSituation
    ? MISSIONS.filter((m) => m.situationId === selectedSituation.id)
    : [];

  async function startConversation(situation: Situation, mission?: Mission) {
    if (loadingId) return;
    setLoadingId(mission?.id ?? situation.id);
    setMissionModalVisible(false);
    try {
      const conversation = await createConversation(
        situation.id,
        situation.label,
        mission?.id,
      );
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: conversation.id,
          topicLabel: situation.label,
          topicId: situation.id,
          ...(mission ? { missionBar: mission.missionBar } : {}),
        },
      });
    } catch {
      showToast('대화를 시작하지 못했어요. 다시 시도해주세요.');
    } finally {
      setLoadingId(null);
    }
  }

  async function startCustomConversation() {
    if (!customText.trim() || customLoading) return;
    setCustomLoading(true);
    try {
      const conversation = await createConversation('custom', '나만의 상황', undefined, customText.trim());
      setCustomModalVisible(false);
      setCustomText('');
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversation.id, topicLabel: '나만의 상황', topicId: 'custom' },
      });
    } catch {
      showToast('대화를 시작하지 못했어요. 다시 시도해주세요.');
    } finally {
      setCustomLoading(false);
    }
  }

  function handleSituationPress(situation: Situation) {
    const missions = MISSIONS.filter((m) => m.situationId === situation.id);
    if (missions.length === 0) {
      // 미션 없는 상황 → 바로 대화 시작
      startConversation(situation);
    } else {
      // 미션 있는 상황 → 분기 모달 표시
      setSelectedSituation(situation);
      setMissionModalVisible(true);
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <Pressable className="mb-3 active:opacity-60" onPress={() => router.back()}>
          <Text className="text-sm text-blue-500 font-medium">← 뒤로</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-gray-900">상황 선택</Text>
        <Text className="text-sm text-gray-400 mt-1">연습할 상황을 골라보세요</Text>
      </View>

      {/* Situation grid */}
      <FlatList
        data={SITUATIONS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <SituationCard
            situation={item}
            onPress={handleSituationPress}
            isLoading={loadingId === item.id}
            disabled={loadingId !== null}
          />
        )}
        contentContainerClassName="px-2.5 pt-4 pb-8"
        columnWrapperClassName="justify-between"
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Pressable
            onPress={() => setCustomModalVisible(true)}
            className="mx-1.5 mb-2 mt-1 bg-white border border-dashed border-indigo-300 rounded-2xl py-4 items-center active:opacity-70"
            disabled={loadingId !== null}
          >
            <Text className="text-base font-semibold text-indigo-500">✏️ 내 상황 직접 입력하기</Text>
            <Text className="text-xs text-gray-400 mt-1">자유롭게 상황을 설정해요</Text>
          </Pressable>
        }
      />

      {/* 커스텀 상황 입력 모달 */}
      <Modal
        visible={customModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setCustomModalVisible(false); setCustomText(''); }}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
            <Text className="text-lg font-black text-gray-900 mb-1">✏️ 내 상황 직접 설정</Text>
            <Text className="text-sm text-gray-400 mb-4">어떤 상황인지 자유롭게 입력해보세요</Text>

            <TextInput
              className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-800 text-sm min-h-[80px]"
              value={customText}
              onChangeText={setCustomText}
              placeholder="예: 내일 구글 면접 있어, 면접관 해줘"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={150}
              textAlignVertical="top"
            />
            <Text className="text-xs text-gray-400 text-right mt-1 mb-4">{customText.length}/150</Text>

            <Pressable
              className={`rounded-2xl py-4 items-center mb-3 ${(!customText.trim() || customLoading) ? 'bg-gray-200' : 'bg-indigo-500 active:opacity-80'}`}
              onPress={startCustomConversation}
              disabled={!customText.trim() || customLoading}
            >
              {customLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className={`font-bold text-base ${(!customText.trim() || customLoading) ? 'text-gray-400' : 'text-white'}`}>시작하기</Text>
              )}
            </Pressable>

            <Pressable
              className="py-3 items-center active:opacity-60"
              onPress={() => { setCustomModalVisible(false); setCustomText(''); }}
            >
              <Text className="text-sm text-gray-400">취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 미션 분기 모달 */}
      <Modal
        visible={missionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMissionModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
            <Text className="text-lg font-black text-gray-900 mb-1">
              {selectedSituation?.emoji} {selectedSituation?.label}
            </Text>
            <Text className="text-sm text-gray-400 mb-5">어떻게 연습할까요?</Text>

            {/* 그냥 대화하기 */}
            <Pressable
              className="bg-indigo-500 rounded-2xl py-4 items-center mb-3 active:opacity-80"
              onPress={() => selectedSituation && startConversation(selectedSituation)}
            >
              <Text className="text-white font-bold text-base">💬 그냥 대화하기</Text>
              <Text className="text-indigo-200 text-xs mt-0.5">자유롭게 대화해요</Text>
            </Pressable>

            {/* 미션 목록 */}
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              🎯 미션 도전
            </Text>
            {situationMissions.map((mission) => (
              <Pressable
                key={mission.id}
                className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5 mb-2 active:opacity-70"
                onPress={() => selectedSituation && startConversation(selectedSituation, mission)}
              >
                <Text className="text-sm font-bold text-amber-800">{mission.label}</Text>
                <Text className="text-xs text-amber-600 mt-0.5">{mission.desc}</Text>
              </Pressable>
            ))}

            <Pressable
              className="mt-2 py-3 items-center active:opacity-60"
              onPress={() => setMissionModalVisible(false)}
            >
              <Text className="text-sm text-gray-400">취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
