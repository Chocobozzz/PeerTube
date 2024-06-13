import assert from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { srtToTxt } from './subtitle.js'

export type TranscriptFormat = 'txt' | 'vtt' | 'srt' | 'json'

export class TranscriptFile {
  path: string
  language: string
  format: TranscriptFormat = 'vtt'

  constructor ({ path, language, format = 'vtt' }: { path: string, language: string, format?: TranscriptFormat }) {
    this.path = path
    this.language = language
    this.format = format
  }

  /**
   * Asynchronously reads the entire contents of a transcript file.
   * @see https://nodejs.org/docs/latest-v18.x/api/fs.html#filehandlereadfileoptions for options
   */
  async read (options: Parameters<typeof readFile>[1] = 'utf8') {
    return readFile(this.path, options)
  }

  static fromPath (path: string, language = 'en') {
    const format = extname(path).substring(1)

    const guessableFormats = [ 'txt', 'vtt', 'srt' ]
    assert(
      guessableFormats.includes(format),
      `Couldn't guess transcript format from extension "${format}". Valid formats are: ${guessableFormats.join(', ')}."`)

    return new TranscriptFile({ path, language, format: format as TranscriptFormat })
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
    if (this.language !== transcript.language) {
      return false
    }

    const content = await this.read()
    const transcriptContent = await transcript.read()

    if (!caseSensitive) {
      return String(content).toLowerCase() === String(transcriptContent).toLowerCase()
    }

    return content === transcriptContent
  }

  async readAsTxt () {
    return srtToTxt(String(await this.read()))
  }
}
