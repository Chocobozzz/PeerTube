import { createLogger } from 'winston'
import { join } from 'path'
import { expect, config } from 'chai'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import { OpenaiTranscriber, WhisperTimestampedTranscriber } from '@peertube/peertube-transcription'

config.truncateThreshold = 0

describe('Linto timestamped Whisper transcriber', function () {
  const transcriptDirectory = join(root(), 'test-transcript')
  const shortVideoPath = buildAbsoluteFixturePath('video_short.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/communiquer-lors-dune-classe-transplantee.mp4')
  const transcriber = new WhisperTimestampedTranscriber(
    {
      name: 'whisper-timestamped',
      requirements: [],
      type: 'binary',
      binary: 'whisper_timestamped',
      supportedModelFormats: [ 'PyTorch' ]
    },
    createLogger(),
    transcriptDirectory
  )

  before(async function () {
    await mkdir(transcriptDirectory, { recursive: true })
  })

  it('Should transcribe a media file and produce transcript file in th `vtt` format by default', async function () {
    const transcript = await transcriber.transcribe(
      shortVideoPath,
      { name: 'tiny' },
      'fr',
      'vtt'
    )

    expect(transcript).to.deep.equals({
      path: join(transcriptDirectory, 'video_short.vtt'),
      language: 'fr',
      format: 'vtt'
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true

    // Whisper timestamped should produce a transcript with micro seconds precisions.
    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `WEBVTT

00:02.480 --> 00:02.500
you

`
    )
  })

  it('May produce a transcript file in the `srt` format', async function () {
    const transcript = await transcriber.transcribe(shortVideoPath, { name: 'tiny' }, 'en', 'srt')
    expect(transcript).to.deep.equals({
      path: join(transcriptDirectory, 'video_short.srt'),
      language: 'en',
      format: 'srt'
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `1
00:00:02,480 --> 00:00:02,500
you

`
    )
  })

  it('May produce a transcript file in `txt` format', async function () {
    const transcript = await transcriber.transcribe(shortVideoPath, { name: 'tiny' }, 'en', 'txt')
    expect(transcript).to.deep.equals({
      path: join(transcriptDirectory, 'video_short.txt'),
      language: 'en',
      format: 'txt'
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(`you
`)
  })

  it('May transcribe a media file in french', async function () {
    this.timeout(45000)
    const transcript = await transcriber.transcribe(frVideoPath, { name: 'tiny' }, 'fr', 'txt')
    expect(transcript).to.deep.equals({
      path: join(transcriptDirectory, 'communiquer-lors-dune-classe-transplantee.txt'),
      language: 'fr',
      format: 'txt'
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `...
Communiquez lors du ne class et transplanté.
Utilisez les photos prises lors de cette classe pour raconter quotidiennement le seuil jour vécu.
C'est le scénario P.D. à Goujit présenté par M.I.N.A.Voli,
professeur en cycle 3 sur une école émenteur de Montpellier.
La première application a utilisé ce ralame de Yatek.
L'enseignant va alors transférer les différentes photos réalisés lors de la classe transplantée dans un dossier,
spécifique pour que les élèves puissent le retrouver plus facilement.
Il t'éleverce donc ses photos dans le dossier, dans le venté, dans la médiatèque de la classe.
Pour terminer, il s'assure que le dossier soit bien ouvert aux utilisateurs afin que tout le monde puisse l'utiliser.
Les élèves par la suite utiliseront le blog.
À partir de leur note, il pourront se loi de par poste rédigène article dans le reinté.
Ils illustront ses articles à l'aide des photos de commun numérique mise à n'accélier dans la même thé.
Pour se faire, il pourront utiliser les dites ravences qui les renvèrent directement dans la médiatèque de la classe,
où ils pourront retrouver le dossier créé par leur enseignon.
Une fois leur article terminée, les élèves soumétront se lui-ci au professeur,
qui pourra soit la noter pour correction ou le public.
Ensuite, il pourront lire et commenter ce de leur camarade, ou répondre au commentaire de la veille.
`
    )
  })

  it('Should produce the same transcript text as openai-whisper given the same parameters', async function () {
    const transcribeParameters: Parameters<typeof transcriber.transcribe> = [
      shortVideoPath,
      { name: 'tiny' },
      'en',
      'txt'
    ]

    const transcript = await transcriber.transcribe(...transcribeParameters)

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
    const openaiTranscript = await openaiTranscriber.transcribe(...transcribeParameters)

    expect(await readFile(transcript.path, 'utf8')).to.equal(await readFile(openaiTranscript.path, 'utf8'))
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
  })
})
