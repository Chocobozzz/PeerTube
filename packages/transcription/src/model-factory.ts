import { TranscriptionModel } from './transcription-model.js'

export class ModelFactory {
  createModelFromName (name: string): TranscriptionModel {
    return {
      name
    }
  }
}
