export interface VideoTranscodingCreate {
  transcodingType: 'hls' | 'webtorrent' | 'web-video' // TODO: remove webtorrent in v7

  forceTranscoding?: boolean // Default false
}
