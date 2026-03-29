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

    // 현재 문장 찾기 (정확한 구간)
    const current = currentScripts.find(
      (s) => currentTime >= s.start && currentTime < s.end,
    );

    // current 없으면 가장 가까운 이전 문장으로 fallback (gap 구간 / 마지막 문장 이후 자동 스크롤 유지)
    const indexToSet =
      current?.index ??
      [...currentScripts].reverse().find((s) => currentTime >= s.start)?.index;
    if (indexToSet !== undefined) setCurrentSentenceIndex(indexToSet);

    // auto-pause / 루프용 currentScript (기존 로직 유지)
    const currentScript =
      current ??
      [...currentScripts].reverse().find((s) => currentTime >= s.start) ??
      currentScripts[currentScripts.length - 1];

    // 루프 — 최우선 처리
    if (isLoopingRef.current) {
      if (currentTime >= currentScript.end) {
        videoRef.current?.seek(currentScript.start);
        videoRef.current?.play();
        isPausedRef.current = false;
      }
      return;
    }

    // Auto-pause (1문장 / 3문장 모드)
    const mode = shadowingModeRef.current;

    if (mode === '1') {
      if (currentTime >= currentScript.end && !isPausedRef.current) {
        isPausedRef.current = true;
        videoRef.current?.pause();
      }
    } else if (mode === '3') {
      const blockIndex = Math.floor(currentScript.index / 3);
      const blockLastIndex = Math.min(blockIndex * 3 + 2, currentScripts.length - 1);
      const blockLastScript = currentScripts[blockLastIndex];
      if (currentTime >= blockLastScript.end && !isPausedRef.current) {
        isPausedRef.current = true;
        videoRef.current?.pause();
      }
    }
    // 전체 모드: pause 없음, ScriptArea가 currentIndex로 자동 스크롤
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
