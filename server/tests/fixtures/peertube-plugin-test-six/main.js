async function register ({
  storageManager,
  peertubeHelpers
}) {
  const { logger } = peertubeHelpers

  {
    await storageManager.storeData('superkey', { value: 'toto' })
    await storageManager.storeData('anotherkey', { value: 'toto2' })

    const result = await storageManager.getData('superkey')
    logger.info('superkey stored value is %s', result.value)
  }
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ###########################################################################
