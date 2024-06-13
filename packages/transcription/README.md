# Transcription

Video **transcription** consists in transcribing the audio content of a video to a text.

> This process might be called __Automatic Speech Recognition__ or __Speech to Text__ in more general context.

Provide a common API to many transcription backend, currently:
  - `openai-whisper` CLI
  - `faster-whisper` (*via* `whisper-ctranslate2` CLI)

> Potential candidates could be: whisper-cpp, vosk, ...

## Requirements
  - Python 3
  - PIP

And at least one of the following transcription backend:
  - Python:
    - `openai-whisper`
    - `whisper-ctranslate2>=0.4.3`

## Usage

Create a transcriber manually:

```typescript
import { OpenaiTranscriber } from '@peertube/peertube-transcription'

(async () => {
  // Optional if you want to use a local installation of transcribe engines
  const binDirectory = 'local/pip/path/bin'

  // Create a transcriber powered by OpenAI Whisper CLI
  const transcriber = new OpenaiTranscriber({
    name: 'openai-whisper',
    command: 'whisper',
    languageDetection: true,
    binDirectory
  });

  // If not installed globally, install the transcriber engine (use pip under the hood)
  await transcriber.install('local/pip/path')

  // Transcribe
  const transcriptFile = await transcriber.transcribe({
    mediaFilePath: './myVideo.mp4',
    model: 'tiny',
    format: 'txt'
  });

  console.log(transcriptFile.path);
  console.log(await transcriptFile.read());
})();
```

Using a local model file:

```typescript
import { WhisperBuiltinModel } from '@peertube/peertube-transcription/dist'

const transcriptFile = await transcriber.transcribe({
  mediaFilePath: './myVideo.mp4',
  model: await WhisperBuiltinModel.fromPath('./models/large.pt'),
  format: 'txt'
});
```

You may use the builtin Factory if you're happy with the default configuration:

```Typescript
import { transcriberFactory } from '@peertube/peertube-transcription'

transcriberFactory.createFromEngineName({
  engineName: transcriberName,
  logger: compatibleWinstonLogger,
  transcriptDirectory: '/tmp/transcription'
})
```
> For further usage [../tests/src/transcription/whisper/transcriber/openai-transcriber.spec.ts](../tests/src/transcription/whisper/transcriber/openai-transcriber.spec.ts)


## Lexicon
- ONNX: Open Neural Network eXchange. A specification, the ONNX Runtime run these models.
- GPTs: Generative Pre-Trained Transformers
- LLM: Large Language Models
- NLP: Natural Language Processing
- MLP: Multilayer Perceptron
- ASR: Automatic Speech Recognition
- WER: Word Error Rate
- CER: Character Error Rate
