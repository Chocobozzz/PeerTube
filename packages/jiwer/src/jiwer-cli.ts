import { $ } from 'execa'

export class JiwerClI {
  referenceFilePath: string
  hypothesisFilePath: string

  constructor (referenceFilePath: string, hypothesisFilePath: string) {
    this.referenceFilePath = referenceFilePath
    this.hypothesisFilePath = hypothesisFilePath
  }

  /**
   * @param referenceFilePath Path to new-line delimited text file of reference sentences.
   * @param hypothesisFilePath Path to new-line delimited text file of hypothesis sentences.
   * @param args
   */
  static buildArgs (referenceFilePath: string, hypothesisFilePath: string, ...args: string[]) {
    return [
      '--reference',
      referenceFilePath,
      '--hypothesis',
      hypothesisFilePath,
      ...args
    ]
  }

  buildArgs (...args: string[]) {
    return JiwerClI.buildArgs(this.referenceFilePath, this.hypothesisFilePath, ...args)
  }

  /**
   * WER: Word Error Rate as a percentage, ex: 0.03 -> 3%
   */
  static async wer (referenceFilePath: string, hypothesisFilePath: string, global = true): Promise<number> {
    const { stdout: wer } = await $`jiwer ${JiwerClI.buildArgs(referenceFilePath, hypothesisFilePath, global && '-g')}`

    return Number(wer)
  }

  async wer (global = true) {
    return await JiwerClI.wer(this.hypothesisFilePath, this.referenceFilePath, global)
  }

  /**
   * CER: Character Error Rate
   */
  static async cer (referenceFilePath: string, hypothesisFilePath: string, global = true): Promise<number> {
    const { stdout: cer } = await $`jiwer ${JiwerClI.buildArgs(referenceFilePath, hypothesisFilePath, '--cer', global && '-g')}`

    return Number(cer)
  }

  async cer (global = true) {
    return await JiwerClI.cer(this.hypothesisFilePath, this.referenceFilePath, global)
  }

  /**
   * Print alignment of each sentence.
   */
  static async alignment (referenceFilePath: string, hypothesisFilePath: string, global = true): Promise<string> {
    const { stdout: alignment } = await $`jiwer ${JiwerClI.buildArgs(referenceFilePath, hypothesisFilePath, '--align', global && '-g')}`

    return alignment
  }

  async alignment (global = true) {
    return await JiwerClI.alignment(this.hypothesisFilePath, this.referenceFilePath, global)
  }
}
