JiWER
=====
__JiWER__ CLI NodeJs wrapper.

> *JiWER is a python tool for computing the word-error-rate of ASR systems.*
> https://jitsi.github.io/jiwer/cli/

__JiWER__ serves as a reference implementation to calculate errors rates between 2 text files:
- WER (Word Error Rate)
- CER (Character Error Rate)

Build
-----

```sh
npm run build
```

Usage
-----
```typescript
const jiwerCLI = new JiwerClI('./reference.txt', './hypothesis.txt')

// WER as a percentage, ex: 0.03 -> 3%
console.log(await jiwerCLI.wer())

// CER as a percentage: 0.01 -> 1%
console.log(await jiwerCLI.cer())

// Detailed comparison report
console.log(await jiwerCLI.alignment())
```

Resources
---------
- https://jitsi.github.io/jiwer/
- https://github.com/rapidfuzz/RapidFuzz
