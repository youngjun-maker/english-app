import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchContentDetail } from '@/api/shadowing';
import VideoPlayer, { type VideoPlayerHandle } from '@/components/shadowing/VideoPlayer';
import ModeTab from '@/components/shadowing/ModeTab';
import ScriptArea from '@/components/shadowing/ScriptArea';
import ControlBar from '@/components/shadowing/ControlBar';
import { useAppStore } from '@/store/useAppStore';
import type { ShadowingContent, ShadowingScript } from '@/types/shadowing';

export default function ShadowingPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    playbackRate, setPlaybackRate,
    shadowingMode, setShadowingMode,
    isLooping, setIsLooping,
    currentSentenceIndex, setCurrentSentenceIndex,
    blindMode, setBlindMode,
    isRecording,
    resetShadowingState,
    showToast,
  } = useAppStore();

  const [content, setContent] = useState<ShadowingContent | null>(null);
  const [scripts, setScripts] = useState<ShadowingScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const videoRef = useRef<VideoPlayerHandle>(null);
  // auto-pause 중복 실행 방지 플래그
  const isPausedRef = useRef(false);
  const lastSentenceIndexRef = useRef(-1);
  // 최신 scripts/mode/loop을 콜백에서 참조하기 위한 ref
  const scriptsRef = useRef(scripts);
  const shadowingModeRef = useRef(shadowingMode);
  const isLoopingRef = useRef(isLooping);
  scriptsRef.current = scripts;
  shadowingModeRef.current = shadowingMode;
  isLoopingRef.current = isLooping;

  // 모드 변경 시 auto-pause 플래그 리셋
  useEffect(() => {
    isPausedRef.current = false;
  }, [shadowingMode]);

  // 콘텐츠 + 스크립트 로드
  useEffect(() => {
    if (!id) return;
    fetchContentDetail(id)
      .then(({ content: c, scripts: s }) => {
        setContent(c);
        setScripts(s);
      })
      .catch(() => showToast('콘텐츠를 불러오지 못했어요.'))
      .finally(() => setIsLoading(false));

    return () => {
      resetShadowingState();
    };
  }, [id]);

  // 타임스탬프 감지 → Auto-pause / 루프 / 스크롤
  function handleTimeUpdate(currentTime: number) {
    const currentScripts = scriptsRef.current;
    if (currentScripts.length === 0) return;

    // 현재 문장 인덱스 결정 (gap 구간은 가장 가까운 이전 문장으로 fallback)
    const current = currentScripts.find(
      (s) => currentTime >= s.start && currentTime < s.end,
    );
    const indexToSet =
      current?.index ??
      [...currentScripts].reverse().find((s) => currentTime >= s.start)?.index;

    if (indexToSet === undefined) return;

    const prevIndex = lastSentenceIndexRef.current;
    const indexChanged = indexToSet !== prevIndex;

    if (indexChanged) {
      lastSentenceIndexRef.current = indexToSet;
      setCurrentSentenceIndex(indexToSet);
    }

    // 루프 모드: 다음 문장으로 넘어가는 순간 현재 문장 시작점으로 되돌리기
    if (isLoopingRef.current) {
      if (indexChanged && prevIndex >= 0) {
        const prevScript = currentScripts[prevIndex];
        if (prevScript) {
          lastSentenceIndexRef.current = prevIndex;
          setCurrentSentenceIndex(prevIndex);
          videoRef.current?.seek(prevScript.start);
          videoRef.current?.play();
          isPausedRef.current = false;
        }
      }
      return;
    }

    // Auto-pause: 문장 전환 감지 방식 (폴링 오차 무관하게 정확히 동작)
    // 최초 진입(prevIndex=-1)이거나 이미 pause 중이면 skip
    if (!indexChanged || prevIndex < 0 || isPausedRef.current) return;

    const mode = shadowingModeRef.current;

    if (mode === '1') {
      // 매 문장 전환마다 pause → 새 문장 시작점에서 대기
      isPausedRef.current = true;
      videoRef.current?.pause();
      videoRef.current?.seek(currentScripts[indexToSet].start);
    } else if (mode === '3') {
      // 3문장 블록 경계 전환 시에만 pause
      const prevBlock = Math.floor(prevIndex / 3);
      const newBlock = Math.floor(indexToSet / 3);
      if (newBlock > prevBlock) {
        isPausedRef.current = true;
        videoRef.current?.pause();
        videoRef.current?.seek(currentScripts[indexToSet].start);
      }
    }
    // 전체 모드: pause 없음
  }

  // 사용자가 직접 재생 누를 때 auto-pause 플래그 리셋
  function handlePlayingChange(playing: boolean) {
    if (playing) {
      isPausedRef.current = false;
    }
  }

  // ControlBar 핸들러
  function handlePlaybackRateToggle() {
    setPlaybackRate(playbackRate === 1.0 ? 0.75 : 1.0);
  }

  function handleBlindModeToggle() {
    setBlindMode(((blindMode + 1) % 3) as 0 | 1 | 2);
  }

  function handleLoopToggle() {
    setIsLooping(!isLooping);
    isPausedRef.current = false;
  }

  function handleScriptPress() {
    showToast('전체 스크립트 보기는 준비 중이에요.');
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!content) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-gray-400 text-center">콘텐츠를 불러올 수 없어요.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-500 font-medium">돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* 상단 백 버튼 */}
      <View className="px-4 py-2 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="text-base font-semibold text-gray-900 ml-1 flex-1" numberOfLines={1}>
          {content.title}
        </Text>
      </View>

      {/* 비디오 플레이어 */}
      <VideoPlayer
        ref={videoRef}
        videoUrl={content.video_url}
        duration={content.duration}
        playbackRate={playbackRate}
        onTimeUpdate={handleTimeUpdate}
        onPlayingChange={handlePlayingChange}
      />

      {/* ModeTab */}
      <ModeTab mode={shadowingMode} onModeChange={setShadowingMode} />

      {/* ScriptArea */}
      <ScriptArea
        scripts={scripts}
        currentIndex={currentSentenceIndex}
        blindMode={blindMode}
      />

      {/* ControlBar */}
      <View style={{ paddingBottom: insets.bottom }}>
        <ControlBar
          playbackRate={playbackRate}
          blindMode={blindMode}
          isLooping={isLooping}
          isRecording={isRecording}
          onPlaybackRateToggle={handlePlaybackRateToggle}
          onBlindModeToggle={handleBlindModeToggle}
          onLoopToggle={handleLoopToggle}
          onScriptPress={handleScriptPress}
          onMicPress={() => {}}
        />
      </View>
    </View>
  );
}
