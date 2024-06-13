import { TranscriptionEngineName, transcriberFactory } from '@peertube/peertube-transcription'
import { createLogger } from 'winston'

describe('Transcriber factory', function () {
  const transcribers: TranscriptionEngineName[] = [ 'openai-whisper', 'whisper-ctranslate2' ]

  describe('Should be able to create a transcriber for each available transcription engine', function () {

    for (const transcriberName of transcribers) {
      it(`Should be able to create a(n) ${transcriberName} transcriber`, function () {
        transcriberFactory.createFromEngineName({ engineName: transcriberName, logger: createLogger() })
      })
    }

  })
})
