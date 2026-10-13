async function register ({ registerHook, registerSetting, settingsManager, peertubeHelpers }) {
  const { logger } = peertubeHelpers

  registerSetting({
    name: 'suffix',
    label: 'Suffix appended to video names',
    type: 'input',
    default: '<3',
    private: false
  })

  registerHook({
    target: 'filter:api.video.get.result',
    handler: async video => {
      video.name += ' ' + await settingsManager.getSetting('suffix')

      return video
    }
  })

  registerHook({
    target: 'filter:api.videos.list.result',
    handler: result => {
      result.total = result.total + 1

      return result
    }
  })

  settingsManager.onSettingsChange(settings => {
    logger.info('Secondary test plugin settings changed, suffix is now ' + settings.suffix)
  })
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}
