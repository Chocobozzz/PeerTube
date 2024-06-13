/* eslint-disable max-len */
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { join } from 'path'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { expect } from 'chai'
import { JiwerClI } from '@peertube/peertube-transcription-devtools'

describe('Jiwer CLI', function () {
  const transcriptDirectory = buildAbsoluteFixturePath('transcription/transcript-evaluator')
  const referenceTranscriptFilePath = buildAbsoluteFixturePath('transcription/videos/communiquer-lors-dune-classe-transplantee.txt')
  const hypothesis = join(transcriptDirectory, 'openai.txt')
  const jiwerCLI = new JiwerClI(referenceTranscriptFilePath, hypothesis)

  before(async function () {
    await mkdir(transcriptDirectory, { recursive: true })
    await writeFile(join(transcriptDirectory, 'openai.txt'), `Communiquez lors d'une classe transplante. Utilisez les photos prises lors de cette classe pour raconter quotidiennement le séjour vécu.
C'est le scénario P-Dagujic présenté par monsieur Navoli, professeur ainsi que le 3 sur une école alimentaire de Montpellier.
La première application a utilisé ce ralame déatec. L'enseignant va alors transférer les différentes photos réalisés lors de la classe transplante.
Dans un dossier, spécifique pour que les élèves puissent le retrouver plus facilement. Il téléverse donc ses photos dans le dossier, dans le venté, dans la médiatèque de la classe.
Pour terminer, il s'assure que le dossier soit bien ouvert aux utilisateurs afin que tout le monde puisse l'utiliser.
Les élèves par la suite utilisera le blog. A partir de leurs nantes, il pourront se loi de parposte rédigeant un article d'un reinté.
Ils illustront ses articles à l'aide des photos de que mon numérique mise à n'accélier dans le venté.
Pour se faire, il pourront utiliser les diteurs avancés qui les renvèrent directement dans la médiatèque de la classe où il pourront retrouver le dossier créé par leurs enseignants.
Une fois leur article terminée, les élèves soumétront se lui-ci au professeur qui pourra soit la noté pour correction ou le public.
Ensuite, il pourront lire et commenter ce de leurs camarades ou répondre aux commentaires de la veille.
`)
  })

  it(`returns coherent wer`, async function () {
    const wer = await jiwerCLI.wer()
    expect(wer).to.be.below(30 / 100)
    expect(wer).to.be.greaterThan(0 / 100)
  })

  it(`returns coherent cer`, async function () {
    const cer = await jiwerCLI.cer()
    expect(cer).to.be.below(10 / 100)
    expect(cer).to.be.greaterThan(9 / 100)
  })

  it(`print alignment`, async function () {
    console.log(await jiwerCLI.alignment())
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
  })
})
