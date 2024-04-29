export type ModelFormat = 'PyTorch' | 'GGML' | 'ONNX' | 'CTranslate2' // CoreML, OpenVino, Scikit-Learn, TensorFlow/Keras, PySpark

export abstract class TranscriptionModel {
  name: string
  format?: ModelFormat
  path?: string
  url?: string

  // #  - hparams
  // #  - Number of dimensions (int)
  // #  - Name length (int)
  // #  - Dimensions (int[n_dims])
  // #  - Name (char[name_length])
  // #  - Data (float[n_dims])

  // #  - mel filters
  // #  - tokenizer vocab
  // #  - model variables
}
