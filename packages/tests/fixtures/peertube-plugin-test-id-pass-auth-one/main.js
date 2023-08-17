async function register ({
  registerIdAndPassAuth,
  peertubeHelpers,
  settingsManager,
  unregisterIdAndPassAuth
}) {
  registerIdAndPassAuth({
    authName: 'spyro-auth',

    onLogout: () => {
      peertubeHelpers.logger.info('On logout for auth 1 - 1')
    },

    getWeight: () => 15,

    login (body) {
      if (body.id === 'spyro' && body.password === 'spyro password') {
        return Promise.resolve({
          username: 'spyro',
          email: 'spyro@example.com',
          role: 2,
          displayName: 'Spyro the Dragon'
        })
      }

      return null
    }
  })

  registerIdAndPassAuth({
    authName: 'crash-auth',

    onLogout: () => {
      peertubeHelpers.logger.info('On logout for auth 1 - 2')
    },

    getWeight: () => 50,

    login (body) {
      if (body.id === 'crash' && body.password === 'crash password') {
        return Promise.resolve({
          username: 'crash',
          email: 'crash@example.com',
          role: 1,
          displayName: 'Crash Bandicoot'
        })
      }

      return null
    }
  })

  settingsManager.onSettingsChange(settings => {
    if (settings.disableSpyro) {
      unregisterIdAndPassAuth('spyro-auth')
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
