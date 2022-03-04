import { LiveVideoLatencyMode } from '.'
import { VideoCreate } from '../video-create.model'

export interface LiveVideoCreate extends VideoCreate {
  saveReplay?: boolean
  permanentLive?: boolean
  latencyMode?: LiveVideoLatencyMode
}
