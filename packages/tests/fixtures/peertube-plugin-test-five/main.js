async function register ({
  getRouter
}) {
  const router = getRouter()
  router.get('/ping', (req, res) => res.json({ message: 'pong' }))

  router.get('/is-authenticated', (req, res) => res.json({ isAuthenticated: res.locals.authenticated }))

  router.post('/form/post/mirror', (req, res) => {
    res.json(req.body)
  })

  router.post('/form/post/mirror-raw-body', (req, res) => {
    res.json(JSON.parse(req.rawBody))
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
