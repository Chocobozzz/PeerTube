async function register ({ transcodingManager }) {

  {
    const builder = () => {
      return {
        outputOptions: []
      }
    }

    transcodingManager.addVODProfile('libopus', 'test-vod-profile', builder)
    transcodingManager.addVODProfile('libvpx-vp9', 'test-vod-profile', builder)

    transcodingManager.addVODEncoderPriority('audio', 'libopus', 1000)
    transcodingManager.addVODEncoderPriority('video', 'libvpx-vp9', 1000)
  }

  {
    const builder = (options) => {
      return {
        outputOptions: [
          '-b:' + options.streamNum + ' 10K'
        ]
      }
    }

    transcodingManager.addLiveProfile('libopus', 'test-live-profile', builder)
    transcodingManager.addLiveEncoderPriority('audio', 'libopus', 1000)
  }
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}
