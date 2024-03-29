- cpp
- ctranslate2
- faster-whisper
- insanely-fast-whisper
- whisper
- transformers.js
- whisperX

Transformers* could be defined as an all-purpose inference engines instead of a whisper only engine :
- to create a video summary
-



// mixed precision training
// env.cacheDir = './.cache';
// env.localModelPath = '/path/to/models/';
// env.allowRemoteModels = false;
// To optimize the data pipeline, you should use techniques such as
// caching,
// prefetching,
// batching,
// sharding, and
// compression, depending on the characteristics and size of your data.
// You should also monitor the data throughput and utilization of the GPU and CPU devices, and adjust the data pipeline accordingly.
// 1) Prefetching: To load data asynchronously while the model is training on the current batch. This minimizes data loading bottlenecks.
// 2) Data Sampling for initial models:  For initial model development or debugging, working with a smaller subset of your data to can help speedy setup and output.
// 3) Parallel Processing: This is the most obvious point and important point. Utilize multi-threading or multiprocessing libraries like concurrent.futures in Python to preprocess data in parallel. This is particularly effective when dealing with large datasets.
// https://www.linkedin.com/advice/3/how-can-you-optimize-machine-learning-models
// Use mixed precision training
// Apply model pruning and quantization
//  Sizing the model will almost always help with performance,
// On GPUs,
// - leverage batch processing
// - and mixed-precision training,
// - manage GPU memory,
// - and consider model pruning.
// For CPUs,
// - utilize multi-threading,
// - efficient libraries,
// - batch inference, quantization,
// - and model optimization.
// - Employ
//     - compiler flags,
//     - caching,
//     - and distributed computing for CPU performance.
// Profiling tools help identify bottlenecks on both hardware types, ensuring efficient model deployment in diverse environments.
// The choice between GPU and CPU optimization depends on the specific task and hardware resources available.
// Cela pourrait être chouette de pouvoir run des tests sur des runners gpu depuis Github Actions :
//   https://resources.github.com/devops/accelerate-your-cicd-with-arm-and-gpu-runners-in-github-actions/

// Techniques such as
// model quantization, pruning,
// and other optimizations can further enhance the efficiency of running these models on CPU hardware.
// If you're looking to deploy Whisper models on CPU-based systems, you can use popular deep learning frameworks like TensorFlow or PyTorch, which provide support for deploying models on CPU and offer optimizations for inference performance. Additionally, platforms like ONNX Runtime or TensorFlow Lite offer optimizations for inference on CPU, including support for quantized models and hardware acceleration where available.

// https://eval.ai/web/challenges/challenge-page/1637/overview
// https://github.com/fquirin/speech-recognition-experiments








// => are producting models


// PyTorch and TensorFlow
// deepLearningFramework
// cpp.ts
// ctranslate2.ts
// faster.ts
// insanely-fast.ts
// python.ts
// transformer.ts
// X .ts

// whisper.cpp
// ggml
