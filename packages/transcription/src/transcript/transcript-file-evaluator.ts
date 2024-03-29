import assert from 'node:assert'
import { JiwerClI } from '@peertube/peertube-jiwer'
import { TranscriptFileEvaluatorInterface } from './transcript-file-evaluator-interface.js'
import { TranscriptFileInterface } from './index.js'

export class TranscriptFileEvaluator implements TranscriptFileEvaluatorInterface {
  referenceTranscriptFile: TranscriptFileInterface
  hypothesisTranscriptFile: TranscriptFileInterface
  jiwerCLI: JiwerClI

  constructor (referenceTranscriptFile: TranscriptFileInterface, hypothesisTranscriptFile: TranscriptFileInterface) {
    assert(referenceTranscriptFile.format === 'txt', 'Can only evaluate txt transcript file')
    assert(hypothesisTranscriptFile.format === 'txt', 'Can only evaluate txt transcript file')

    this.referenceTranscriptFile = referenceTranscriptFile
    this.hypothesisTranscriptFile = hypothesisTranscriptFile

    this.jiwerCLI = new JiwerClI(this.referenceTranscriptFile.path, this.hypothesisTranscriptFile.path)
  }

  /**
   * WER: Word Error Rate
   */
  wer () {
    return this.jiwerCLI.wer()
  }

  /**
   * CER: Character Error Rate
   */
  cer () {
    return this.jiwerCLI.cer()
  }

  alignment () {
    return this.jiwerCLI.alignment()
  }

  async evaluate () {
    return {
      wer: await this.wer(),
      cer: await this.cer(),
      alignment: await this.alignment()
    }
  }
}
