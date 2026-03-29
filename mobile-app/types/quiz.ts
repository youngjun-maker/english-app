export type QuizQuestion = {
  id: string;
  session_id: string;
  expression_id: string | null;
  expression_text: string;
  example_sentence_en: string;
  example_sentence_ko: string;
  highlight_text: string;
  order_index: number;
  is_correct: boolean | null; // null=미응답, true=알았어, false=몰랐어
};

export type QuizSession = {
  id: string;
  user_id?: string;
  total_count: number;
  correct_count: number | null; // null=진행 중
  created_at: string;
};

export type GenerateQuizResponse = {
  session: QuizSession;
  questions: QuizQuestion[];
};

export type QuizSessionDetail = {
  session: QuizSession;
  questions: QuizQuestion[];
};
