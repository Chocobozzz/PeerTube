export type TranscriptFormat = 'txt' | 'vtt' | 'srt'

export type Transcript = { path: string, language?: string, format: TranscriptFormat }
