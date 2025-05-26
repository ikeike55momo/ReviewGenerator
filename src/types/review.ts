export interface ReviewRequest {
    age_group: string;
    gender: string;
    companion: string;
    personality_type: string;
  }
  
  export interface GeneratedReview {
    text: string;
    score: number;
    metadata: ReviewRequest;
  }
