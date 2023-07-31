const lib = require('./lib')

async function register ({ getRouter }) {
  const router = getRouter()
  router.get('/get', (req, res) => res.json({ message: lib.value }))
}

async function unregister () {
}

module.exports = {
  register,
  unregister
}
