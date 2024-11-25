/* eslint-disable @typescript-eslint/no-unused-expressions, max-len */
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  OpenaiTranscriber,
  TranscriptFile,
  TranscriptionModel,
  WhisperBuiltinModel
} from '@peertube/peertube-transcription'
import { TranscriptFileEvaluator, levenshteinDistance } from '@peertube/peertube-transcription-devtools'
import { createConsoleLogger } from '@tests/shared/common.js'
import { downloadCustomModelsIfNeeded, getCustomModelPath } from '@tests/shared/transcription.js'
import { config, expect } from 'chai'
import { ensureDir, remove } from 'fs-extra/esm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

config.truncateThreshold = 0

describe('Open AI Whisper transcriber', function () {
  const tmpDirectory = join(tmpdir(), 'peertube-transcription')
  const transcriptDirectory = join(tmpDirectory, 'transcriber', 'openai')

  const shortVideoPath = buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/videos/derive_sectaire.mp4')

  const referenceTranscriptFile = new TranscriptFile({
    path: buildAbsoluteFixturePath('transcription/videos/derive_sectaire.txt'),
    language: 'fr',
    format: 'txt'
  })

  const transcriber = new OpenaiTranscriber({
    engine: {
      name: 'openai-whisper',
      type: 'binary',
      command: 'whisper',
      supportedModelFormats: [ 'PyTorch' ],
      languageDetection: true,
      version: ''
    },
    logger: createConsoleLogger()
  })
  const model = new TranscriptionModel('tiny')

  before(async function () {
    this.timeout(120000)

    await ensureDir(transcriptDirectory)

    await downloadCustomModelsIfNeeded('tiny.pt')
  })

  it('Should transcribe a media file and provide a valid path to a transcript file in `vtt` format', async function () {
    this.timeout(3 * 1000 * 60)

    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'vtt', model, transcriptDirectory })

    expect(transcript.format).to.equals('vtt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May produce a transcript file in the `srt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'srt', model, transcriptDirectory })

    expect(transcript.format).to.equals('srt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May produce a transcript file in the `txt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'txt', model, transcriptDirectory })

    expect(transcript.format).to.equals('txt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
    expect(levenshteinDistance(
      (await transcript.read()).toString(),
      'December 1965, is that all it has been since I inherited the world only three years, seems like a hundred million.'
    )).to.be.below(3)
  })

  it('May transcribe a media file using a local PyTorch model', async function () {
    this.timeout(2 * 1000 * 60)

    await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      model: await TranscriptionModel.fromPath(getCustomModelPath('tiny.pt')),
      language: 'en',
      format: 'vtt',
      transcriptDirectory
    })
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(5 * 1000 * 60)

    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath, language: 'fr', format: 'txt', model, transcriptDirectory })

    expect(transcript.format).to.equals('txt')
    expect(transcript.language).to.equals('fr')
    expect(await transcript.read()).not.to.be.empty
  })

  it('Guesses the video language if not provided', async function () {
    this.timeout(3 * 1000 * 60)

    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath, model, format: 'vtt', transcriptDirectory })

    expect(transcript.language).to.equals('fr')
  })

  it('May transcribe a media file in french with small model (can be long)', async function () {
    this.timeout(6 * 1000 * 60)

    const transcript = await transcriber.transcribe({
      mediaFilePath: frVideoPath,
      language: 'fr',
      format: 'txt',
      model: new WhisperBuiltinModel('small'),
      transcriptDirectory
    })

    expect(transcript.language).to.equals('fr')

    const transcriptFileEvaluator = new TranscriptFileEvaluator(referenceTranscriptFile, transcript)
    const cer = await transcriptFileEvaluator.cer()
    expect(cer).to.be.below(6 / 100)
  })

  after(async function () {
    await remove(transcriptDirectory)
  })
})
