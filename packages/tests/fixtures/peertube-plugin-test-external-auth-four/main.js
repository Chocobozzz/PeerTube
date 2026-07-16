async function register ({
  registerExternalAuth
}) {
  {
    const result = registerExternalAuth({
      authName: 'external-auth-id-1',
      authDisplayName: () => 'External Auth Id 1',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: req.query.username,
          email: req.query.email,
          externalId: req.query.externalId || undefined
        })
      }
    })
  }

  {
    const result = registerExternalAuth({
      authName: 'external-auth-id-2',
      authDisplayName: () => 'External Auth Id 2',
      onAuthRequest: (req, res) => {
        result.userAuthenticated({
          req,
          res,
          username: req.query.username,
          email: req.query.email,
          externalId: req.query.externalId || undefined
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
