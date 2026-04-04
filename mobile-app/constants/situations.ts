export type Situation = {
  id: string;
  label: string;
  emoji: string;
  desc: string;
};

// id는 ai-server/prompts/ 파일명(확장자 제외)과 일치해야 함
export const SITUATIONS: Situation[] = [
  {
    id: 'cafe_order',
    emoji: '☕',
    label: '카페 주문',
    desc: '음료 주문, 커스텀 요청, 픽업 안내',
  },
  {
    id: 'airport_immigration',
    emoji: '✈️',
    label: '공항 입국심사',
    desc: '비자, 방문 목적, 체류 기간 설명',
  },
  {
    id: 'hotel_checkin',
    emoji: '🏨',
    label: '호텔 체크인',
    desc: '예약 확인, 룸 요청, 어메니티 문의',
  },
  {
    id: 'small_talk',
    emoji: '💬',
    label: '스몰토크',
    desc: '날씨, 주말 이야기, 가벼운 일상',
  },
  {
    id: 'opinion',
    emoji: '💭',
    label: '의견 말하기',
    desc: '찬반 토론, 논리적 설득, 제안',
  },
];
