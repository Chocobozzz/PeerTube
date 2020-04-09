async function register ({
  peertubeHelpers,
  registerHook
}) {
  const logger = peertubeHelpers.logger

  logger.info('Hello world from plugin four')

  const username = 'root'
  const results = await peertubeHelpers.database.query(
    'SELECT "email" from "user" WHERE "username" = $username',
    {
      type: 'SELECT',
      bind: { username }
    }
  )

  logger.info('root email is ' + results[0]['email'])

  registerHook({
    target: 'action:api.video.viewed',
    handler: async ({ video }) => {
      await peertubeHelpers.videos.removeVideo(video.id)

      logger.info('Video deleted by plugin four.')
    }
  })
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ###########################################################################
