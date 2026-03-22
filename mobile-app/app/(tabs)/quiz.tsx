import { View, Text } from 'react-native';

export default function QuizScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      {/* 헤더 */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">퀴즈</Text>
        <Text className="text-sm text-gray-400 mt-1">저장한 표현으로 실력을 확인하세요</Text>
      </View>

      {/* 준비 중 안내 */}
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-5xl mb-4">🏆</Text>
        <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
          퀴즈 모드 준비 중
        </Text>
        <Text className="text-sm text-gray-400 text-center leading-5">
          {'저장한 표현으로 빈칸 채우기 퀴즈를\n곧 만날 수 있어요!'}
        </Text>
        <View className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
          <Text className="text-xs text-blue-500 font-medium text-center">v1.1 업데이트 예정</Text>
        </View>
      </View>
    </View>
  );
}
