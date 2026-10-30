async function register ({ registerHook, getRouter }) {
  const router = getRouter()
  let empty = false

  router.get('/page', (req, res) => res.send('Plugin page'))
  router.post('/empty', (req, res) => {
    empty = true
    res.sendStatus(204)
  })

  registerHook({
    target: 'filter:sitemap.pages.list.result',
    handler: async entries => {
      // Yield to exercise asynchronous filter handlers.
      await Promise.resolve()
      if (empty) return []

      return entries
        .filter(entry => !entry.url.endsWith('/videos/browse'))
        .map(entry => entry.url.endsWith('/about/instance/home')
          ? { ...entry, lastmod: '2026-01-01' }
          : entry)
        .concat({ url: '/plugins/test-sitemap/router/page' })
    }
  })
}

async function unregister () {
  return
}

module.exports = { register, unregister }
