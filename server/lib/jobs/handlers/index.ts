import * as videoTranscoder from './video-transcoder'

export interface JobHandler<T> {
  process (data: object): T
  onError (err: Error, jobId: number)
  onSuccess (jobId: number, jobResult: T)
}

const jobHandlers: { [ handlerName: string ]: JobHandler<any> } = {
  videoTranscoder
}

export {
  jobHandlers
}
