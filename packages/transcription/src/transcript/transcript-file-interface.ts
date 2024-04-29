export type TranscriptFormat = 'txt' | 'vtt' | 'srt'

export type TranscriptFileInterface = { path: string, language?: string, format: TranscriptFormat }
