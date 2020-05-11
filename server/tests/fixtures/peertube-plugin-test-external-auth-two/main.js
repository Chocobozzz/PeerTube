async function register ({
  registerExternalAuth,
  peertubeHelpers
}) {
  {
    const result = registerExternalAuth({
      authName: 'external-auth-3',
      authDisplayName: () => 'External Auth 3',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: 'cid',
          email: 'cid@example.com',
          displayName: 'Cid Marquez'
        })
      }
    })
  }

  {
    const result = registerExternalAuth({
      authName: 'external-auth-4',
      authDisplayName: () => 'External Auth 4',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: 'kefka2',
          email: 'kefka@example.com',
          displayName: 'Kefka duplication'
        })
      }
    })
  }

  {
    const result = registerExternalAuth({
      authName: 'external-auth-5',
      authDisplayName: () => 'External Auth 5',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: 'kefka',
          email: 'kefka@example.com',
          displayName: 'Kefka duplication'
        })
      }
    })
  }

  {
    const result = registerExternalAuth({
      authName: 'external-auth-6',
      authDisplayName: () => 'External Auth 6',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: 'existing_user',
          email: 'existing_user@example.com',
          displayName: 'Existing user'
        })
      }
    })
  }
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ###########################################################################
