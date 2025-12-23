/* eslint-disable @typescript-eslint/no-unused-expressions, max-len */
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  Ctranslate2Transcriber,
  OpenaiTranscriber,
  TranscriptFile,
  TranscriptionModel
} from '@peertube/peertube-transcription'
import { TranscriptFileEvaluator, levenshteinDistance } from '@peertube/peertube-transcription-devtools'
import { createConsoleLogger } from '@tests/shared/common.js'
import { downloadCustomModelsIfNeeded, getCustomModelPath } from '@tests/shared/transcription.js'
import { config, expect } from 'chai'
import { ensureDir, remove } from 'fs-extra/esm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

config.truncateThreshold = 0

describe('Whisper CTranslate2 transcriber', function () {
  const tmpDirectory = join(tmpdir(), 'peertube-transcription')
  const transcriptDirectory = join(tmpDirectory, 'transcriber', 'ctranslate2')

  const shortVideoPath = buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/videos/derive_sectaire.mp4')

  const transcriber = new Ctranslate2Transcriber({
    engine: {
      name: 'whisper-ctranslate2',
      type: 'binary',
      command: 'whisper-ctranslate2',
      supportedModelFormats: [ 'CTranslate2' ],
      languageDetection: true,
      version: '0.4.4'
    },
    logger: createConsoleLogger()
  })

  const model = new TranscriptionModel('tiny')

  before(async function () {
    this.timeout(120000)

    await ensureDir(transcriptDirectory)

    await downloadCustomModelsIfNeeded('faster-whisper-tiny')
  })

  it('Should transcribe a media file and provide a valid path to a transcript file in `vtt` format', async function () {
    const transcript = await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      language: 'en',
      format: 'vtt',
      model,
      transcriptDirectory
    })

    expect(transcript.format).to.equals('vtt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May produce a transcript file in the `srt` format', async function () {
    const transcript = await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      language: 'en',
      format: 'srt',
      model,
      transcriptDirectory
    })

    expect(transcript.format).to.equals('srt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May produce a transcript file in the `txt` format', async function () {
    const transcript = await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      language: 'en',
      format: 'txt',
      model,
      transcriptDirectory
    })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'the_last_man_on_earth.txt'),
      format: 'txt',
      language: 'en'
    }))).to.be.true

    expect(transcript.format).to.equals('txt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
    expect(levenshteinDistance(
      (await transcript.read()).toString(),
      'December 1965, is that all it has been since I inherited the world only three years, seems like a hundred million.'
    )).to.be.below(6)
  })

  it('May transcribe a media file using a local CTranslate2 model', async function () {
    this.timeout(2 * 1000 * 60)

    const transcript = await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      model: await TranscriptionModel.fromPath(getCustomModelPath('faster-whisper-tiny')),
      language: 'en',
      transcriptDirectory,
      format: 'txt'
    })

    expect(transcript.format).to.equals('txt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(5 * 1000 * 60)

    const transcript = await transcriber.transcribe({
      mediaFilePath: frVideoPath,
      language: 'fr',
      format: 'txt',
      model,
      transcriptDirectory
    })

    expect(transcript.format).to.equals('txt')
    expect(transcript.language).to.equals('fr')
    expect(await transcript.read()).not.to.be.empty
  })

  it('Guesses the video language if not provided', async function () {
    this.timeout(2 * 1000 * 60)

    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath, format: 'vtt', model, transcriptDirectory })
    expect(transcript.language).to.equals('fr')
  })

  it('Should produce a text transcript similar to openai-whisper implementation', async function () {
    this.timeout(10 * 1000 * 60)

    const transcribeArgs = {
      mediaFilePath: frVideoPath,
      language: 'fr',
      format: 'txt' as 'txt',
      transcriptDirectory,
      model
    }

    const transcript = await transcriber.transcribe(transcribeArgs)

    const openaiTranscriber = new OpenaiTranscriber({
      engine: {
        name: 'openai-whisper',
        type: 'binary',
        command: 'whisper',
        supportedModelFormats: [ 'PyTorch' ],
        version: '0.4.4'
      },
      logger: createConsoleLogger()
    })
    const openaiTranscript = await openaiTranscriber.transcribe({
      ...transcribeArgs,

      transcriptDirectory: join(transcriptDirectory, 'openai-whisper')
    })

    const transcriptFileEvaluator = new TranscriptFileEvaluator(openaiTranscript, transcript)
    expect(await transcriptFileEvaluator.wer()).to.be.below(25 / 100)
    expect(await transcriptFileEvaluator.cer()).to.be.below(10 / 100)
  })

  after(async function () {
    await remove(transcriptDirectory)
  })
})
