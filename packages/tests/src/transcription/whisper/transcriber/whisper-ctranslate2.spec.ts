/* eslint-disable @typescript-eslint/no-unused-expressions, max-len */
import { expect, config } from 'chai'
import { createLogger } from 'winston'
import { join } from 'path'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import {
  Ctranslate2Transcriber,
  OpenaiTranscriber,
  TranscriptFile,
  TranscriptFileEvaluator,
  TranscriptionModel, WhisperTranscribeArgs
} from '@peertube/peertube-transcription'

config.truncateThreshold = 0

describe('Whisper CTranslate2 transcriber', function () {
  const transcriptDirectory = join(root(), 'test-transcript')
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
    await mkdir(transcriptDirectory, { recursive: true })
  })

  it('Should transcribe a media file and provide a valid path to a transcript file in `vtt` format by default', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en' })
    expect(await transcript.equals(new TranscriptFile({ path: join(transcriptDirectory, 'the_last_man_on_earth.vtt'), language: 'en' }))).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `WEBVTT

00:00.000 --> 00:12.000
December 1965, is that all it has been since I inherited the world only three years, seems like a hundred million.

`
    )
  })

  it('May produce a transcript file in the `srt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'srt' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'the_last_man_on_earth.srt'),
      format: 'srt',
      language: 'en'
    }))).to.be.true

    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `1
00:00:00,000 --> 00:00:12,000
December 1965, is that all it has been since I inherited the world only three years, seems like a hundred million.

`
    )
  })

  it('May produce a transcript file in the `txt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'txt' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'the_last_man_on_earth.txt'),
      format: 'txt',
      language: 'en'
    }))).to.be.true

    expect(await transcript.read()).to.equal(`December 1965, is that all it has been since I inherited the world only three years, seems like a hundred million.
`)
  })

  it('May transcribe a media file using a local CTranslate2 model', async function () {
    this.timeout(2 * 1000 * 60)
    const transcript = await transcriber.transcribe({
      mediaFilePath: shortVideoPath,
      model: TranscriptionModel.fromPath(buildAbsoluteFixturePath('transcription/models/faster-whisper-tiny')),
      language: 'en',
      format: 'txt'
    })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'the_last_man_on_earth.txt'),
      format: 'txt',
      language: 'en'
    }))).to.be.true

    expect(await transcript.read()).to.equal(`December 1965, is that all it has been since I inherited the world only three years, seems like a hundred million.
`)
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(5 * 1000 * 60)
    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath, language: 'fr', format: 'txt' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'derive_sectaire.txt'),
      language: 'fr',
      format: 'txt'
    }))).to.be.true

    expect(await transcript.read()).to.equal(
      `Bonjour et bienvenue sur FunMook.
Notre Mook, comment on parlait à une victime d'emprisementale aux de Dérisectaires,
s'adresse à tout professionnel du domaine de la santé, de la sociétif, du juridique
qui pourrait être en contact avec une victime de telles dériffes.
Il sera composé de 14 leçons vidéo d'une dizaine de minutes,
divisé en quatre blocs.
Le premier bloc, vous informera de ce qui est exactement l'emprisementale et une
dériffe sectaire.
Ça consiste toujours à une forme de manipulation et qui conduit à une dépendance
à une sorte de séalvition, le personne ne part bien pas, à se désengager d'un processus
qu'il est conduit soit à donner de l'argent ou à se livrer à des actes
quand réelité n'aurait pas accepté, ou tout simplement à accepter de participer
une organisation dont il ne partage pas toutes les méthodes ou tous les points de vue.
Le deuxième bloc, vous informera des bonnes techniques d'écoute d'une personne et
y'en vécue de telles traumatismes.
C'est un sujet actuel parce que ce phénomène est en croissance.
Il y a une augmentation très importante, un doublement, en l'espace de quelques années,
devant moins de 10 ans.
Le bloc 3, lui, sera conçu par nos juristes.
Pour vous indiquer quelles sont les grandes infractions en lien avec l'emprisementale et surtout
de pouvoir faire une analyse perspicace d'une situation individuelle.
Enfin, le bloc 4, vous assistera à savoir comment éduyer une victime vers les bons
professionnels.
Bonne formation.
`
    )
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
      model: TranscriptionModel.fromPath(buildAbsoluteFixturePath('transcription/models/tiny.pt')),
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
