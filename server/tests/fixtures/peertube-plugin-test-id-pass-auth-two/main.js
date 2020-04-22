async function register ({
  registerIdAndPassAuth,
  peertubeHelpers
}) {
  registerIdAndPassAuth({
    type: 'id-and-pass',

    onLogout: () => {
      peertubeHelpers.logger.info('On logout for auth 2 - 1')
    },

    getWeight: () => 30,

    login (body) {
      if (body.id === 'laguna' && body.password === 'laguna password') {
        return Promise.resolve({
          username: 'laguna',
          email: 'laguna@example.com'
        })
      }

      return null
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
