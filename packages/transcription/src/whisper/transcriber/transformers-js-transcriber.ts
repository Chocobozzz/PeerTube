import { TranscriptionModel } from "../../transcription-model.js";
import { AbstractTranscriber } from "../../abstract-transcriber.js";
import { Transcript, TranscriptFormat } from "../../transcript.js";

// Disable local models
// env.allowLocalModels = true

export class TransformersJsTranscriber extends AbstractTranscriber {
  async transcribe(
    mediaFilePath: string,
    model: TranscriptionModel,
    language: string,
    format: TranscriptFormat = "vtt",
  ): Promise<Transcript> {
    return Promise.resolve(undefined);
    // return pipeline('automatic-speech-recognition', 'no_attentions', {
    //   // For medium models, we need to load the `no_attentions` revision to avoid running out of memory
    //   revision: [].includes('/whisper-medium') ? 'no_attentions' : 'main'
    // })
  }
}
