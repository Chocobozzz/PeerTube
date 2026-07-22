// We can't rely on FPS and width/height because we may not have this information for very old videos
// Only resolution (not bitrate/codec) distinguishes streams of the same video
// PeerTube must not produces more than one file per resolution for a given video
export function generateSwarmId (options: {
  peerProtocolVersion: string
  streamType: 'main' | 'secondary'
  videoUUID: string
  resolution: number
}) {
  const { peerProtocolVersion, streamType, videoUUID, resolution } = options

  // Video
  if (resolution) {
    const codecName = 'default' // To support other codecs in the future

    return `pt-${peerProtocolVersion}-${videoUUID}-${streamType}-${codecName}-${resolution}`
  }

  // Audio
  const language = 'default' // To support other languages in the future
  const codecName = 'default' // And also other codecs
  return `pt-${peerProtocolVersion}-${videoUUID}-${streamType}-${codecName}-${language}`
}
