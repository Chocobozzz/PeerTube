/* eslint-disable @typescript-eslint/no-unused-expressions, no-new, max-len */
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { TranscriptFile } from '@peertube/peertube-transcription'
import { TranscriptFileEvaluator } from '@peertube/peertube-transcription-devtools'
import { expect } from 'chai'
import { ensureDir, remove } from 'fs-extra/esm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('Transcript File Evaluator', function () {
  const transcriptDirectory = join(tmpdir(), 'peertube-transcription', 'transcript-file-evaluator')
  const referenceTranscriptFilePath = buildAbsoluteFixturePath('transcription/videos/communiquer-lors-dune-classe-transplantee.txt')

  before(async function () {
    await ensureDir(transcriptDirectory)
  })

  it(`may not compare files in another format than txt`, async function () {
    const vttReference = await TranscriptFile.write({
      path: join(transcriptDirectory, 'reference.vtt'),
      format: 'vtt',
      content: ''
    })
    const vttHypothesis = await TranscriptFile.write({
      path: join(transcriptDirectory, 'hypothesis.vtt'),
      format: 'vtt',
      content: ''
    })
    expect(() => new TranscriptFileEvaluator(vttReference, vttHypothesis)).to.throw('Can only evaluate txt transcript file')
  })

  it(`evaluation must return coherent wer & cer`, async function () {
    const reference = new TranscriptFile({
      path: referenceTranscriptFilePath,
      language: 'fr',
      format: 'txt'
    })
    const hypothesis = await TranscriptFile.write({
      path: join(transcriptDirectory, 'openai.txt'),
      content: `Communiquez lors d'une classe transplante. Utilisez les photos prises lors de cette classe pour raconter quotidiennement le séjour vécu.
C'est le scénario P-Dagujic présenté par monsieur Navoli, professeur ainsi que le 3 sur une école alimentaire de Montpellier.
La première application a utilisé ce ralame déatec. L'enseignant va alors transférer les différentes photos réalisés lors de la classe transplante.
Dans un dossier, spécifique pour que les élèves puissent le retrouver plus facilement. Il téléverse donc ses photos dans le dossier, dans le venté, dans la médiatèque de la classe.
Pour terminer, il s'assure que le dossier soit bien ouvert aux utilisateurs afin que tout le monde puisse l'utiliser.
Les élèves par la suite utilisera le blog. A partir de leurs nantes, il pourront se loi de parposte rédigeant un article d'un reinté.
Ils illustront ses articles à l'aide des photos de que mon numérique mise à n'accélier dans le venté.
Pour se faire, il pourront utiliser les diteurs avancés qui les renvèrent directement dans la médiatèque de la classe où il pourront retrouver le dossier créé par leurs enseignants.
Une fois leur article terminée, les élèves soumétront se lui-ci au professeur qui pourra soit la noté pour correction ou le public.
Ensuite, il pourront lire et commenter ce de leurs camarades ou répondre aux commentaires de la veille.
`,
      format: 'txt',
      language: 'fr'
    })
    const evaluator = new TranscriptFileEvaluator(reference, hypothesis)
    const wer = await evaluator.wer()
    expect(wer).to.be.greaterThan(0 / 100)
    expect(wer).to.be.below(30 / 100)

    const cer = await evaluator.cer()
    expect(cer).to.be.greaterThan(9 / 100)
    expect(cer).to.be.below(10 / 100)
    console.log(await evaluator.alignment())
  })

  after(async function () {
    await remove(transcriptDirectory)
  })
})
