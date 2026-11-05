async function register ({ registerHook, peertubeHelpers }) {
  // Called while the live manager prepares a live session, after it probed the RTMP stream
  // Slow it down, so tests can disconnect the publisher in the meantime
  registerHook({
    target: 'filter:transcoding.auto.resolutions-to-transcode.result',
    handler: async (object, { video }) => {
      if (!video.isLive) return object

      peertubeHelpers.logger.info('Slowing down live setup of ' + video.uuid)

      await new Promise(res => setTimeout(res, 5000))

      peertubeHelpers.logger.info('Slowed down live setup of ' + video.uuid)

      return object
    }
  })
}

async function unregister () {}

module.exports = {
  register,
  unregister
}
