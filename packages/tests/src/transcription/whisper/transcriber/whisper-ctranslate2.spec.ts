/* eslint-disable @typescript-eslint/no-unused-expressions, max-len */
import { expect, config } from 'chai'
import { createLogger } from 'winston'
import { join } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  Ctranslate2Transcriber, downloadFile,
  levenshteinDistance,
  OpenaiTranscriber,
  TranscriptFile,
  TranscriptFileEvaluator,
  TranscriptionModel, unzip,
  WhisperTranscribeArgs
} from '@peertube/peertube-transcription'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'

config.truncateThreshold = 0

describe('Whisper CTranslate2 transcriber', function () {
  const tmpDirectory = join(tmpdir(), 'peertube-transcription')
  const transcriptDirectory = join(tmpDirectory, 'transcriber', 'ctranslate2')
  const modelsDirectory = join(tmpDirectory, 'models')
  const shortVideoPath = buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/videos/derive_sectaire.mp4')
  const transcriber = new Ctranslate2Transcriber(
    {
      name: 'anyNameShouldBeFineReally',
      requirements: [],
      type: 'binary',
      binary: 'whisper-ctranslate2',
      supportedModelFormats: [],
      languageDetection: true
    },
    createLogger(),
    transcriptDirectory
  )

  before(async function () {
    this.timeout(1 * 1000 * 60)
    await mkdir(transcriptDirectory, { recursive: true })
    await unzip(await downloadFile(FIXTURE_URLS.transcriptionModels, tmpDirectory))
  })

  it('Should transcribe a media file and provide a valid path to a transcript file in `vtt` format by default', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en' })

    expect(transcript.format).to.equals('vtt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May produce a transcript file in the `srt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'srt' })

    expect(transcript.format).to.equals('srt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May produce a transcript file in the `txt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'txt' })
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
    )).to.be.below(5)
  })

  it('May transcribe a media file using a local CTranslate2 model', async function () {
    this.timeout(2 * 1000 * 60)
    const transcript = await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      model: await TranscriptionModel.fromPath(join(modelsDirectory, 'faster-whisper-tiny')),
      language: 'en',
      format: 'txt'
    })

    expect(transcript.format).to.equals('txt')
    expect(transcript.language).to.equals('en')
    expect(await transcript.read()).not.to.be.empty
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(5 * 1000 * 60)
    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath, language: 'fr', format: 'txt' })

    expect(transcript.format).to.equals('txt')
    expect(transcript.language).to.equals('fr')
    expect(await transcript.read()).not.to.be.empty
  })

  it('Guesses the video language if not provided', async function () {
    this.timeout(2 * 1000 * 60)
    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath })
    expect(transcript.language).to.equals('fr')
  })

  it('Should produce a text transcript similar to openai-whisper implementation', async function () {
    this.timeout(5 * 1000 * 60)
    const transcribeArgs: WhisperTranscribeArgs = {
      mediaFilePath: frVideoPath,
      language: 'fr',
      format: 'txt'
    }
    const transcript = await transcriber.transcribe(transcribeArgs)
    const openaiTranscriber = new OpenaiTranscriber(
      {
        name: 'openai-whisper',
        requirements: [],
        type: 'binary',
        binary: 'whisper',
        supportedModelFormats: [ 'PyTorch' ]
      },
      createLogger(),
      join(transcriptDirectory, 'openai-whisper')
    )
    const openaiTranscript = await openaiTranscriber.transcribe(transcribeArgs)

    const transcriptFileEvaluator = new TranscriptFileEvaluator(openaiTranscript, transcript)
    expect(await transcriptFileEvaluator.wer()).to.be.below(20 / 100)
    expect(await transcriptFileEvaluator.cer()).to.be.below(10 / 100)
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
  })
})
