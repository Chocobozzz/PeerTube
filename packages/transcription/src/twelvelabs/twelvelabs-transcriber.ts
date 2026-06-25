import { buildSUUID } from '@peertube/peertube-node-utils'
import { join, parse } from 'node:path'
import { AbstractTranscriber, TranscribeArgs } from '../abstract-transcriber.js'
import { TranscriptFile } from '../transcript-file.js'
import { TranscriptionModel } from '../transcription-model.js'

// Pegasus generates text from the audio/video content. We constrain it to emit a valid WebVTT
// transcript so PeerTube can store the result exactly like the output of a local Whisper engine.
const VTT_PROMPT = [
  'Transcribe the spoken audio of this video verbatim into a valid WebVTT subtitle file.',
  'Output ONLY the WebVTT content, nothing else.',
  'Start with the line "WEBVTT".',
  'Split the transcript into short cues. Each cue must have a timestamp line in the format',
  '"HH:MM:SS.mmm --> HH:MM:SS.mmm" followed by the spoken text on the next line, then a blank line.',
  'Timestamps must reflect when the words are spoken in the video.',
  'Do not add speaker labels, comments, styling or markdown code fences.'
].join(' ')

/**
 * Remote transcriber backed by TwelveLabs Pegasus (https://twelvelabs.io).
 *
 * Unlike the Whisper engines, this engine does not run a local binary: it uploads the media file
 * to the TwelveLabs platform and asks the Pegasus video-understanding model to produce a WebVTT
 * transcript. It is fully opt-in and only used when `video_transcription.engine` is set to
 * `twelvelabs`.
 *
 * The API key is read from the `TWELVELABS_API_KEY` environment variable so the secret never has
 * to live in PeerTube's configuration files.
 */
export class TwelveLabsTranscriber extends AbstractTranscriber {

  // The TwelveLabs engine handles every model server-side, so it does not depend on a local model file
  supports (_model: TranscriptionModel) {
    return true
  }

  async transcribe ({
    mediaFilePath,
    language,
    format,
    transcriptDirectory,
    runId = buildSUUID(),
    signal
  }: TranscribeArgs): Promise<TranscriptFile> {
    if (format !== 'vtt') {
      throw new Error(`The "twelvelabs" transcription engine only supports the "vtt" format (received "${format}").`)
    }

    const client = await this.buildClient()

    this.createRun(runId)
    this.startRun()

    try {
      this.logger.debug(`Uploading ${mediaFilePath} to TwelveLabs`, { runId })
      const { assetId } = await client.multipartUpload.uploadFile(mediaFilePath, { fileType: 'video' })

      this.logger.debug(`Creating TwelveLabs Pegasus analysis task for asset ${assetId}`, { runId })
      const { taskId } = await client.analyzeAsync.tasks.create({
        modelName: 'pegasus1.5',
        video: { type: 'asset_id', assetId },
        prompt: VTT_PROMPT,
        temperature: 0
      })

      const vtt = await this.waitForTranscript(client, taskId, signal)

      const outputPath = join(transcriptDirectory, `${parse(mediaFilePath).name}.vtt`)

      return TranscriptFile.write({
        path: outputPath,
        content: this.sanitizeVTT(vtt),
        language: language || 'en',
        format: 'vtt'
      })
    } finally {
      this.stopRun()
    }
  }

  // The platform installs/hosts the model, nothing to install locally
  install () {
    return Promise.resolve()
  }

  // ---------------------------------------------------------------------------

  private async waitForTranscript (client: TwelveLabsClient, taskId: string, signal?: AbortSignal) {
    // Poll until the asynchronous analysis task completes
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) throw new Error('TwelveLabs transcription aborted')

      const task = await client.analyzeAsync.tasks.retrieve(taskId)

      if (task.status === 'ready') {
        const data = task.result?.data
        if (!data) throw new Error(`TwelveLabs task ${taskId} is ready but returned no data`)

        return data
      }

      if (task.status === 'failed') {
        throw new Error(`TwelveLabs transcription task ${taskId} failed: ${task.error?.message || 'unknown error'}`)
      }

      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  // Pegasus is instructed to return raw WebVTT, but defensively strip markdown code fences if present
  private sanitizeVTT (content: string) {
    const trimmed = content.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim()

    return trimmed.startsWith('WEBVTT')
      ? trimmed
      : `WEBVTT\n\n${trimmed}`
  }

  private async buildClient (): Promise<TwelveLabsClient> {
    const apiKey = process.env.TWELVELABS_API_KEY
    if (!apiKey) {
      throw new Error('The "twelvelabs" transcription engine requires the TWELVELABS_API_KEY environment variable to be set.')
    }

    // Lazy import so PeerTube does not need the optional dependency unless this engine is used
    const { TwelveLabs } = await import('twelvelabs-js')

    return new TwelveLabs({ apiKey }) as unknown as TwelveLabsClient
  }
}

// Minimal structural type of the parts of the TwelveLabs SDK we use, so the optional dependency
// does not have to be resolved at type-check time.
interface TwelveLabsClient {
  multipartUpload: {
    uploadFile (filePath: string, options?: { fileType?: string }): Promise<{ assetId: string }>
  }
  analyzeAsync: {
    tasks: {
      create (request: {
        modelName: string
        video: { type: 'asset_id', assetId: string }
        prompt: string
        temperature?: number
      }): Promise<{ taskId: string }>
      retrieve (taskId: string): Promise<{
        status: string
        result?: { data?: string }
        error?: { message?: string }
      }>
    }
  }
}
