import { EncoderOptionsBuilder } from '../videos/video-transcoding.model'

export interface PluginTranscodingManager {
  addLiveProfile (encoder: string, profile: string, builder: EncoderOptionsBuilder): boolean

  addVODProfile (encoder: string, profile: string, builder: EncoderOptionsBuilder): boolean

  addLiveEncoderPriority (streamType: 'audio' | 'video', encoder: string, priority: number): void

  addVODEncoderPriority (streamType: 'audio' | 'video', encoder: string, priority: number): void

  removeAllProfilesAndEncoderPriorities(): void
}
