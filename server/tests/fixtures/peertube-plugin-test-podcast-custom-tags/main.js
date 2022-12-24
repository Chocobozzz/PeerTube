async function register ({ registerHook, registerSetting, settingsManager, storageManager, peertubeHelpers }) {
  registerHook({
    target: 'filter:api.feed.podcast.channel.custom-tags.result',
    handler: (result, params) => {
      return result.concat([
        {
          name: "fooTag",
          attributes: { "bar": "baz" },
          value: "42",
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
    target: 'filter:api.feed.podcast.item.custom-tags.result',
    handler: (result, params) => {
      return result.concat([
        {
          name: "fizzTag",
          attributes: { "bar": "baz" },
          value: "21",
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
