import type { Expression, AITurnContent, FeedbackItem } from '@/types';

export const DUMMY_EXPRESSIONS: Expression[] = [
  {
    id: 'expr-001',
    expression_text: 'I would like to order',
    source_block: 'feedback',
    user_memo: '정중한 주문 표현',
    created_at: '2026-03-22T10:30:00Z',
    topic_label: '카페 주문',
    source_sentence: 'I would like to order a coffee.',
  },
  {
    id: 'expr-002',
    expression_text: 'Great choice! That will be $5.50.',
    source_block: 'response',
    user_memo: undefined,
    created_at: '2026-03-21T18:00:00Z',
    topic_label: '카페 주문',
    source_sentence: 'Great choice! That will be $5.50.',
  },
  {
    id: 'expr-003',
    expression_text: 'I would like a large latte, please.',
    source_block: 'user_speech',
    user_memo: '완벽한 주문 문장',
    created_at: '2026-03-20T09:15:00Z',
    topic_label: '카페 주문',
    source_sentence: 'I would like a large latte, please.',
  },
];

// 상세 화면용 대화 문맥 타입
export type DummyContextTurn = {
  id: string;
  userText: string;
  ai: AITurnContent;
};

export type DummyContextData = {
  expressionId: string;
  highlightedTurnId: string;
  turns: DummyContextTurn[];
};

export const DUMMY_CONTEXT_MAP: Record<string, DummyContextData> = {
  'expr-001': {
    expressionId: 'expr-001',
    highlightedTurnId: 'ctx-001-turn-1',
    turns: [
      {
        id: 'ctx-001-turn-1',
        userText: 'I want to order a coffee.',
        ai: {
          feedback: [
            {
              original: 'I want to order',
              corrected: 'I would like to order',
              is_perfect: false,
            },
          ],
          next_response: 'Sure! What size would you like?',
        },
      },
      {
        id: 'ctx-001-turn-2',
        userText: 'I would like a large latte, please.',
        ai: {
          feedback: [{ original: null, corrected: null, is_perfect: true }],
          next_response: 'Great choice! That will be $5.50.',
        },
      },
    ],
  },
  'expr-002': {
    expressionId: 'expr-002',
    highlightedTurnId: 'ctx-002-turn-2',
    turns: [
      {
        id: 'ctx-002-turn-1',
        userText: 'Can I get a medium cappuccino?',
        ai: {
          feedback: [{ original: null, corrected: null, is_perfect: true }],
          next_response: 'Of course! Anything else?',
        },
      },
      {
        id: 'ctx-002-turn-2',
        userText: 'No, that is all.',
        ai: {
          feedback: [{ original: null, corrected: null, is_perfect: true }],
          next_response: 'Great choice! That will be $5.50.',
        },
      },
    ],
  },
  'expr-003': {
    expressionId: 'expr-003',
    highlightedTurnId: 'ctx-003-turn-1',
    turns: [
      {
        id: 'ctx-003-turn-1',
        userText: 'I would like a large latte, please.',
        ai: {
          feedback: [{ original: null, corrected: null, is_perfect: true }],
          next_response: 'Perfect! Coming right up.',
        },
      },
    ],
  },
};

// 예문 데이터
export type ExampleSentence = {
  id: string;
  sentence: string;
  translation: string;
};

export const DUMMY_EXAMPLES_MAP: Record<string, ExampleSentence[]> = {
  'expr-001': [
    {
      id: 'ex-001-1',
      sentence: 'I would like to order the pasta, please.',
      translation: '파스타를 주문하고 싶습니다.',
    },
    {
      id: 'ex-001-2',
      sentence: 'I would like to order room service.',
      translation: '룸서비스를 주문하고 싶습니다.',
    },
    {
      id: 'ex-001-3',
      sentence: 'I would like to order the set meal.',
      translation: '세트 메뉴를 주문하고 싶습니다.',
    },
  ],
  'expr-002': [
    {
      id: 'ex-002-1',
      sentence: 'Great choice! The soup of the day is tomato.',
      translation: '훌륭한 선택이에요! 오늘의 수프는 토마토입니다.',
    },
    {
      id: 'ex-002-2',
      sentence: 'Great choice! Our special is the grilled salmon.',
      translation: '훌륭한 선택이에요! 오늘의 특선 요리는 연어 구이입니다.',
    },
  ],
  'expr-003': [
    {
      id: 'ex-003-1',
      sentence: 'I would like a small black coffee, please.',
      translation: '블랙 커피 스몰 사이즈 주세요.',
    },
    {
      id: 'ex-003-2',
      sentence: 'I would like a medium iced tea, please.',
      translation: '아이스티 미디엄 사이즈 주세요.',
    },
  ],
};

export const SOURCE_BLOCK_LABEL: Record<string, string> = {
  user_speech: '내 발화',
  feedback: '교정 표현',
  response: 'AI 응답',
};
