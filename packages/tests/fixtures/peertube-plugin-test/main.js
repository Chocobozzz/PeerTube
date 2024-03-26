async function register ({ registerHook, registerSetting, settingsManager, storageManager, peertubeHelpers }) {
  {
    const actionHooks = [
      'action:application.listening',
      'action:notifier.notification.created',

      'action:api.video.updated',
      'action:api.video.deleted',
      'action:api.video.uploaded',
      'action:api.video.viewed',

      'action:api.video.file-updated',

      'action:api.video-channel.created',
      'action:api.video-channel.updated',
      'action:api.video-channel.deleted',

      'action:api.live-video.created',
      'action:live.video.state.updated',

      'action:api.video-thread.created',
      'action:api.video-comment-reply.created',
      'action:api.video-comment.deleted',

      'action:api.video-caption.created',
      'action:api.video-caption.deleted',

      'action:api.user.blocked',
      'action:api.user.unblocked',
      'action:api.user.registered',
      'action:api.user.created',
      'action:api.user.deleted',
      'action:api.user.updated',
      'action:api.user.oauth2-got-token',

      'action:api.video-playlist-element.created'
    ]

    for (const h of actionHooks) {
      registerHook({
        target: h,
        handler: () => peertubeHelpers.logger.debug('Run hook %s.', h)
      })
    }

    for (const h of [ 'action:activity-pub.remote-video.created', 'action:activity-pub.remote-video.updated' ]) {
      registerHook({
        target: h,
        handler: ({ video, videoAPObject }) => {
          peertubeHelpers.logger.debug('Run hook %s - AP %s - video %s.', h, video.name, videoAPObject.name )
        }
      })
    }
  }

  registerHook({
    target: 'filter:api.videos.list.params',
    handler: obj => addToCount(obj)
  })

  registerHook({
    target: 'filter:api.videos.list.result',
    handler: obj => addToTotal(obj)
  })

  registerHook({
    target: 'filter:api.video-playlist.videos.list.params',
    handler: obj => addToCount(obj)
  })

  registerHook({
    target: 'filter:api.video-playlist.videos.list.result',
    handler: obj => addToTotal(obj)
  })

  registerHook({
    target: 'filter:api.accounts.videos.list.params',
    handler: obj => addToCount(obj)
  })

  registerHook({
    target: 'filter:api.accounts.videos.list.result',
    handler: obj => addToTotal(obj, 2)
  })

  registerHook({
    target: 'filter:api.video-channels.videos.list.params',
    handler: obj => addToCount(obj, 3)
  })

  registerHook({
    target: 'filter:api.video-channels.videos.list.result',
    handler: obj => addToTotal(obj, 3)
  })

  registerHook({
    target: 'filter:api.user.me.videos.list.params',
    handler: obj => addToCount(obj, 4)
  })

  registerHook({
    target: 'filter:api.user.me.videos.list.result',
    handler: obj => addToTotal(obj, 4)
  })

  registerHook({
    target: 'filter:api.user.me.get.result',
    handler: (result) => {
      result.customParam = 'Customized'

      return result
    }
  })

  registerHook({
    target: 'filter:api.user.me.subscription-videos.list.params',
    handler: obj => addToCount(obj)
  })

  registerHook({
    target: 'filter:api.user.me.subscription-videos.list.result',
    handler: obj => addToTotal(obj, 4)
  })

  registerHook({
    target: 'filter:api.video.get.result',
    handler: video => {
      video.name += ' <3'

      return video
    }
  })

  // ---------------------------------------------------------------------------

  registerHook({
    target: 'filter:api.video-channels.list.params',
    handler: obj => addToCount(obj, 1)
  })

  registerHook({
    target: 'filter:api.video-channels.list.result',
    handler: obj => addToTotal(obj, 1)
  })

  registerHook({
    target: 'filter:api.video-channel.get.result',
    handler: channel => {
      channel.name += ' <3'

      return channel
    }
  })

  // ---------------------------------------------------------------------------

  for (const hook of [ 'filter:api.video.upload.accept.result', 'filter:api.live-video.create.accept.result' ]) {
    registerHook({
      target: hook,
      handler: ({ accepted }, { videoBody, liveVideoBody }) => {
        if (!accepted) return { accepted: false }

        const name = videoBody
          ? videoBody.name
          : liveVideoBody.name

        if (name.indexOf('bad word') !== -1) return { accepted: false, errorMessage: 'bad word' }

        return { accepted: true }
      }
    })
  }

  registerHook({
    target: 'filter:api.video.update-file.accept.result',
    handler: ({ accepted }, { videoFile }) => {
      if (!accepted) return { accepted: false }
      if (videoFile.filename.includes('webm')) return { accepted: false, errorMessage: 'no webm' }

      return { accepted: true }
    }
  })

  registerHook({
    target: 'filter:api.video.pre-import-url.accept.result',
    handler: ({ accepted }, { videoImportBody }) => {
      if (!accepted) return { accepted: false }
      if (videoImportBody.targetUrl.includes('bad')) return { accepted: false, errorMessage: 'bad target url' }

      return { accepted: true }
    }
  })

  registerHook({
    target: 'filter:api.video.pre-import-torrent.accept.result',
    handler: ({ accepted }, { videoImportBody }) => {
      if (!accepted) return { accepted: false }
      if (videoImportBody.name.includes('bad torrent')) return { accepted: false, errorMessage: 'bad torrent' }

      return { accepted: true }
    }
  })

  registerHook({
    target: 'filter:api.video.post-import-url.accept.result',
    handler: ({ accepted }, { video }) => {
      if (!accepted) return { accepted: false }
      if (video.name.includes('bad word')) return { accepted: false, errorMessage: 'bad word' }

      return { accepted: true }
    }
  })

  registerHook({
    target: 'filter:api.video.post-import-torrent.accept.result',
    handler: ({ accepted }, { video }) => {
      if (!accepted) return { accepted: false }
      if (video.name.includes('bad word')) return { accepted: false, errorMessage: 'bad word' }

      return { accepted: true }
    }
  })

  registerHook({
    target: 'filter:api.video.user-import.accept.result',
    handler: ({ accepted }, { videoBody }) => {
      if (!accepted) return { accepted: false }
      if (videoBody.name === 'video 1') return { accepted: false, errorMessage: 'bad word' }

      return { accepted: true }
    }
  })

  // ---------------------------------------------------------------------------

  registerHook({
    target: 'filter:api.video-thread.create.accept.result',
    handler: ({ accepted }, { commentBody }) => checkCommentBadWord(accepted, commentBody)
  })

  registerHook({
    target: 'filter:api.video-comment-reply.create.accept.result',
    handler: ({ accepted }, { commentBody }) => checkCommentBadWord(accepted, commentBody)
  })

  registerHook({
    target: 'filter:activity-pub.remote-video-comment.create.accept.result',
    handler: ({ accepted }, { comment }) => checkCommentBadWord(accepted, comment)
  })

  // ---------------------------------------------------------------------------

  registerHook({
    target: 'filter:activity-pub.activity.context.build.result',
    handler: context => context.concat([ { recordedAt: 'https://schema.org/recordedAt' } ])
  })

  registerHook({
    target: 'filter:activity-pub.video.json-ld.build.result',
    handler: (jsonld, { video }) => ({ ...jsonld, videoName: video.name })
  })

  // ---------------------------------------------------------------------------

  registerHook({
    target: 'filter:api.video-threads.list.params',
    handler: obj => addToCount(obj)
  })

  registerHook({
    target: 'filter:api.video-threads.list.result',
    handler: obj => addToTotal(obj)
  })

  registerHook({
    target: 'filter:api.video-thread-comments.list.result',
    handler: obj => {
      obj.data.forEach(c => c.text += ' <3')

      return obj
    }
  })

  registerHook({
    target: 'filter:video.auto-blacklist.result',
    handler: (blacklisted, { video }) => {
      if (blacklisted) return true
      if (video.name.includes('please blacklist me')) return true

      return false
    }
  })

  {
    registerHook({
      target: 'filter:api.user.signup.allowed.result',
      handler: (result, params) => {
        if (params && params.body && params.body.email && params.body.email.includes('jma 1')) {
          return { allowed: false, errorMessage: 'No jma 1' }
        }

        return result
      }
    })

    registerHook({
      target: 'filter:api.user.request-signup.allowed.result',
      handler: (result, params) => {
        if (params && params.body && params.body.email && params.body.email.includes('jma 2')) {
          return { allowed: false, errorMessage: 'No jma 2' }
        }

        return result
      }
    })
  }

  registerHook({
    target: 'filter:api.download.torrent.allowed.result',
    handler: (result, params) => {
      if (params && params.downloadName.includes('bad torrent')) {
        return { allowed: false, errorMessage: 'Liu Bei' }
      }

      return result
    }
  })

  registerHook({
    target: 'filter:api.download.video.allowed.result',
    handler: async (result, params) => {
      const loggedInUser = await peertubeHelpers.user.getAuthUser(params.res)
      if (loggedInUser) return { allowed: true }

      if (params && !params.streamingPlaylist && params.video.name.includes('bad file')) {
        return { allowed: false, errorMessage: 'Cao Cao' }
      }

      if (params && params.streamingPlaylist && params.video.name.includes('bad playlist file')) {
        return { allowed: false, errorMessage: 'Sun Jian' }
      }

      return result
    }
  })

  // ---------------------------------------------------------------------------

  registerHook({
    target: 'filter:html.embed.video.allowed.result',
    handler: (result, params) => {
      return {
        allowed: false,
        html: 'Lu Bu'
      }
    }
  })

  registerHook({
    target: 'filter:html.embed.video-playlist.allowed.result',
    handler: (result, params) => {
      return {
        allowed: false,
        html: 'Diao Chan'
      }
    }
  })

  // ---------------------------------------------------------------------------

  registerHook({
    target: 'filter:html.client.json-ld.result',
    handler: (jsonld, context) => {
      if (!context || !context.video) return jsonld

      return Object.assign(jsonld, { recordedAt: 'http://example.com/recordedAt' })
    }
  })

  // ---------------------------------------------------------------------------

  registerHook({
    target: 'filter:api.server.stats.get.result',
    handler: (result) => {
      return { ...result, customStats: 14 }
    }
  })

  registerHook({
    target: 'filter:job-queue.process.params',
    handler: (object, context) => {
      if (context.type !== 'video-studio-edition') return object

      object.data.tasks = [
        {
          name: 'cut',
          options: {
            start: 0,
            end: 1
          }
        }
      ]

      return object
    }
  })

  registerHook({
    target: 'filter:transcoding.auto.resolutions-to-transcode.result',
    handler: (object, context) => {
      if (context.video.name.includes('transcode-filter')) {
        object = [ 100 ]
      }

      return object
    }
  })

  // Upload/import/live attributes
  for (const target of [
    'filter:api.video.upload.video-attribute.result',
    'filter:api.video.import-url.video-attribute.result',
    'filter:api.video.import-torrent.video-attribute.result',
    'filter:api.video.live.video-attribute.result',
    'filter:api.video.user-import.video-attribute.result'
  ]) {
    registerHook({
      target,
      handler: (result) => {
        return { ...result, description: result.description + ' - ' + target }
      }
    })
  }

  {
    const filterHooks = [
      'filter:api.search.videos.local.list.params',
      'filter:api.search.videos.local.list.result',
      'filter:api.search.videos.index.list.params',
      'filter:api.search.videos.index.list.result',
      'filter:api.search.video-channels.local.list.params',
      'filter:api.search.video-channels.local.list.result',
      'filter:api.search.video-channels.index.list.params',
      'filter:api.search.video-channels.index.list.result',
      'filter:api.search.video-playlists.local.list.params',
      'filter:api.search.video-playlists.local.list.result',
      'filter:api.search.video-playlists.index.list.params',
      'filter:api.search.video-playlists.index.list.result',

      'filter:api.overviews.videos.list.params',
      'filter:api.overviews.videos.list.result',

      'filter:job-queue.process.params',
      'filter:job-queue.process.result'
    ]

    for (const h of filterHooks) {
      registerHook({
        target: h,
        handler: (obj) => {
          peertubeHelpers.logger.debug('Run hook %s.', h)

          return obj
        }
      })
    }
  }
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ############################################################################

function addToCount (obj, amount = 1) {
  return Object.assign({}, obj, { count: obj.count + amount })
}

function addToTotal (result, amount = 1) {
  return {
    data: result.data,
    total: result.total + amount
  }
}

function checkCommentBadWord (accepted, commentBody) {
  if (!accepted) return { accepted: false }
  if (commentBody.text.indexOf('bad word') !== -1) return { accepted: false, errorMessage: 'bad word '}

  return { accepted: true }
}
