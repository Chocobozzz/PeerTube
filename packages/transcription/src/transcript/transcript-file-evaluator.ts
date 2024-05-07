import { $ } from 'execa'
import assert from 'node:assert'
import { TranscriptFile } from './index.js'

/**
 * This transcript evaluator is based on Jiwer CLI, a Python implementation :
 * https://jitsi.github.io/jiwer/cli/
 *
 * There are plenty implementation of WER (Word Error Rate) and CER (Character Error Rate) calculation in Python
 * but not that many in NodeJs.
 */
export class TranscriptFileEvaluator {
  referenceTranscriptFile: TranscriptFile
  hypothesisTranscriptFile: TranscriptFile

  constructor (referenceTranscriptFile: TranscriptFile, hypothesisTranscriptFile: TranscriptFile) {
    assert(referenceTranscriptFile.format === 'txt', 'Can only evaluate txt transcript file')
    assert(hypothesisTranscriptFile.format === 'txt', 'Can only evaluate txt transcript file')

    this.referenceTranscriptFile = referenceTranscriptFile
    this.hypothesisTranscriptFile = hypothesisTranscriptFile
  }

  static buildArgs (referenceTranscriptFilePath: string, hypothesisTranscriptFilePath: string, ...args: string[]) {
    return [
      '--reference',
      referenceTranscriptFilePath,
      '--hypothesis',
      hypothesisTranscriptFilePath,
      ...args
    ]
  }

  buildArgs (...args: string[]) {
    return TranscriptFileEvaluator.buildArgs(this.referenceTranscriptFile.path, this.hypothesisTranscriptFile.path, ...args)
  }

  /**
   * WER: Word Error Rate
   */
  async wer () {
    const { stdout: wer } = await $`jiwer ${this.buildArgs('-g')}`

    return Number(wer)
  }

  /**
   * CER: Character Error Rate
   */
  async cer () {
    const { stdout: cer } = await $`jiwer ${this.buildArgs('--cer', '-g')}`

    return Number(cer)
  }

  async alignement () {
    const { stdout: alignement } = await $`jiwer ${this.buildArgs('-g', '--align')}`

    return alignement
  }

  async evaluate () {
    return {
      wer: await this.wer(),
      cer: await this.cer(),
      alignement: await this.alignement()
    }
  }
}
