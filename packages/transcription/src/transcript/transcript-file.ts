import { statSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { TranscriptFileInterface, TranscriptFormat } from './transcript-file-interface.js'
import { TranscriptFileEvaluator } from './transcript-file-evaluator.js'

export class TranscriptFile implements TranscriptFileInterface {
  path: string
  language: string = 'en'
  format: TranscriptFormat = 'vtt'

  constructor ({ path, language = 'en', format = 'vtt' }: { path: string, language?: string, format?: TranscriptFormat }) {
    statSync(path)

    this.path = path
    this.language = language
    this.format = format
  }

  /**
   * Asynchronously reads the entire contents of a transcript file.
   * @see https://nodejs.org/docs/latest-v18.x/api/fs.html#filehandlereadfileoptions for options
   */
  async read (options: Parameters<typeof readFile>[1] = 'utf8') {
    return await readFile(this.path, options)
  }

  /**
   * Write a transcript file to disk.
   */
  static async write ({
    path,
    content,
    language = 'en',
    format = 'vtt'
  }: { path: string, content: string, language?: string, format?: TranscriptFormat }): Promise<TranscriptFile> {
    await writeFile(path, content)

    return new TranscriptFile({ path, language, format })
  }

  async equals (transcript: TranscriptFile, caseSensitive: boolean = true) {
    const content = await this.read()
    const transcriptContent = await transcript.read()

    if (!caseSensitive) {
      return String(content).toLowerCase() === String(transcriptContent).toLowerCase()
    }

    return content === transcriptContent
  }

  async evaluate (transcript: TranscriptFile) {
    const evaluator = new TranscriptFileEvaluator(this, transcript)

    return evaluator.evaluate()
  }
}
