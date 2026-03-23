import { Alert, Linking, View, Text, Pressable } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppStore } from '@/store';

type RecordButtonProps = {
  onRecordStop: (uri: string) => void;
  disabled?: boolean;
};

const MAX_RECORD_SECONDS = 30;

export default function RecordButton({ onRecordStop, disabled }: RecordButtonProps) {
  const isTurnLimitReached = useAppStore((s) => s.isTurnLimitReached);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(MAX_RECORD_SECONDS);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 컴포넌트 언마운트 시 녹음 객체 강제 정리
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    };
  }, []);

  // 카운트다운 UI 타이머
  useEffect(() => {
    if (isRecording) {
      setSeconds(MAX_RECORD_SECONDS);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setSeconds(MAX_RECORD_SECONDS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  async function forceCleanupRecording(recording: Audio.Recording) {
    try {
      await recording.stopAndUnloadAsync();
    } catch (_) {}
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (_) {}
  }

  async function stopRecording() {
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    const recording = recordingRef.current;
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (uri) onRecordStop(uri);
    } catch (e) {
      console.warn('stopRecording error:', e);
      recordingRef.current = null;
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (_) {}
    }
  }

  async function startRecording() {
    // 이전 Recording 객체가 남아있으면 먼저 정리
    if (recordingRef.current) {
      const stale = recordingRef.current;
      recordingRef.current = null;
      setIsRecording(false);
      await forceCleanupRecording(stale);
    }

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '마이크 권한 필요',
        '설정에서 마이크 권한을 허용해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync({
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {},
    });

    recordingRef.current = recording;
    setIsRecording(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 30초 자동 종료
    autoStopTimerRef.current = setTimeout(async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await stopRecording();
    }, 30000);
  }

  async function handlePress() {
    if (disabled || isTurnLimitReached) return;

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  if (isTurnLimitReached) {
    return (
      <View className="items-center py-4">
        <Text className="text-gray-500 text-sm text-center">
          오늘의 연습을 모두 완료했어요! 내일 다시 만나요 🎉
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center gap-2">
      {isRecording && (
        <Text className="text-red-500 text-xs font-medium">{seconds}초</Text>
      )}
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`w-16 h-16 rounded-full items-center justify-center ${
          isRecording ? 'bg-red-500' : 'bg-blue-500'
        } ${disabled ? 'opacity-40' : ''}`}
      >
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={28}
          color="white"
        />
      </Pressable>
    </View>
  );
}
