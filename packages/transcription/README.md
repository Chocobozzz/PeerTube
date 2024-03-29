# Transcription

Video **transcription** consists in transcribing the audio content of a video to a text.
> This process might be called __Automatic Speech Recognition__ or __Speech to Text__ in more general context.

Provide a common API to many transcription backend, currently :
- `openai-whisper` CLI
- `faster-whisper` (*via* `whisper-ctranslate2` CLI)
- `whisper-timestamped`

> Potential candidates could be: whisper-cpp, vosk, ...

## Requirements
- Python
- PIP

And at least one of the following transcription backend:
- Python :
  - `openai-whisper`
  - `whisper-ctranslate2>=0.4.3`
  - `whisper-timestamped>=1.15.4`

And to run the transcript evaluation tests :
- Python
  - `jiwer>=3.04`

## Usage

Create a transcriber manually :
```typescript
import { OpenaiTranscriber } from '@peertube/peertube-transcription'

(async () => {
  // create a transcriber powered by OpeanAI Whisper CLI
  const transcriber = new OpenaiTranscriber({
    name: 'openai-whisper',
    binary: 'whisper',
    languageDetection: true
  });

  const transcriptFile = await transcriber.transcribe({
    mediaFilePath: './myVideo.mp4',
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
  model: WhisperBuiltinModel.fromPath('./models/large.pt'),
  format: 'txt'
});
```

You may use the builtin Factory if you're happy with the default configuration:
```Typescript
import { transcriberFactory } from '@peertube/peertube-transcription'
transcriberFactory.createFromEngineName('openai-whisper')
```
> For further usage [../tests/src/transcription/whisper/transcriber/openai-transcriber.spec.ts](../tests/src/transcription/whisper/transcriber/openai-transcriber.spec.ts)

## Benchmark

A benchmark of available __transcribers__ might be run with:
```sh
npm run benchmark
```
```
┌────────────────────────┬───────────────────────┬───────────────────────┬──────────┬────────┬───────────────────────┐
│        (index)         │          WER          │          CER          │ duration │ model  │        engine         │
├────────────────────────┼───────────────────────┼───────────────────────┼──────────┼────────┼───────────────────────┤
│ 5yZGBYqojXe7nuhq1TuHvz │ '28.39506172839506%'  │  '9.62457337883959%'  │  '41s'   │ 'tiny' │   'openai-whisper'    │
│ x6qREJ2AkTU4e5YmvfivQN │ '29.75206611570248%'  │ '10.46195652173913%'  │  '15s'   │ 'tiny' │ 'whisper-ctranslate2' │
│ qbt6BekKMVzxq4KCSLCzt3 │ '31.020408163265305%' │ '10.784982935153584%' │  '20s'   │ 'tiny' │ 'whisper-timestamped' │
└────────────────────────┴───────────────────────┴───────────────────────┴──────────┴────────┴───────────────────────┘
```

The benchmark may be run with multiple model builtin sizes:
```sh
MODELS=tiny,small,large npm run benchmark
```

## Lexicon
- ONNX: Open Neural Network eXchange. A specification, the ONNX Runtime run these models.
- GPTs: Generative Pre-Trained Transformers
- LLM: Large Language Models
- NLP: Natural Language Processing
- MLP: Multilayer Perceptron
- ASR: Automatic Speech Recognition
- WER: Word Error Rate
- CER: Character Error Rate
