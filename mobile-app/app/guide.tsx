import { ScrollView, Text, View, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQItem = {
  q: string;
  a: string;
};

type FAQSection = {
  title: string;
  items: FAQItem[];
};

const FAQ_DATA: FAQSection[] = [
  {
    title: '🐻 대화 & 홈 화면 (Home)',
    items: [
      {
        q: '하루에 몇 번 대화할 수 있나요?',
        a: '하루에 딱 20번(턴) 깊게 대화할 수 있어요!\n\n제가 한 번 듣고, 한 번 답하는 게 1턴이에요. 홈 화면의 진행 바를 보며 20턴을 꽉 채워보세요. 달성하면 자랑스러운 \'완료\' 도장이 찍히고 불꽃(🔥 스트릭)이 쌓입니다. 횟수는 매일 자정에 다시 빵빵하게 채워드려요!',
      },
      {
        q: '어떤 주제로 대화할 수 있나요?',
        a: '크게 두 가지 방법이 있어요!\n\n💬 Free Talking: 아무 주제나 던져주세요. 일상 이야기, 고민 상담 모두 좋아요.\n\n✈️ Situation (상황극): 카페 주문, 공항 입국 심사 등 특정 상황에 들어갑니다. 특히 \'미션 도전\'을 선택하면, 방탈출 게임처럼 제가 드리는 목표(예: 차가운 커피 환불받기)를 영어로 달성해야 해요. 성공하면 폭죽이 터집니다! 🎉',
      },
      {
        q: '매주 리포트를 준다던데, 뭔가요?',
        a: '📊 이번 주 리포트 기능이에요!\n\n일주일 동안 대화하시면서 틀렸던 표현들을 제가 싹 분석해서 \'가장 많이 틀린 약점 TOP 3\', \'잘한 점\', \'다음 주 목표\'를 정리해 드려요. 과외 선생님의 밀착 피드백이라고 생각하시면 돼요!\n\n홈 화면의 [📊 이번 주 리포트 보기] 버튼을 눌러보세요.',
      },
      {
        q: '예전에 했던 대화를 다시 볼 수 있나요?',
        a: '홈 화면 아래 [Recent History]에서 최근 5개의 대화를 볼 수 있어요.\n\n카드를 누르면 언제든 예전 대화방으로 들어가서 끊겼던 대화를 이어나갈 수 있습니다. 5개 이상이면 [See all] 버튼으로 전체 목록을 볼 수 있어요.',
      },
    ],
  },
  {
    title: '💬 실전 대화 꿀팁 (Chat)',
    items: [
      {
        q: '영어로 어떻게 말하나요? 타자도 되나요?',
        a: '카카오톡 음성 메시지처럼 해보세요!\n\n하단의 마이크 버튼(🎤)을 꾹~ 누른 채로 말하고 손을 떼면 자동으로 텍스트로 변환되어 전송됩니다. (최대 30초)\n\n지하철이거나 조용한 곳이라면 우측 하단의 키보드(⌨️) 버튼을 눌러 텍스트로 입력할 수도 있어요.',
      },
      {
        q: '내 영어가 틀리면 어떡하죠?',
        a: '틀려도 괜찮아요, 제가 다 고쳐드릴게요!\n\n문법이나 어색한 표현이 있다면 채팅창에 피드백 블록이 뜹니다. 원래 문장을 어떻게 고치면 좋은지 알려드려요.\n\n만약 완벽한 문장을 말하셨다면 ✅ Perfect! 칭찬 도장을 쾅 찍어드립니다.',
      },
      {
        q: '원어민 발음으로 다시 듣고 싶어요.',
        a: 'AI 응답이나 교정된 문장 옆에 있는 스피커(🔊) 버튼을 톡 눌러보세요.\n\n진짜 원어민의 자연스러운 억양으로 읽어드릴게요. 한 번 더 누르면 멈춥니다.',
      },
      {
        q: '대화하다가 마음에 드는 표현을 발견했어요!',
        a: '놓치지 말고 말풍선을 꾹~ 길게 눌러보세요!\n\n내 발화, AI의 응답, 피드백 블록 모두 길게 누르면 나만의 단어장(Learn 탭)에 저장할 수 있습니다.',
      },
    ],
  },
  {
    title: '📚 복습과 퀴즈 (Learn & Quiz)',
    items: [
      {
        q: '저장한 표현들은 어디서 보나요?',
        a: '하단 [📚 Learn] 탭에 다 모여있어요!\n\n상단 필터를 눌러 내 표현, AI 표현, 교정받은 표현만 따로 모아볼 수도 있어요. 카드를 누르면 \'이 표현을 어떤 대화 상황에서 썼는지\' 원본 대화가 그대로 나와서 기억에 훨씬 오래 남습니다.',
      },
      {
        q: '퀴즈는 언제 풀 수 있나요?',
        a: 'Learn 탭에 표현이 10개 이상 쌓이면 퀴즈 대결을 시작할 수 있어요!\n\n대화를 많이 해서 보관함을 먼저 두둑하게 채워주세요. [🎯 퀴즈 생성!] 버튼을 누르면 바로 시작됩니다.',
      },
      {
        q: '퀴즈에서 \'알았어👍 / 몰랐어👎\'는 왜 누르나요?',
        a: 'AI가 여러분의 뇌를 해킹(?)하는 기술이에요! (망각 곡선 시스템)\n\n👎 몰랐어를 누른 단어는 내일 퀴즈에 다시 끈질기게 출제되고,\n👍 알았어를 누른 단어는 2일 뒤 → 4일 뒤 → 8일 뒤로 점점 기간을 늘려서 출제합니다.\n\n양심껏 채점해 주시면, 평생 안 까먹게 만들어 드릴게요.',
      },
    ],
  },
  {
    title: '🎧 진짜 원어민 되기 (Shadowing)',
    items: [
      {
        q: '섀도잉은 어떻게 훈련하는 게 좋나요?',
        a: '화면 상단의 3가지 모드를 활용해 보세요!\n\n[1문장] 모드: 영상이 한 문장씩 멈춥니다. 똑같이 따라 말하고 재생 버튼을 누르세요.\n\n[3문장] 모드: 연음과 숨쉬는 타이밍을 연습하기 좋아요.\n\n[전체] 모드: 멈춤 없이 끝까지 쭉 따라가며 실전처럼 말해보세요!\n\n전체 모드로 끝까지 완주하면 완료 뱃지가 붙어요. 🏅',
      },
      {
        q: '영상이 너무 빨라요! 보조 기능이 있나요?',
        a: '하단 컨트롤 바에 모든 무기가 다 있습니다!\n\n🐢 거북이 버튼: 재생 속도를 0.75배속으로 느리게!\n\n👁 블라인드 버튼: 누를 때마다 [한국어 숨기기 → 영어 숨기기 → 모두 보기]로 바뀝니다. 오직 소리에만 집중해 보세요.\n\n🔁 루프 버튼: 유독 안 되는 문장은 켜두세요. 그 문장만 닳도록 무한 반복해 드립니다.\n\n🎤 마이크 버튼: 내 목소리를 녹음하면, 원어민 발음 → 내 발음 순서로 바로 비교해서 들려드려요.',
      },
    ],
  },
  {
    title: '⚙️ 프로필 및 설정 (Settings)',
    items: [
      {
        q: '내 정보와 앱 설정은 어디서 하나요?',
        a: '하단 [⚙️ Settings] 탭에서 이름과 스트릭, 오늘 대화 횟수를 한눈에 볼 수 있습니다.\n\n로그아웃(Sign Out)도 여기서 할 수 있어요!',
      },
    ],
  },
];

function AccordionItem({ q, a }: FAQItem) {
  const [open, setOpen] = useState(false);

  function handlePress() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  }

  return (
    <View className="border-b border-gray-100">
      <Pressable
        className="flex-row items-center px-4 py-4 active:opacity-60"
        onPress={handlePress}
      >
        <Text className="flex-1 text-sm font-semibold text-gray-800 leading-5 pr-2">{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#9CA3AF"
        />
      </Pressable>
      {open && (
        <View className="px-4 pb-4">
          <Text className="text-sm text-gray-600 leading-6">{a}</Text>
        </View>
      )}
    </View>
  );
}

export default function GuideScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#FAF9F7]">
      {/* 헤더 */}
      <View className="flex-row items-center px-4 pt-14 pb-3 bg-[#FAF9F7]">
        <Pressable
          className="w-9 h-9 items-center justify-center rounded-full active:opacity-60 mr-2"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </Pressable>
        <View>
          <Text className="text-xl font-black text-gray-900">도움말 & FAQ</Text>
          <Text className="text-xs text-gray-400 mt-0.5">자주 묻는 질문</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4 pb-10">
          {FAQ_DATA.map((section, si) => (
            <View key={si} className="mb-4">
              {/* 섹션 타이틀 */}
              <Text className="text-base font-bold text-gray-800 mb-2 px-1">
                {section.title}
              </Text>
              {/* 아코디언 카드 */}
              <View className="bg-white rounded-2xl overflow-hidden">
                {section.items.map((item, ii) => (
                  <AccordionItem key={ii} q={item.q} a={item.a} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
