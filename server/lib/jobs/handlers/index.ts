import * as videoTranscoder from './video-transcoder'

import { VideoInstance } from '../../../models'

export interface JobHandler<T> {
  process (data: object, callback: (err: Error, videoInstance?: T) => void)
  onError (err: Error, jobId: number, video: T, callback: (err: Error) => void)
  onSuccess (data: any, jobId: number, video: T, callback: (err: Error) => void)
}

const jobHandlers: { [ handlerName: string ]: JobHandler<any> } = {
  videoTranscoder
}

export {
  jobHandlers
}
