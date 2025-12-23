import { TranscriptionModel } from '../transcription-model.js'

export type WhisperBuiltinModelName = 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3'

export class WhisperBuiltinModel extends TranscriptionModel {

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (name: WhisperBuiltinModelName) {
    super(name)
  }
}
