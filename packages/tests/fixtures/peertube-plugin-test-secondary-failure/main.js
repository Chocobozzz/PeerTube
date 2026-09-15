async function register ({ peertubeHelpers }) {
  // Like a native dependency that could not be built on the host of a secondary process
  if (process.argv.includes('--role=secondary')) {
    throw new Error('This plugin cannot be registered by a secondary process')
  }

  peertubeHelpers.logger.info('Secondary failure test plugin registered')
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}
