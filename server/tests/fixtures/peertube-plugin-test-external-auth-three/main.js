async function register ({
  registerExternalAuth,
  peertubeHelpers
}) {
  {
    const result = registerExternalAuth({
      authName: 'external-auth-7',
      authDisplayName: () => 'External Auth 7',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: 'cid',
          email: 'cid@example.com',
          displayName: 'Cid Marquez'
        })
      },
      onLogout: (user, req) => {
        return 'https://example.com/redirectUrl'
      }
    })
  }

  {
    const result = registerExternalAuth({
      authName: 'external-auth-8',
      authDisplayName: () => 'External Auth 8',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: 'cid',
          email: 'cid@example.com',
          displayName: 'Cid Marquez'
        })
      },
      onLogout: (user, req) => {
        return 'https://example.com/redirectUrl?access_token=' + req.headers['authorization'].split(' ')[1]
      }
    })
  }
}

async function unregister () {

}

module.exports = {
  register,
  unregister
}

// ###########################################################################
