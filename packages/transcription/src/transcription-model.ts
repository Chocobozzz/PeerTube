// Convert Whisper transformer model from PyTorch to ggml format
// : e original Whisper PyTorch models provided by OpenAI a
// ggml format in order to be able to load them in C/C++

// In supervised machine learning, the artefact created after training that is used to make predictions on new data is called a model.
// models can be saved in a file that can potentially be compressed, so typically model files have a binary file format
// TensorFlow saves models as protocol buffer files, with a .pb file extension.
// Keras saves models natively as .h5 file.
// Scikit-Learn saves models as pickled python objects, with a .pkl file extension.
// An older format for model serving based on XML, predictive model markup language (.pmml), is still usable on some frameworks, such as Scikit-Learn.

// Training File Formats :
// - petastorm
// - npy
// - tfrecords

// Model Serving Serialization Formats
// - pb
// - mlmodel
// onnx
// pkl
// older : h5 pmml

// Hugging Face fine-tuned models to ggml format
// or Whisper transformer model ?

// ML models vs Transformer Model
// Transcription Model

// Other model file formats that are used include SparkML models that can be saved in MLeap file format and served in real-time using a MLleap model server (files are packaged in .zip format). Apple developed the .mlmodel file format to store models embedded in iOS applications as part of its Core ML framework (which has superior support for ObjectiveC and Swift languages). Applications trained in TensorFlow, Scikit-Learn, and other frameworks need to convert their model files to the .mlmodel file format for use on iOS, with tools like, coremltools and Tensorflow converter being available to help file format conversion. ONNX is a ML framework independent file format, supported by Microsoft, Facebook, and Amazon. In theory, any ML framework should be able to export its models in .onnx file format, so it offers great promise in unifying model serving across the different frameworks. However, as of late 2019, ONNX does not support all operations for the most popular ML frameworks (TensorFlow, PyTorch, Scikit-Learn), so ONNX is not yet practical for those frameworks. In PyTorch, the recommended way to serve models is to use Torch Script to trace and save a model as a .pt file and serve it from a C++ application.
//
//   One final file format to mention here is YAML that is used to package models as part of the MLFlow framework for ML pipelines on Spark. MLFlow stores a YAML file that describes the files it packages for model serving, so that deployment tools can understand the model file format and know what files to deploy.
// // ModelServingFileSerializationFormats
//   File formats: .pb, .onnx, .pkl, .mlmodel, .zip, .pmml, .pt
// Inference: .pb files are served by TensorFlowServing Server;
// .onnx files are served by Microsoft’s commercial model serving platorm;
// .pkl files are served for Scikit-Learn models, often on Flask servers;
// .mlmodel files are served by iOS platforms;
// .zip files are used to package up MLeap files that are served on the MLeap runtime;
// .pt files are use to package PyTorch models that can be served inside C++ applications.
// .'PyTorch' | 'GGML' | 'ONNX' // CoreML, OpenVino, Scikit-Learn, TensorFlow/Keras, PySpark
// https://towardsdatascience.com/guide-to-file-formats-for-machine-learning-columnar-training-inferencing-and-the-feature-store-2e0c3d18d4f9

export type ModelFormat = 'PyTorch' | 'GGML' | 'ONNX' | 'CTranslate2' // CoreML, OpenVino, Scikit-Learn, TensorFlow/Keras, PySpark

export abstract class TranscriptionModel {
  name: string
  format?: ModelFormat
  path?: string
  url?: string

  // #  - hparams
  // #  - Number of dimensions (int)
  // #  - Name length (int)
  // #  - Dimensions (int[n_dims])
  // #  - Name (char[name_length])
  // #  - Data (float[n_dims])

  // #  - mel filters
  // #  - tokenizer vocab
  // #  - model variables
}
