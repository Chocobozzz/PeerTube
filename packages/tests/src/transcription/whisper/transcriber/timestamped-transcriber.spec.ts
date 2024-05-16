/* eslint-disable @typescript-eslint/no-unused-expressions, max-len */
import { expect, config } from 'chai'
import { createLogger } from 'winston'
import { join } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  OpenaiTranscriber,
  WhisperTimestampedTranscriber,
  TranscriptFile,
  TranscriptFileEvaluator,
  TranscriptionModel,
  WhisperTranscribeArgs,
  WhisperBuiltinModel
} from '@peertube/peertube-transcription'

config.truncateThreshold = 0

describe('Linto timestamped Whisper transcriber', function () {
  const transcriptDirectory = join(tmpdir(), 'peertube-transcription/transcriber')
  const shortVideoPath = buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/videos/derive_sectaire.mp4')
  const transcriber = new WhisperTimestampedTranscriber(
    {
      name: 'whisper-timestamped',
      requirements: [],
      type: 'binary',
      binary: 'whisper_timestamped',
      supportedModelFormats: [ 'PyTorch' ],
      languageDetection: true
    },
    createLogger(),
    transcriptDirectory
  )

  before(async function () {
    await mkdir(transcriptDirectory, { recursive: true })
  })

  it('Should transcribe a media file and produce a transcript file in `vtt` with a ms precision', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'the_last_man_on_earth.vtt'),
      language: 'en',
      format: 'vtt'
    }))).to.be.true

    expect(await transcript.read()).to.equals(
      `WEBVTT

00:00.460 --> 00:02.080
December 1965.

00:03.700 --> 00:08.800
Is that all it has been since I inherited the world only three years?

00:10.420 --> 00:11.900
Seems like a hundred million.

`
    )
  })

  it('May produce a transcript file in the `srt` format with a ms precision', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'srt' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'the_last_man_on_earth.srt'),
      language: 'en',
      format: 'srt'
    }))).to.be.true

    expect(await transcript.read()).to.equals(
      `1
00:00:00,460 --> 00:00:02,080
December 1965.

2
00:00:03,700 --> 00:00:08,800
Is that all it has been since I inherited the world only three years?

3
00:00:10,420 --> 00:00:11,900
Seems like a hundred million.

`
    )
  })

  it('May produce a transcript file in `txt` format', async function () {
    const transcript = await transcriber.transcribe({ mediaFilePath: shortVideoPath, language: 'en', format: 'txt' })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'the_last_man_on_earth.txt'),
      language: 'en',
      format: 'txt'
    }))).to.be.true

    expect(await transcript.read()).to.equals(`December 1965.
Is that all it has been since I inherited the world only three years?
Seems like a hundred million.
`)
  })

  it('May transcribe a media file using a local PyTorch model file', async function () {
    this.timeout(2 * 1000 * 60)
    await transcriber.transcribe({ mediaFilePath: frVideoPath, model: TranscriptionModel.fromPath(buildAbsoluteFixturePath('transcription/models/tiny.pt')), language: 'en' })
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(2 * 1000 * 60)
    const transcript = await transcriber.transcribe({
      mediaFilePath: frVideoPath,
      language: 'fr',
      format: 'txt',
      model: new WhisperBuiltinModel('tiny')
    })
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'derive_sectaire.txt'),
      language: 'fr',
      format: 'txt'
    }))).to.be.true

    expect(await transcript.read()).to.equal(
      `Bonjour et bienvenue sur Fennmook. Notre Mouk comment on parle à une victime d'emprissement
à l'autre dérisse hectare, s'adraîche à tout professionnel du domaine de la santé
de la sociatif du juridique qui pourrait être en contact avec une victime de telles
dérives. Il sera composé de 14 leçons vidéo d'une dizaine de minutes,
divisée en quatre blocs. Le premier bloc vous informera de ce qui est exactement l'emprisemental
et une dérisse hectaire. Ça consiste toujours à une forme de manipulation et qui conduit
à une dépendance, à une sorte de séalvision, le personne ne parle à ce désengagé
d'un processus qui les conduit soit à donner de l'argent ou à ce livret à des actes
quand il était une aurait pas acceptée, ou tout simplement à accéter de participer
une organisation dont il ne partage pas toutes les méthodes ou tous les points de vue.
Le deuxième bloc vous informera des bonnes techniques d'écoute d'une personne et
y en vécu de telles traumatismes. C'est un sujet actuel parce que ce phénomène est en croissance.
Il y a une augmentation très importante, un doublement, on les espace de quelques années,
de moins de 10 ans.
Le bloc 3, lui, sera conçu par nos juristes. Pour vous indiquer qu'elles sont les grandes
infractions en lien avec l'emprisemental et surtout de pouvoir faire une analyse perspicace
d'une situation individuelle.
Enfin, le bloc 4, vous assistera à savoir comment éduyer une victime vers les bons
professionnels. Bonne formation.
`)
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
    expect(await transcriptFileEvaluator.wer()).to.be.below(25 / 100)
    expect(await transcriptFileEvaluator.cer()).to.be.below(15 / 100)
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
  })
})
