export interface TranscriptFileEvaluation {
  wer: number
  cer: number
  alignment: string
}

export interface TranscriptFileEvaluatorInterface {
  wer(): Promise<number>
  cer(): Promise<number>
  alignment(): Promise<string>
  evaluate(): Promise<TranscriptFileEvaluation>
}
