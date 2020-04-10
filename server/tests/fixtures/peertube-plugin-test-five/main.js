async function register ({
  getRouter
}) {
  const router = getRouter()
  router.get('/ping', (req, res) => res.json({ message: 'pong' }))

  router.post('/form/post/mirror', (req, res) => {
    res.json(req.body)
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
