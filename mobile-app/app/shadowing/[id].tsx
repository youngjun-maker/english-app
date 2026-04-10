import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { fetchContentDetail, saveSession } from '@/api/shadowing';
import VideoPlayer, { type VideoPlayerHandle } from '@/components/shadowing/VideoPlayer';
import ModeTab from '@/components/shadowing/ModeTab';
import ScriptArea from '@/components/shadowing/ScriptArea';
import ControlBar from '@/components/shadowing/ControlBar';
import CompletionOverlay from '@/components/shadowing/CompletionOverlay';
import ScriptBottomSheet from '@/components/shadowing/ScriptBottomSheet';
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
    isRecording, setIsRecording,
    resetShadowingState,
    showToast,
  } = useAppStore();

  const [content, setContent] = useState<ShadowingContent | null>(null);
  const [scripts, setScripts] = useState<ShadowingScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showScriptSheet, setShowScriptSheet] = useState(false);
  // 완료 시 소요 시간을 기록하기 위한 state
  const [sessionStartTime] = useState(() => Date.now());
  const isCompletedRef = useRef(false);

  const videoRef = useRef<VideoPlayerHandle>(null);
  // auto-pause 중복 실행 방지 플래그
  const isPausedRef = useRef(false);
  const lastSentenceIndexRef = useRef(-1);
  // 최신 scripts/mode/loop/currentSentenceIndex를 콜백에서 참조하기 위한 ref
  const scriptsRef = useRef(scripts);
  const shadowingModeRef = useRef(shadowingMode);
  const isLoopingRef = useRef(isLooping);
  const currentSentenceIndexRef = useRef(currentSentenceIndex);
  scriptsRef.current = scripts;
  shadowingModeRef.current = shadowingMode;
  isLoopingRef.current = isLooping;
  currentSentenceIndexRef.current = currentSentenceIndex;

  // 녹음/비교재생 관련 ref
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingUriRef = useRef<string | null>(null);
  // 비교 재생 대기 중 플래그 — true인 동안 auto-pause/루프 로직 스킵
  const isPendingCompareRef = useRef(false);

  // 완료 시 소요 시간 (초)
  const elapsedSecondsRef = useRef(0);
  // 루프 반복 횟수
  const loopCountRef = useRef(0);

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
      // 화면 이탈 시 진행 중인 녹음 정리
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
      isCompletedRef.current = false;
      resetShadowingState();
    };
  }, [id]);

  // 타임스탬프 감지 → Auto-pause / 루프 / 스크롤
  function handleTimeUpdate(currentTime: number) {
    const currentScripts = scriptsRef.current;
    if (currentScripts.length === 0) return;

    // 비교 재생 대기 중: pendingScript.end 도달 시 영상 정지 → 300ms 후 내 녹음 재생
    if (isPendingCompareRef.current) {
      const pendingScript = currentScripts[currentSentenceIndexRef.current];
      if (pendingScript && currentTime >= pendingScript.end) {
        isPendingCompareRef.current = false;
        videoRef.current?.pause();
        const uri = recordingUriRef.current;
        if (uri) {
          setTimeout(async () => {
            try {
              await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
              const { sound } = await Audio.Sound.createAsync({ uri });
              await sound.playAsync();
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                  sound.unloadAsync().catch(() => {});
                  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                  recordingUriRef.current = null;
                }
              });
            } catch {
              showToast('녹음 재생에 실패했어요.');
            }
          }, 300);
        }
      }
      // 비교 재생 대기 중에는 auto-pause/루프 로직 실행하지 않음
      return;
    }

    // 현재 정확한 문장 구간 탐색
    const current = currentScripts.find(
      (s) => currentTime >= s.start && currentTime < s.end,
    );

    if (!current) {
      // gap 구간: ref는 건드리지 않고 스크롤만 이전 문장으로 유지
      const fallback = [...currentScripts].reverse().find((s) => currentTime >= s.start);
      if (fallback) setCurrentSentenceIndex(fallback.index);
      return;
    }

    // ── 문장 내부 ─────────────────────────────────────────────────────────────
    const prevIndex = lastSentenceIndexRef.current;
    if (current.index === prevIndex) return; // 같은 문장 → 아무것도 안 함

    // 새 문장 진입
    lastSentenceIndexRef.current = current.index;
    setCurrentSentenceIndex(current.index);

    // 루프 모드: 다음 문장으로 넘어가는 순간 현재 문장 시작점으로 되돌리기
    if (isLoopingRef.current) {
      if (prevIndex >= 0) {
        const prevScript = currentScripts[prevIndex];
        if (prevScript) {
          lastSentenceIndexRef.current = prevIndex;
          setCurrentSentenceIndex(prevIndex);
          loopCountRef.current++;
          videoRef.current?.seek(prevScript.start);
          videoRef.current?.play();
          isPausedRef.current = false;
        }
      }
      return;
    }

    // Auto-pause: 최초 진입(prevIndex=-1)이거나 이미 pause 중이면 skip
    if (prevIndex < 0 || isPausedRef.current) return;

    const mode = shadowingModeRef.current;

    if (mode === '1') {
      // 매 문장 진입 시 pause (seek 없이 현재 위치에서 정지)
      isPausedRef.current = true;
      videoRef.current?.pause();
    } else if (mode === '3') {
      // 3문장 블록 경계 진입 시에만 pause
      const prevBlock = Math.floor(prevIndex / 3);
      const newBlock = Math.floor(current.index / 3);
      if (newBlock > prevBlock) {
        isPausedRef.current = true;
        videoRef.current?.pause();
      }
    }
    // 전체 모드: 마지막 문장 종료 시 완료 처리
    if (mode === 'full') {
      const lastScript = currentScripts[currentScripts.length - 1];
      if (lastScript && currentTime >= lastScript.end && !isCompletedRef.current) {
        isCompletedRef.current = true;
        elapsedSecondsRef.current = Math.round((Date.now() - sessionStartTime) / 1000);
        handleCompletion();
      }
    }
  }

  async function handleCompletion() {
    setShowOverlay(true);
    if (!id) return;
    try {
      await saveSession({ content_id: id, completed: true });
    } catch {
      showToast('완료 기록 저장에 실패했어요.');
    }
  }

  function handleReplay() {
    setShowOverlay(false);
    isCompletedRef.current = false;
    isPausedRef.current = false;
    lastSentenceIndexRef.current = -1;
    loopCountRef.current = 0;
    videoRef.current?.seek(0);
    videoRef.current?.play();
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

  function handleSentencePress(index: number) {
    const script = scripts[index];
    if (!script) return;
    isPausedRef.current = false;
    lastSentenceIndexRef.current = index - 1;
    videoRef.current?.seek(script.start);
    videoRef.current?.play();
  }

  function handleScriptPress() {
    setShowScriptSheet(true);
  }

  async function handleMicPress() {
    if (isRecording) {
      // 녹음 중지
      try {
        await recordingRef.current?.stopAndUnloadAsync();
        const uri = recordingRef.current?.getURI() ?? null;
        recordingUriRef.current = uri;
        recordingRef.current = null;
        setIsRecording(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // 현재 선택된 문장 구간으로 seek 후 비교 재생 시작
        const script = scriptsRef.current[currentSentenceIndexRef.current];
        if (!script || !uri) return;

        isPendingCompareRef.current = true;
        isPausedRef.current = false;
        lastSentenceIndexRef.current = script.index - 1;
        videoRef.current?.seek(script.start);
        videoRef.current?.play();
      } catch {
        showToast('녹음 중지에 실패했어요.');
        setIsRecording(false);
      }
    } else {
      // 녹음 시작
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          showToast('마이크 권한이 필요해요.');
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        // RecordingOptionsPresets.HIGH_QUALITY 사용:
        // android: outputFormat=AndroidOutputFormat.MPEG_4(2), audioEncoder=AndroidAudioEncoder.AAC(3)
        // Rule 4: extension, outputFormat, audioEncoder 모두 포함
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        recordingRef.current = recording;
        setIsRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        showToast('마이크 권한이 필요해요.');
      }
    }
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

  // 완료 오버레이에 전달할 통계
  const elapsedSec = elapsedSecondsRef.current;
  const durationLabel = elapsedSec > 0
    ? `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`
    : `${Math.floor(content.duration / 60)}:${String(Math.floor(content.duration % 60)).padStart(2, '0')}`;

  return (
    <View className="flex-1 bg-white">
      {/* 비디오 플레이어 (상단 safe area 없이 풀블리드) */}
      <VideoPlayer
        ref={videoRef}
        videoUrl={content.video_url}
        duration={content.duration}
        playbackRate={playbackRate}
        onTimeUpdate={handleTimeUpdate}
        onPlayingChange={handlePlayingChange}
      />

      {/* 상단 백 버튼 — 영상 위에 absolute로 오버레이 */}
      <View
        className="absolute left-0 right-0 flex-row items-center px-2"
        style={{ top: insets.top, zIndex: 10 }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full active:opacity-70"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <Ionicons name="chevron-back" size={22} color="white" />
        </Pressable>
        <Text
          className="text-sm font-semibold ml-2 flex-1"
          style={{ color: 'rgba(255,255,255,0.9)' }}
          numberOfLines={1}
        >
          {content.title}
        </Text>
      </View>

      {/* ModeTab */}
      <ModeTab mode={shadowingMode} onModeChange={setShadowingMode} />

      {/* ScriptArea */}
      <ScriptArea
        scripts={scripts}
        currentIndex={currentSentenceIndex}
        blindMode={blindMode}
        onScriptPress={handleSentencePress}
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
          onMicPress={handleMicPress}
        />
      </View>

      {/* 완료 오버레이 */}
      {showOverlay && (
        <CompletionOverlay
          title={content.title}
          onReplay={handleReplay}
          onBack={() => router.back()}
          stats={{
            sentences: scripts.length,
            duration: durationLabel,
            repeats: loopCountRef.current + 1,
          }}
        />
      )}

      {/* 전체 스크립트 바텀시트 */}
      <ScriptBottomSheet
        visible={showScriptSheet}
        scripts={scripts}
        currentIndex={currentSentenceIndex}
        onSeek={handleSentencePress}
        onClose={() => setShowScriptSheet(false)}
      />
    </View>
  );
}
