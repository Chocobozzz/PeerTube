async function register ({ registerHook, registerSetting, settingsManager, storageManager, peertubeHelpers }) {
  const actionHooks = [
    'action:application.listening',

    'action:api.video.updated',
    'action:api.video.deleted',
    'action:api.video.uploaded',
    'action:api.video.viewed',

    'action:api.video-thread.created',
    'action:api.video-comment-reply.created',
    'action:api.video-comment.deleted'
  ]

  for (const h of actionHooks) {
    registerHook({
      target: h,
      handler: () => peertubeHelpers.logger.debug('Run hook %s.', h)
    })
  }

  registerHook({
    target: 'filter:api.videos.list.params',
    handler: obj => addToCount(obj)
  })

  registerHook({
    target: 'filter:api.videos.list.result',
    handler: obj => ({ data: obj.data, total: obj.total + 1 })
  })

  registerHook({
    target: 'filter:api.video.get.result',
    handler: video => {
      video.name += ' <3'

      return video
    }
  })

  registerHook({
    target: 'filter:api.video.upload.accept.result',
    handler: ({ accepted }, { videoBody }) => {
      if (accepted !== false) return { accepted: true }
      if (videoBody.name.indexOf('bad word') !== -1) return { accepted: false, errorMessage: 'bad word '}

      return { accepted: true }
    }
  })
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ############################################################################

function addToCount (obj) {
  return Object.assign({}, obj, { count: obj.count + 1 })
}
