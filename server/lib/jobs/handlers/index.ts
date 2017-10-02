import * as videoFileOptimizer from './video-file-optimizer'
import * as videoFileTranscoder from './video-file-transcoder'

export interface JobHandler<T> {
  process (data: object): T
  onError (err: Error, jobId: number)
  onSuccess (jobId: number, jobResult: T)
}

const jobHandlers: { [ handlerName: string ]: JobHandler<any> } = {
  videoFileOptimizer,
  videoFileTranscoder
}

export {
  jobHandlers
}
