/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect, config } from 'chai'
import { createLogger } from 'winston'
import { join } from 'path'
import { mkdir, rm } from 'node:fs/promises'
import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import {
  OpenaiTranscriber,
  TranscriptFile,
  TranscriptFileEvaluator,
  TranscriptionModel,
  WhisperBuiltinModel
} from '@peertube/peertube-transcription'

config.truncateThreshold = 0

describe('Open AI Whisper transcriber', function () {
  const transcriptDirectory = join(root(), 'test-transcript')
  const shortVideoPath = buildAbsoluteFixturePath('video_short.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/videos/derive_sectaire.mp4')
  const referenceTranscriptFile = new TranscriptFile({
    path: buildAbsoluteFixturePath('transcription/videos/derive_sectaire.txt'),
    language: 'fr',
    format: 'txt'
  })
  const transcriber = new OpenaiTranscriber(
    {
      name: 'openai-whisper',
      requirements: [],
      type: 'binary',
      binary: 'whisper',
      supportedModelFormats: [ 'PyTorch' ],
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
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'video_short.vtt'),
      language: 'en',
      format: 'vtt'
    }))).to.be.true

    expect(await transcript.read()).to.equals(
      `WEBVTT

00:00.000 --> 00:02.000
You

`
    )
  })

  it('May produce a transcript file in the `srt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'srt' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'video_short.srt'),
      language: 'en',
      format: 'srt'
    }))).to.be.true

    expect(await transcript.read()).to.equal(
      `1
00:00:00,000 --> 00:00:02,000
You

`
    )
  })

  it('May produce a transcript file in the `txt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'txt' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'video_short.txt'),
      language: 'en',
      format: 'txt'
    }))).to.be.true

    expect(await transcript.read()).to.equal(`You
`)
  })

  it('May transcribe a media file using a local PyTorch model', async function () {
    this.timeout(3 * 1000 * 60)
    await transcriber.transcribe({
      mediaFilePath: frVideoPath,
      model: TranscriptionModel.fromPath(buildAbsoluteFixturePath('transcription/models/tiny.pt')),
      language: 'en'
    })
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(3 * 1000 * 60)
    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath, language: 'fr', format: 'txt' })
    expect(transcript.language).equals('fr')
    expect(await transcript.read()).to.equal(
      `Bonjour et bienvenue sur Fennmook. Notre Mouk comment on parlait à une victime d'emprisementale
au de Dérise hectare, s'adresse à tout professionnel du domaine de la santé, de la
sociatif, du juridique qui pourrait être en contact avec une victime de telles dériffes.
Il sera composé de 14 leçons vidéo d'une dizaine de minutes, divisé en quatre blocs.
Le premier bloc vous informera de ce qui est exactement l'emprisementale et une
dériffe sectaire. Ça consiste toujours à une forme de manipulation et qui conduit
à une dépendance, à une sorte de siècle vision, le personne ne parle à ce désengagé
d'un processus qui les conduit soit à donner de l'argent ou à ce livret à des actes
quand il était une oreille pas acceptée ou tout simplement à accéter de participer
une organisation dont il ne partage pas toutes les méthodes de tous les points de vue.
Le deuxième bloc vous informera des bonnes techniques d'écoute d'une personne et
y en vécu de telles traumatismes. C'est un sujet actuel parce que ce phénomène est
en croissance. Il y a une augmentation très importante, un double moment, on les se passe
de quelques années devant moins de 10 ans.
Le bloc trois, lui, sera conçu par nos juristes. Pour vous indiquer qu'elles sont
les grandes infractions en lien avec l'emprisementale et surtout de pouvoir faire
une analyse perspicace d'une situation individuelle. Enfin, le bloc quatre, vous
assistera à savoir comment éduyer une victime vers les bons professionnels.
Bonne formation.
`
    )
  })

  it('Guesses the video language if not provided', async function () {
    this.timeout(3 * 1000 * 60)
    const transcript = await transcriber.transcribe({ mediaFilePath: frVideoPath })
    expect(transcript.language).to.equals('fr')
  })

  it('May transcribe a media file in french with small model', async function () {
    this.timeout(6 * 1000 * 60)
    const transcript = await transcriber.transcribe({
      mediaFilePath: frVideoPath,
      language: 'fr',
      format: 'txt',
      model: new WhisperBuiltinModel('small')
    })

    const transcriptFileEvaluator = new TranscriptFileEvaluator(referenceTranscriptFile, transcript)
    const cer = await transcriptFileEvaluator.cer()
    console.log(cer)
    expect(cer).to.be.below(6 / 100)
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
  })
})
