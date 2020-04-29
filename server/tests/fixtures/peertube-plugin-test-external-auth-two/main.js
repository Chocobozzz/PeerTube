async function register ({
  registerExternalAuth,
  peertubeHelpers
}) {
  {
    const result = registerExternalAuth({
      authName: 'external-auth-3',
      authDisplayName: 'External Auth 3',
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
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ###########################################################################
