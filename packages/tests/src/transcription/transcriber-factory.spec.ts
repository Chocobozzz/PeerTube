import { transcriberFactory } from '@peertube/peertube-transcription'

describe('Transcriber factory', function () {
  const transcribers = [
    'openai-whisper',
    'whisper-ctranslate2',
    'whisper-timestamped'
  ]

  describe('Should be able to create a transcriber for each available transcription engine', function () {
    transcribers.forEach(function (transcriberName) {
      it(`Should be able to create a(n) ${transcriberName} transcriber`, function () {
        transcriberFactory.createFromEngineName(transcriberName)
      })
    })
  })
})
