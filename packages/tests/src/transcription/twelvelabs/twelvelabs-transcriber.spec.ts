/* oxlint-disable @typescript-eslint/no-unused-expressions */
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { TranscriptFile, TranscriptionModel, TwelveLabsTranscriber } from '@peertube/peertube-transcription'
import { createConsoleLogger } from '@tests/shared/common.js'
import { expect } from 'chai'
import { ensureDir, remove } from 'fs-extra/esm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('TwelveLabs Pegasus transcriber', function () {
  const tmpDirectory = join(tmpdir(), 'peertube-transcription')
  const transcriptDirectory = join(tmpDirectory, 'transcriber', 'twelvelabs')
  const shortVideoPath = buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.mp4')

  const transcriber = new TwelveLabsTranscriber({
    engine: {
      name: 'twelvelabs',
      type: 'api',
      supportedModelFormats: [],
      languageDetection: true,
      version: 'pegasus1.5'
    },
    logger: createConsoleLogger()
  })

  before(async function () {
    await ensureDir(transcriptDirectory)
  })

  // No-network unit test: the engine must refuse the unsupported srt/txt formats
  it('Should reject unsupported transcript formats', async function () {
    let errored = false

    try {
      await transcriber.transcribe({
        mediaFilePath: shortVideoPath,
        model: new TranscriptionModel('pegasus1.5'),
        format: 'srt',
        transcriptDirectory
      })
    } catch (err) {
      errored = true
      expect(err.message).to.contain('vtt')
    }

    expect(errored).to.be.true
  })

  // No-network unit test: without an API key the engine must fail fast with a clear message
  it('Should require the TWELVELABS_API_KEY environment variable', async function () {
    const previous = process.env.TWELVELABS_API_KEY
    delete process.env.TWELVELABS_API_KEY

    let errored = false
    try {
      await transcriber.transcribe({
        mediaFilePath: shortVideoPath,
        model: new TranscriptionModel('pegasus1.5'),
        format: 'vtt',
        transcriptDirectory
      })
    } catch (err) {
      errored = true
      expect(err.message).to.contain('TWELVELABS_API_KEY')
    } finally {
      if (previous) process.env.TWELVELABS_API_KEY = previous
    }

    expect(errored).to.be.true
  })

  // Integration smoke test, only runs when a real API key is provided
  it('Should transcribe a video to WebVTT using Pegasus', async function () {
    if (!process.env.TWELVELABS_API_KEY) this.skip()

    this.timeout(10 * 60 * 1000)

    const transcript = await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      model: new TranscriptionModel('pegasus1.5'),
      format: 'vtt',
      transcriptDirectory,
      language: 'en'
    })

    expect(transcript).to.be.instanceOf(TranscriptFile)
    expect(transcript.format).to.equal('vtt')

    const content = String(await transcript.read())
    expect(content).to.contain('WEBVTT')
  })

  after(async function () {
    await remove(transcriptDirectory)
  })
})
