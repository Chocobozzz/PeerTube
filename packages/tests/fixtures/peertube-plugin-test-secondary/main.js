async function register ({
  registerHook,
  registerSetting,
  registerPrimaryHandler,
  registerWebSocketRoute,
  settingsManager,
  peertubeHelpers
}) {
  const { logger } = peertubeHelpers
  const role = peertubeHelpers.server.getProcessRole()

  registerPrimaryHandler({
    name: 'get-process-role',
    handler: payload => ({ role: peertubeHelpers.server.getProcessRole(), payload })
  })

  registerPrimaryHandler({
    name: 'fail',
    handler: () => {
      throw new Error('Primary handler failure')
    }
  })

  // Not awaited, so a failure cannot prevent the registration
  for (const name of [ 'get-process-role', 'fail', 'unknown' ]) {
    peertubeHelpers.server.callPrimary({ name, payload: { from: role } })
      .then(result => logger.info(`Primary handler ${name} called by ${role} answered: ${result.role} received ${result.payload.from}`))
      .catch(err => logger.info(`Primary handler ${name} called by ${role} failed: ${err.message}`))
  }

  registerWebSocketRoute({
    route: '/test',
    handler: (_request, socket) => socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
  })

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
