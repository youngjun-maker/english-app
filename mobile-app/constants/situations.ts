export type Situation = {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  /** AI가 먼저 말하는 상황 (입국심사, 바리스타 등) */
  aiFirst?: boolean;
  /** aiFirst=true 일 때 채팅창 상단에 표시할 AI 첫 마디 */
  aiOpeningLine?: string;
  /** aiFirst=false 일 때 유저에게 보여줄 영어 추천 프롬프트 */
  starterPrompts?: string[];
};

// id는 ai-server/prompts/ 파일명(확장자 제외)과 일치해야 함
export const SITUATIONS: Situation[] = [
  {
    id: 'cafe_order',
    emoji: '☕',
    label: '카페 주문',
    desc: '음료 주문, 커스텀 요청, 픽업 안내',
    aiFirst: true,
    aiOpeningLine: "Hi there! Welcome. What can I get started for you today?",
  },
  {
    id: 'airport_immigration',
    emoji: '✈️',
    label: '공항 입국심사',
    desc: '비자, 방문 목적, 체류 기간 설명',
    aiFirst: true,
    aiOpeningLine: "Next, please. Passport? What's the purpose of your visit?",
  },
  {
    id: 'hotel_checkin',
    emoji: '🏨',
    label: '호텔 체크인',
    desc: '예약 확인, 룸 요청, 어메니티 문의',
    starterPrompts: [
      "Hi, I have a reservation. The name is on Park.",
      "Could I get a room with a nice view?",
      "Does the room include breakfast?",
    ],
  },
  {
    id: 'small_talk',
    emoji: '💬',
    label: '스몰토크',
    desc: '날씨, 주말 이야기, 가벼운 일상',
    starterPrompts: [
      "Beautiful weather today, isn't it?",
      "How have you been lately?",
      "What did you get up to this weekend?",
    ],
  },
  {
    id: 'opinion',
    emoji: '💭',
    label: '의견 말하기',
    desc: '찬반 토론, 논리적 설득, 제안',
    starterPrompts: [
      "I think that's actually a great point.",
      "I'm not sure I agree with that.",
      "Here's my take on the matter.",
    ],
  },
];
