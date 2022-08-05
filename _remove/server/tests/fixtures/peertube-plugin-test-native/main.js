const print = require('a-native-example')

async function register ({ getRouter }) {
  print('hello world')

  const router = getRouter()

  router.get('/', (req, res) => {
    print('hello world')
    res.sendStatus(204)
  })
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}
