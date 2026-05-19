async function register({
  peertubeHelpers,
  registerCommentAutoTagger,
  registerVideoAutoTagger,
  getRouter
}) {
  registerCommentAutoTagger({
    autoTagName: 'plugin comment auto tag',

    handler: async ({ comment }) => {
      if (comment && comment.text && comment.text.includes('plugin-tag-comment')) {
        return { result: true }
      }

      return { result: false }
    }
  })

  registerVideoAutoTagger({
    autoTagName: 'plugin video auto tag',

    handler: async ({ video }) => {
      if (video) {
        const text = (video.name || '') + ' ' + (video.description || '')

        if (text.includes('plugin-tag-video')) {
          return { result: true }
        }
      }


      return { result: false }
    }
  })

  const router = getRouter()

  router.get('/server-comment-tags/:commentId', async (req, res) => {
    const commentId = parseInt(req.params.commentId, 10)

    const tags = await peertubeHelpers.automaticTags.getServerCommentAutomaticTags({ commentId })

    return res.json({
      tags: tags.map(t => t.name)
    })
  })

  router.get('/account-comment-tags/:commentId', async (req, res) => {
    const commentId = parseInt(req.params.commentId, 10)
    const accountId = parseInt(req.query.accountId, 10)

    const tags = await peertubeHelpers.automaticTags.getAccountCommentAutomaticTags({ commentId, accountId })

    return res.json({
      tags: tags.map(t => t.name)
    })
  })

  router.get('/server-video-tags/:videoId', async (req, res) => {
    const videoId = parseInt(req.params.videoId, 10)

    const tags = await peertubeHelpers.automaticTags.getServerVideoAutomaticTags({ videoId })

    return res.json({
      tags: tags.map(t => t.name)
    })
  })
}

async function unregister() {
  return
}

module.exports = {
  register,
  unregister
}
