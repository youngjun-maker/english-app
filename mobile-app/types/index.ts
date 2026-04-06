// 분류 타입
export type ContentType = 'user_speech' | 'ai_turn';
export type SourceBlock = 'user_speech' | 'feedback' | 'response';

// LLM 응답 타입
export type FeedbackItem = {
  original: string | null;
  corrected: string | null;
  is_perfect: boolean;
};
export type UserSpeechContent = { text: string };
export type AITurnContent = {
  feedback: FeedbackItem[];
  next_response: string;
  goal_achieved?: boolean; // 미션 모드에서만 등장, undefined = 일반 대화
  hint?: string | null;   // 미션 모드에서 3턴 미달성 시 제공
};
export type MessageContent = AITurnContent | UserSpeechContent;

// DB 엔티티 타입
export type User = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_login_at: string;
};
export type Conversation = {
  id: string;
  user_id: string;
  topic_id: string;
  topic_label: string;
  updated_at: string;
  turn_count: number;
};
export type Message = {
  id: string;
  conversation_id: string;
  turn_number: number;
  role: 'user' | 'assistant';
  content: MessageContent;
  content_type: ContentType;
  created_at: string;
};
export type Expression = {
  id: string;
  expression_text: string;
  source_block: SourceBlock;
  user_memo?: string;
  created_at: string;
  topic_label: string;
  source_sentence: string;
  conversation_id: string;
  message_id: string;
};

// API 요청/응답 타입
export type ErrorCode =
  | 'TURN_LIMIT_EXCEEDED'
  | 'AUDIO_TOO_LONG'
  | 'STT_FAILED'
  | 'LLM_JSON_PARSE_FAILED'
  | 'TTS_FAILED'
  | 'UNAUTHORIZED'
  | 'INVALID_AUDIO_FORMAT';
export type TranscribeResponse = { text: string };
export type SendMessageResponse = {
  message_id: string;
  user_message_id: string;
  turn_number: number;
  content: AITurnContent;
};
export type TTSResponse = { url: string };
export type APIError = {
  error: {
    code: ErrorCode;
    message: string;
  };
};
