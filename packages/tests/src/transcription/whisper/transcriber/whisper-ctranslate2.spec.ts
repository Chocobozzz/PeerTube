import { createLogger } from 'winston'
import { join } from 'path'
import { expect, config } from 'chai'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import { Ctranslate2Transcriber, OpenaiTranscriber } from '@peertube/peertube-transcription'

config.truncateThreshold = 0

describe('Whisper CTranslate2 transcriber', function () {
  const transcriptDirectory = join(root(), 'test-transcript')
  const shortVideoPath = buildAbsoluteFixturePath('video_short.mp4')
  const frVideoPath = buildAbsoluteFixturePath('transcription/communiquer-lors-dune-classe-transplantee.mp4')
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
    expect(transcript).to.deep.equals({
      path: join(transcriptDirectory, 'video_short.vtt'),
      language: 'en',
      format: 'vtt'
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(
      `WEBVTT

00:00.000 --> 00:02.000
You

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
00:00:00,000 --> 00:00:02,000
You

`
    )
  })

  it('May produce a transcript file in the `txt` format', async function () {
    const transcript = await transcriber.transcribe(shortVideoPath, { name: 'tiny' }, 'en', 'txt')
    expect(transcript).to.deep.equals({
      path: join(transcriptDirectory, 'video_short.txt'),
      language: 'en',
      format: 'txt'
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(`You
`)
  })

  it('May transcribe a media file using a local CTranslate2 model', async function () {
    const transcript = await transcriber.transcribe(
      shortVideoPath,
      { name: 'myLocalModel', path: buildAbsoluteFixturePath('transcription/tiny-ctranslate2.bin') },
      'en',
      'txt'
    )
    expect(transcript).to.deep.equals({
      path: join(transcriptDirectory, 'video_short.txt'),
      language: 'en',
      format: 'txt'
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(`You
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
      `Communiquez lors d'une classe transplante. Utilisez les photos prises lors de cette classe pour raconter quotidiennement le séjour vécu.
C'est le scénario P-Dagujic présenté par monsieur Navoli, professeur ainsi que le 3 sur une école alimentaire de Montpellier.
La première application a utilisé ce ralame déatec. L'enseignant va alors transférer les différentes photos réalisés lors de la classe transplante.
Dans un dossier, spécifique pour que les élèves puissent le retrouver plus facilement. Il téléverse donc ses photos dans le dossier, dans le venté, dans la médiatèque de la classe.
Pour terminer, il s'assure que le dossier soit bien ouvert aux utilisateurs afin que tout le monde puisse l'utiliser.
Les élèves par la suite utilisera le blog. A partir de leurs nantes, il pourront se loi de parposte rédigeant un article d'un reinté.
Ils illustront ses articles à l'aide des photos de que mon numérique mise à n'accélier dans le venté.
Pour se faire, il pourront utiliser les diteurs avancés qui les renvèrent directement dans la médiatèque de la classe où il pourront retrouver le dossier créé par leurs enseignants.
Une fois leur article terminée, les élèves soumétront se lui-ci au professeur qui pourra soit la noté pour correction ou le public.
Ensuite, il pourront lire et commenter ce de leurs camarades ou répondre aux commentaires de la veille.
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

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(existsSync(transcript.path), `Transcript file ${transcript.path} doesn't exist.`).to.be.true
    expect(await readFile(transcript.path, 'utf8')).to.equal(await readFile(openaiTranscript.path, 'utf8'))
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
  })
})
