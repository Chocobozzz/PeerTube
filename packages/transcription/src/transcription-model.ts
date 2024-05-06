import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { parse } from 'node:path'

export type ModelFormat = 'PyTorch' | 'GGML' | 'ONNX' | 'CTranslate2' // CoreML, OpenVino, Scikit-Learn, TensorFlow/Keras, PySpark

export class TranscriptionModel {
  name: string
  format?: ModelFormat
  path?: string

  // #  - hparams
  // #  - Number of dimensions (int)
  // #  - Name length (int)
  // #  - Dimensions (int[n_dims])
  // #  - Name (char[name_length])
  // #  - Data (float[n_dims])

  // #  - mel filters
  // #  - tokenizer vocab
  // #  - model variables

  constructor (name: string, path?: string, format?: ModelFormat) {
    this.name = name
    this.path = path
    this.format = format
  }

  static fromPath (path: string) {
    assert(existsSync(path), `${path} doesn't exist.`)

    return new TranscriptionModel(parse(path).name, path)
  }
}
