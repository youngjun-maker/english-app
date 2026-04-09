import { useRef, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createConversation } from '@/api/conversations';
import { useAppStore } from '@/store/useAppStore';
import { SITUATIONS, type Situation, type SituationCategory } from '@/constants/situations';
import { MISSIONS, type Mission } from '@/constants/missions';

const CATEGORIES: { key: SituationCategory | 'All'; label: string }[] = [
  { key: 'All', label: '전체' },
  { key: 'Travel', label: '여행 ✈️' },
  { key: 'Daily', label: '일상 💬' },
  { key: 'Business', label: '비즈니스 💼' },
];

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

/** 미션 브리핑 시작 버튼 — pulse 애니메이션 */
function PulseStartButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        className="bg-amber-500 rounded-2xl py-4 items-center active:opacity-80"
        onPress={onPress}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Text className="text-white font-black text-base">🎯 미션 시작하기</Text>
            <Text className="text-amber-100 text-xs mt-0.5">도전해볼 준비가 됐나요?</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function TopicSelectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SituationCategory | 'All'>('All');
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(2);
  const [selectedSituation, setSelectedSituation] = useState<Situation | null>(null);
  const [missionModalVisible, setMissionModalVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  /** 미션 브리핑 카드 표시용 */
  const [briefingMission, setBriefingMission] = useState<Mission | null>(null);
  const [briefingModalVisible, setBriefingModalVisible] = useState(false);

  const filteredSituations = selectedCategory === 'All'
    ? SITUATIONS
    : SITUATIONS.filter((s) => s.category === selectedCategory);

  const situationMissions = selectedSituation
    ? MISSIONS.filter((m) => m.situationId === selectedSituation.id)
    : [];

  async function startConversation(situation: Situation, mission?: Mission) {
    if (loadingId) return;
    setLoadingId(mission?.id ?? situation.id);
    setMissionModalVisible(false);
    setBriefingModalVisible(false);
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
          level: String(selectedLevel),
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
    setSelectedSituation(situation);
    setMissionModalVisible(true);
  }

  function handleMissionPress(mission: Mission) {
    setBriefingMission(mission);
    setMissionModalVisible(false);
    setBriefingModalVisible(true);
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="bg-white px-5 pb-4 border-b border-gray-100">
        <Pressable className="mb-3 active:opacity-60" onPress={() => router.back()}>
          <Text className="text-sm text-blue-500 font-medium">← 뒤로</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-gray-900">상황 선택</Text>
        <Text className="text-sm text-gray-400 mt-1">연습할 상황을 골라보세요</Text>
      </View>

      {/* Category filter tabs */}
      <View className="bg-white border-b border-gray-100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 py-3 gap-2"
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedCategory(cat.key)}
                className={`px-4 py-2 rounded-full border active:opacity-70 ${
                  isActive
                    ? 'bg-indigo-500 border-indigo-500'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isActive ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Situation grid */}
      <FlatList
        data={filteredSituations}
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
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => { setCustomModalVisible(false); setCustomText(''); }}>
          <Pressable onPress={() => {}} className="w-full">
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* 미션 분기 모달 */}
      <Modal
        visible={missionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMissionModalVisible(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setMissionModalVisible(false)}>
          <Pressable onPress={() => {}} className="w-full">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
            <Text className="text-lg font-black text-gray-900 mb-1">
              {selectedSituation?.emoji} {selectedSituation?.label}
            </Text>
            <Text className="text-sm text-gray-400 mb-4">어떻게 연습할까요?</Text>

            {/* 난이도 선택 */}
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              난이도 선택
            </Text>
            <View className="flex-row gap-2 mb-4">
              {([1, 2, 3] as const).map((lv) => {
                const isActive = selectedLevel === lv;
                const label = lv === 1 ? 'Lv.1 초급' : lv === 2 ? 'Lv.2 중급' : 'Lv.3 고급';
                const desc = lv === 1 ? '꼼꼼한 교정' : lv === 2 ? '주요 실수만 교정' : '교정 최소화';
                const activeColor = lv === 1 ? 'bg-green-500 border-green-500' : lv === 2 ? 'bg-amber-500 border-amber-500' : 'bg-red-500 border-red-500';
                const inactiveColor = 'bg-white border-gray-200';
                return (
                  <Pressable
                    key={lv}
                    onPress={() => setSelectedLevel(lv)}
                    className={`flex-1 rounded-xl border py-2.5 items-center active:opacity-70 ${isActive ? activeColor : inactiveColor}`}
                  >
                    <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
                    <Text className={`text-[10px] mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>{desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 그냥 대화하기 */}
            <Pressable
              className="bg-indigo-500 rounded-2xl py-4 items-center mb-3 active:opacity-80"
              onPress={() => selectedSituation && startConversation(selectedSituation)}
            >
              <Text className="text-white font-bold text-base">💬 그냥 대화하기</Text>
              <Text className="text-indigo-200 text-xs mt-0.5">자유롭게 대화해요</Text>
            </Pressable>

            {/* 미션 목록 */}
            {situationMissions.length > 0 && (
              <>
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  🎯 미션 도전
                </Text>
                {situationMissions.map((mission) => (
                  <Pressable
                    key={mission.id}
                    className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5 mb-2 active:opacity-70"
                    onPress={() => handleMissionPress(mission)}
                  >
                    <Text className="text-sm font-bold text-amber-800">{mission.label}</Text>
                    <Text className="text-xs text-amber-600 mt-0.5">{mission.desc}</Text>
                    <Text className="text-[10px] text-amber-400 mt-1">탭하면 미션 브리핑을 볼 수 있어요 →</Text>
                  </Pressable>
                ))}
              </>
            )}

            <Pressable
              className="mt-2 py-3 items-center active:opacity-60"
              onPress={() => setMissionModalVisible(false)}
            >
              <Text className="text-sm text-gray-400">취소</Text>
            </Pressable>
          </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 미션 브리핑 카드 모달 */}
      <Modal
        visible={briefingModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setBriefingModalVisible(false);
          setMissionModalVisible(true);
        }}
      >
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => { setBriefingModalVisible(false); setMissionModalVisible(true); }}>
          {/* 그라데이션 효과: 상단 amber → 하단 white */}
          <Pressable onPress={() => {}} className="w-full">
          <View className="rounded-t-3xl overflow-hidden">
            {/* 상단 헤더 (amber 배경) */}
            <View className="bg-amber-500 px-5 pt-6 pb-5">
              <View className="flex-row items-center justify-between mb-3">
                <View className="bg-amber-400 rounded-full px-3 py-1">
                  <Text className="text-amber-900 text-xs font-bold">🎯 미션 브리핑</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setBriefingModalVisible(false);
                    setMissionModalVisible(true);
                  }}
                  className="w-7 h-7 bg-amber-400/60 rounded-full items-center justify-center active:opacity-60"
                >
                  <Text className="text-amber-900 text-sm font-bold">✕</Text>
                </Pressable>
              </View>
              <Text className="text-white text-xl font-black leading-6">
                {briefingMission?.label}
              </Text>
            </View>

            {/* 본문 (white 배경) */}
            <View className="bg-white px-5 pt-5 pb-10">
              {/* 미션 목표 */}
              <View className="bg-amber-50 rounded-2xl p-4 mb-4 border border-amber-100">
                <Text className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1.5">미션 목표</Text>
                <Text className="text-sm text-gray-800 leading-5">{briefingMission?.mission}</Text>
              </View>

              {/* 성공 조건 체크리스트 */}
              <View className="mb-5">
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">성공 조건</Text>
                {(briefingMission?.successConditions ?? []).map((condition, idx) => (
                  <View key={idx} className="flex-row items-start gap-2.5 mb-2.5">
                    <View className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 items-center justify-center flex-shrink-0 mt-0.5">
                      <Text className="text-amber-600 text-[10px] font-bold">{idx + 1}</Text>
                    </View>
                    <Text className="text-sm text-gray-700 flex-1 leading-5">{condition}</Text>
                  </View>
                ))}
              </View>

              {/* 시작 버튼 (pulse 애니메이션) */}
              <PulseStartButton
                onPress={() => selectedSituation && startConversation(selectedSituation, briefingMission ?? undefined)}
                loading={loadingId === briefingMission?.id}
              />

              <Pressable
                className="mt-3 py-3 items-center active:opacity-60"
                onPress={() => {
                  setBriefingModalVisible(false);
                  setMissionModalVisible(true);
                }}
              >
                <Text className="text-sm text-gray-400">← 상황 선택으로 돌아가기</Text>
              </Pressable>
            </View>
          </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
