async function register ({
  registerExternalAuth,
  peertubeHelpers,
  settingsManager,
  unregisterExternalAuth
}) {
  {
    const result = registerExternalAuth({
      authName: 'external-auth-1',
      authDisplayName: () => 'External Auth 1',
      onLogout: user => peertubeHelpers.logger.info('On logout %s', user.username),
      onAuthRequest: (req, res) => {
        const username = req.query.username

        result.userAuthenticated({
          req,
          res,
          username,
          email: username + '@example.com'
        })
      }
    })
  }

  {
    const result = registerExternalAuth({
      authName: 'external-auth-2',
      authDisplayName: () => 'External Auth 2',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: 'kefka',
          email: 'kefka@example.com',
          role: 0,
          displayName: 'Kefka Palazzo'
        })
      },
      hookTokenValidity: (options) => {
        if (options.type === 'refresh') {
          return { valid: false }
        }

        if (options.type === 'access') {
          const token = options.token
          const now = new Date()
          now.setTime(now.getTime() - 5000)

          const createdAt = new Date(token.createdAt)

          return { valid: createdAt.getTime() >= now.getTime() }
        }

        return { valid: true }
      }
    })
  }

  settingsManager.onSettingsChange(settings => {
    if (settings.disableKefka) {
      unregisterExternalAuth('external-auth-2')
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
