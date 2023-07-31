async function register ({ registerHook, registerSetting, settingsManager, storageManager, peertubeHelpers }) {
  registerHook({
    target: 'filter:feed.podcast.rss.create-custom-xmlns.result',
    handler: (result, params) => {
      return result.concat([
        {
          name: "biz",
          value: "https://example.com/biz-xmlns",
        },
      ])
    }
  })

  registerHook({
    target: 'filter:feed.podcast.channel.create-custom-tags.result',
    handler: (result, params) => {
      const { videoChannel } = params
      return result.concat([
        {
          name: "fooTag",
          attributes: { "bar": "baz" },
          value: "42",
        },
        {
          name: "biz:videoChannel",
          attributes: { "name": videoChannel.name, "id": videoChannel.id },
        },
        {
          name: "biz:buzzItem",
          value: [
            {
              name: "nestedTag",
              value: "example nested tag",
            },
          ],
        },
      ])
    }
  })

  registerHook({
    target: 'filter:feed.podcast.video.create-custom-tags.result',
    handler: (result, params) => {
      const { video, liveItem } = params
      return result.concat([
        {
          name: "fizzTag",
          attributes: { "bar": "baz" },
          value: "21",
        },
        {
          name: "biz:video",
          attributes: { "name": video.name, "id": video.id, "isLive": liveItem },
        },
        {
          name: "biz:buzz",
          value: [
            {
              name: "nestedTag",
              value: "example nested tag",
            },
          ],
        }
      ])
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
