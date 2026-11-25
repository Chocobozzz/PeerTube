async function register({
  peertubeHelpers,
  registerCommentAutoTagger,
  registerVideoAutoTagger,
  getRouter
}) {
  registerCommentAutoTagger({
    autoTagNames: [ 'plugin comment auto tag' ],

    handler: async ({ comment }) => {
      if (comment && comment.text && comment.text.includes('plugin-tag-comment')) {
        return { tags: [ 'plugin comment auto tag' ] }
      }

      return { tags: [] }
    }
  })

  // Simulate an auto tagger that calls a slow external service: it must not block the comment creation
  registerCommentAutoTagger({
    autoTagNames: [ 'plugin slow comment auto tag' ],

    handler: async ({ comment }) => {
      if (!comment || !comment.text || !comment.text.includes('plugin-slow-tag-comment')) {
        return { tags: [] }
      }

      await new Promise(res => setTimeout(res, 3000))

      return { tags: [ 'plugin slow comment auto tag' ] }
    }
  })

  // Simulate an auto tagger that only analyzes new comments (keep the tags on rebuild)
  const commentAutoTaggerCalls = {}

  registerCommentAutoTagger({
    autoTagNames: [ 'plugin comment trigger auto tag' ],

    handler: async ({ comment, trigger, currentTags }) => {
      if (!comment || !(comment.text || '').includes('record-trigger')) return { tags: [] }

      if (!commentAutoTaggerCalls[comment.text]) commentAutoTaggerCalls[comment.text] = []
      commentAutoTaggerCalls[comment.text].push({ trigger, currentTags })

      if (trigger === 'new-comment') return { tags: [ 'plugin comment trigger auto tag' ] }

      return { tags: currentTags }
    }
  })

  // Analyze the video file to decide of the tag: this runs in a job, outside of any transaction
  registerVideoAutoTagger({
    autoTagNames: [ 'plugin video file auto tag' ],

    handler: async ({ video }) => {
      if (!video || !(video.name || '').includes('analyze-video-file')) return { tags: [] }

      const files = await peertubeHelpers.videos.getFiles(video.id)
      const path = (files?.webVideo?.videoFiles || []).map(f => f.path).find(p => !!p)
      if (!path) return { tags: [] }

      const probe = await peertubeHelpers.videos.ffprobe(path)
      if (!(probe.format.duration > 0)) return { tags: [] }

      return { tags: [ 'plugin video file auto tag' ] }
    }
  })

  registerVideoAutoTagger({
    autoTagNames: [ 'plugin video auto tag' ],

    handler: async ({ video }) => {
      if (video) {
        const text = (video.name || '') + ' ' + (video.description || '')

        if (text.includes('plugin-tag-video')) {
          return { tags: [ 'plugin video auto tag' ] }
        }
      }

      return { tags: [] }
    }
  })

  // Simulate an auto tagger that only analyzes the video files when they changed (keep the tags if it's not the case)
  const videoAutoTaggerCalls = {}

  registerVideoAutoTagger({
    autoTagNames: [ 'plugin video trigger auto tag' ],

    handler: async ({ video, trigger, currentTags }) => {
      if (!video || !(video.name || '').includes('record-trigger')) return { tags: [] }

      if (!videoAutoTaggerCalls[video.id]) videoAutoTaggerCalls[video.id] = []
      videoAutoTaggerCalls[video.id].push({ trigger, currentTags })

      if (trigger === 'new-video' || trigger === 'new-file') return { tags: [ 'plugin video trigger auto tag' ] }

      return { tags: currentTags }
    }
  })

  const router = getRouter()

  router.get('/comment-auto-tagger-calls', async (req, res) => {
    return res.json({
      calls: commentAutoTaggerCalls[req.query.text] || []
    })
  })

  router.get('/video-auto-tagger-calls/:videoId', async (req, res) => {
    return res.json({
      calls: videoAutoTaggerCalls[parseInt(req.params.videoId, 10)] || []
    })
  })

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
