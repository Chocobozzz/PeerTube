export type TranscriptFormat = 'txt' | 'vtt' | 'srt' | 'json'

export type TranscriptFileInterface = { path: string, language?: string, format: TranscriptFormat }
