
 DeepLearningFramework vs training libraries

https://github.com/openai/whisper/blob/main/whisper/__init__.py#L144


```typescript
interface DeepLearningFramework {
  name: string
}
const deepLearningFrameworks: DeepLearningFramework = [
  {
    name: 'PyTorch',
    distributed: true,
    gpu: true
  },
  {
    name: 'TensorFlow'
  }
]
```


What about the lifecycle of each transcriber ?
- install => installer
- update => udpater

For the **Python** packages :
1. Install
```sh
pip install <package-name>
```
Package version should be constraint to a version compatible with our wrapper.
We could also attempt to run our test against different version of the lib to be future ready.

2. Update
```sh
pip install -U <package-name>
```

> Need the package name somewhere in the model
>
>
### Whisper timestamped discrepancies
- Lower case instead of upper case
- missing .json file
- binary name is awkard, package is name whisper-timestamped and binary name is whisper-tiomestamped
> https://github.com/linto-ai/whisper-timestamped/issues?q=is:issue+author:lutangar
