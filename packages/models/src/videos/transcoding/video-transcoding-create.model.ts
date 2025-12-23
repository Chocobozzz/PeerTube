export interface VideoTranscodingCreate {
  transcodingType: 'hls' | 'web-video'

  forceTranscoding?: boolean // Default false
}
