async function register ({
  registerIdAndPassAuth,
  peertubeHelpers
}) {
  registerIdAndPassAuth({
    type: 'id-and-pass',

    onLogout: () => {
      peertubeHelpers.logger.info('On logout for auth 1 - 1')
    },

    getWeight: () => 15,

    login (body) {
      if (body.id === 'spyro' && body.password === 'spyro password') {
        return Promise.resolve({
          username: 'spyro',
          email: 'spyro@example.com',
          role: 0,
          displayName: 'Spyro the Dragon'
        })
      }

      return null
    }
  })

  registerIdAndPassAuth({
    type: 'id-and-pass',

    onLogout: () => {
      peertubeHelpers.logger.info('On logout for auth 1 - 2')
    },

    getWeight: () => 50,

    login (body) {
      if (body.id === 'crash' && body.password === 'crash password') {
        return Promise.resolve({
          username: 'crash',
          email: 'crash@example.com',
          role: 2,
          displayName: 'Crash Bandicoot'
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
