import { View, Text, Pressable } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppStore } from '@/store';

type RecordButtonProps = {
  onRecordStart: () => void;
  onRecordStop: () => void;
  isRecording: boolean;
};

const MAX_RECORD_SECONDS = 30;

export default function RecordButton({ onRecordStart, onRecordStop, isRecording }: RecordButtonProps) {
  const isTurnLimitReached = useAppStore((s) => s.isTurnLimitReached);
  const [seconds, setSeconds] = useState(MAX_RECORD_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      setSeconds(MAX_RECORD_SECONDS);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            onRecordStop();
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
  }, [isRecording, onRecordStop]);

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
        onPressIn={onRecordStart}
        onPressOut={onRecordStop}
        className={`w-16 h-16 rounded-full items-center justify-center ${
          isRecording ? 'bg-red-500' : 'bg-blue-500'
        }`}
      >
        <Ionicons
          name={isRecording ? 'radio-button-on' : 'mic'}
          size={28}
          color="white"
        />
      </Pressable>
    </View>
  );
}
