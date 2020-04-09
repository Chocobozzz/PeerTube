async function register ({
  peertubeHelpers
}) {
  peertubeHelpers.logger.info('Hello world from plugin four')

  const username = 'root'
  const results = await peertubeHelpers.database.query(
    'SELECT "email" from "user" WHERE "username" = $username',
    {
      type: 'SELECT',
      bind: { username }
    }
  )

  peertubeHelpers.logger.info('root email is ' + results[0]['email'])
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ###########################################################################
