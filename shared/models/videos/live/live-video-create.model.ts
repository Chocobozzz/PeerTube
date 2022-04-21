import { VideoCreate } from '../video-create.model'
import { LiveVideoLatencyMode } from './live-video-latency-mode.enum'

export interface LiveVideoCreate extends VideoCreate {
  permanentLive?: boolean
  latencyMode?: LiveVideoLatencyMode

  saveReplay?: boolean
}
