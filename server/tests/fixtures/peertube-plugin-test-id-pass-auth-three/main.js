async function register ({
  registerIdAndPassAuth,
  peertubeHelpers
}) {
  registerIdAndPassAuth({
    authName: 'laguna-bad-auth',

    onLogout: () => {
      peertubeHelpers.logger.info('On logout for auth 3 - 1')
    },

    getWeight: () => 5,

    login (body) {
      if (body.id === 'laguna' && body.password === 'laguna password') {
        return Promise.resolve({
          username: 'laguna',
          email: 'laguna@example.com',
          displayName: 'Laguna Loire'
        })
      }

      return null
    }
  })

  registerIdAndPassAuth({
    authName: 'ward-auth',

    getWeight: () => 5,

    login (body) {
      if (body.id === 'ward') {
        return Promise.resolve({
          username: 'ward-42',
          email: 'ward@example.com'
        })
      }

      return null
    }
  })

  registerIdAndPassAuth({
    authName: 'kiros-auth',

    getWeight: () => 5,

    login (body) {
      if (body.id === 'kiros') {
        return Promise.resolve({
          username: 'kiros',
          email: 'kiros@example.com',
          displayName: 'a'.repeat(5000)
        })
      }

      return null
    }
  })

  registerIdAndPassAuth({
    authName: 'raine-auth',

    getWeight: () => 5,

    login (body) {
      if (body.id === 'raine') {
        return Promise.resolve({
          username: 'raine',
          email: 'raine@example.com',
          role: 42
        })
      }

      return null
    }
  })

  registerIdAndPassAuth({
    authName: 'ellone-auth',

    getWeight: () => 5,

    login (body) {
      if (body.id === 'ellone') {
        return Promise.resolve({
          username: 'ellone'
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
