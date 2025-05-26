export interface CSVConfig {
  basicRules: BasicRule[];
  humanPatterns: HumanPattern[];
  qaKnowledge: QAKnowledge[];
  successExamples: SuccessExample[];
}

export interface BasicRule {
  category: string;
  type: string;
  content: string;
}

export interface HumanPattern {
  age_group: string;
  personality_type: string;
  gender: string;
  vocabulary: string;
  exclamation_marks: string;
  characteristics: string;
  example: string;
}

export interface QAKnowledge {
  question: string;
  answer: string;
  category: string;
  priority: string;
  example_situation: string;
  example_before: string;
  example_after: string;
}

export interface SuccessExample {
  review: string;
  age: string;
  gender: string;
  companion: string;
  word: string;
  recommend: string;
}