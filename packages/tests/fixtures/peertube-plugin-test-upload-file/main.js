const { stat } = require('fs/promises')

async function register ({ registerHook }) {
  for (const hook of [ 'filter:api.video.upload.accept.result', 'filter:api.video.update-file.accept.result' ]) {
    registerHook({
      target: hook,
      handler: async ({ accepted }, { videoFile }) => {
        if (!accepted) return { accepted: false }

        // Plugins expect the uploaded file on the local disk, even if it was streamed to object storage
        let size
        try {
          size = (await stat(videoFile.path)).size
        } catch {
          return { accepted: false, errorMessage: 'Uploaded file is not available locally' }
        }

        if (size !== videoFile.size) {
          return { accepted: false, errorMessage: `Local uploaded file has ${size} bytes instead of ${videoFile.size}` }
        }

        // uploadx sets originalname to the video name: use the original name sent by the client
        if (videoFile.metadata?.originalName?.includes('rejected-by-plugin')) {
          return { accepted: false, errorMessage: 'Rejected by plugin' }
        }

        return { accepted: true }
      }
    })
  }
}

async function unregister () {}

module.exports = {
  register,
  unregister
}
