/** Public payload sent to the browser: never carries `correct`. */
export interface PublicOption {
  id: number;
  text: string;
}

export interface PublicQuestion {
  id: number;
  text: string;
  options: PublicOption[];
}

export interface ParticipantInput {
  firstName: string;
  lastName: string;
  staticId: string;
}

export interface SubmittedAnswer {
  questionId: number;
  optionId: number | null;
}

export interface SubmissionPayload {
  participant: ParticipantInput;
  answers: SubmittedAnswer[];
  browserId: string;
}

/** Result returned to the participant: correct options are never revealed. */
export interface AttemptResult {
  attemptId: number;
  score: number;
  total: number;
  percentage: number;
}

export interface AdminResultRow {
  attemptId: number;
  firstName: string;
  lastName: string;
  staticId: string;
  score: number;
  total: number;
  percentage: number;
  createdAt: string;
}

export interface ApiError {
  error: string;
}
