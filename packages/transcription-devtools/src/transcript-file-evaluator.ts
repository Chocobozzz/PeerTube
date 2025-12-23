import assert from 'node:assert'
import { TranscriptFileEvaluatorInterface } from './transcript-file-evaluator-interface.js'
import { TranscriptFile } from '@peertube/peertube-transcription'
import { JiwerClI } from './jiwer-cli.js'

export class TranscriptFileEvaluator implements TranscriptFileEvaluatorInterface {
  referenceTranscriptFile: TranscriptFile
  hypothesisTranscriptFile: TranscriptFile
  jiwerCLI: JiwerClI

  constructor (referenceTranscriptFile: TranscriptFile, hypothesisTranscriptFile: TranscriptFile) {
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
