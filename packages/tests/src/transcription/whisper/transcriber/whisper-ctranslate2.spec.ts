/* eslint-disable @typescript-eslint/no-unused-expressions, max-len */
import { expect, config } from 'chai'
import { createLogger } from 'winston'
import { join } from 'path'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import { Ctranslate2Transcriber, OpenaiTranscriber, TranscriptFile } from '@peertube/peertube-transcription'

config.truncateThreshold = 0

describe('Whisper CTranslate2 transcriber', function () {
  const transcriptDirectory = join(root(), 'test-transcript')
  const shortVideoPath = buildAbsoluteFixturePath('video_short.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/videos/communiquer-lors-dune-classe-transplantee.mp4')
  const transcriber = new Ctranslate2Transcriber(
    {
      name: 'anyNameShouldBeFineReally',
      requirements: [],
      type: 'binary',
      binary: 'whisper-ctranslate2',
      supportedModelFormats: []
    },
    createLogger(),
    transcriptDirectory
  )

  before(async function () {
    await mkdir(transcriptDirectory, { recursive: true })
  })

  it('Should transcribe a media file and provide a valid path to a transcript file in `vtt` format by default', async function () {
    const transcript = await transcriber.transcribe(shortVideoPath, { name: 'tiny' })
    expect(await transcript.equals(new TranscriptFile({ path: join(transcriptDirectory, 'video_short.vtt') }))).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `WEBVTT

00:00.000 --> 00:02.000
You

`
    )
  })

  it('May produce a transcript file in the `srt` format', async function () {
    const transcript = await transcriber.transcribe(shortVideoPath, { name: 'tiny' }, 'en', 'srt')
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'video_short.srt'),
      format: 'srt'
    }))).to.be.true

    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `1
00:00:00,000 --> 00:00:02,000
You

`
    )
  })

  it('May produce a transcript file in the `txt` format', async function () {
    const transcript = await transcriber.transcribe(shortVideoPath, { name: 'tiny' }, 'en', 'txt')
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'video_short.txt'),
      format: 'txt'
    }))).to.be.true

    expect(await transcript.read()).to.equal(`You
`)
  })

  it('May transcribe a media file using a local CTranslate2 model', async function () {
    const transcript = await transcriber.transcribe(
      shortVideoPath,
      { name: 'myLocalModel', path: buildAbsoluteFixturePath('transcription/models/faster-whisper-tiny') },
      'en',
      'txt'
    )
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'video_short.txt'),
      format: 'txt'
    }))).to.be.true

    expect(await transcript.read()).to.equal(`You
`)
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(45000)
    const transcript = await transcriber.transcribe(frVideoPath, { name: 'tiny' }, 'fr', 'txt')
    expect(await transcript.equals(new TranscriptFile({
      path: join(transcriptDirectory, 'communiquer-lors-dune-classe-transplantee.txt'),
      language: 'fr',
      format: 'txt'
    }))).to.be.true

    expect(await transcript.read()).to.equal(
      `Communiquez lors d'une classe transplante. Utilisez les photos prises lors de cette classe pour raconter quotidiennement le séjour vécu.
C'est le scénario P.Dagujic présenté par Monsieur Navoli, professeur ainsi que le 3 sur une école alimentaire de Montpellier.
La première application utilisée sera la médiatique. L'enseignant va alors transférer les différentes photos réalisés lors de la classe transplante.
Dans un dossier, spécifique pour que les élèves puissent le retrouver plus facilement. Il téléverse donc ses photos dans le dossier, dans le venté, dans la médiatique de la classe.
Pour terminer, il s'assure que le dossier soit bien ouvert aux utilisateurs afin que tout le monde puisse l'utiliser.
Les élèves par la suite utiliseront le blog, à partir de leur nante, il pourront se loi de parposte rédigeant un article d'un orienté.
Ils illustront ces articles à l'aide des photos de commun numériques mises un accès libre dans leaineté. Pour se faire, il pourront utiliser les détecteurs avancés qui des renvers un directement dans la médiatique de la classe, où il pourront retrouver le dossier créé par leur enseignant.
Une fois leur article terminée, les élèves soumettront celui-ci au professeur qui pourra soit la noté pour correction ou le public.
Ensuite, il pourront lire et commenter ce de leur camarade, on répondra au commentaire de la veille.
`
    )
  })

  it('Should produce the same transcript text as openai-whisper given the same parameters', async function () {
    const transcribeArguments: Parameters<typeof transcriber.transcribe> = [
      shortVideoPath,
      { name: 'tiny' },
      'en',
      'txt'
    ]
    const transcript = await transcriber.transcribe(...transcribeArguments)
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
    const openaiTranscript = await openaiTranscriber.transcribe(...transcribeArguments)

    expect(await transcript.equals(openaiTranscript))
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
  })
})
