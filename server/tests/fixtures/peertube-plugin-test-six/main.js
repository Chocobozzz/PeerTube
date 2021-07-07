const fs = require('fs')
const path = require('path')

async function register ({
  storageManager,
  peertubeHelpers,
  getRouter
}) {
  const { logger } = peertubeHelpers

  {
    await storageManager.storeData('superkey', { value: 'toto' })
    await storageManager.storeData('anotherkey', { value: 'toto2' })

    const result = await storageManager.getData('superkey')
    logger.info('superkey stored value is %s', result.value)
  }

  {
    getRouter().get('/create-file', async (req, res) => {
      const basePath = peertubeHelpers.plugin.getDataDirectoryPath()

      fs.writeFile(path.join(basePath, 'Aladdin.txt'), 'Prince Ali', function (err) {
        if (err) return res.sendStatus(500)

        res.sendStatus(200)
      })
    })
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
