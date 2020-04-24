async function register ({
  registerIdAndPassAuth,
  peertubeHelpers
}) {
  registerIdAndPassAuth({
    authName: 'laguna-auth',

    onLogout: () => {
      peertubeHelpers.logger.info('On logout for auth 2 - 1')
    },

    getWeight: () => 30,

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
    },

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
