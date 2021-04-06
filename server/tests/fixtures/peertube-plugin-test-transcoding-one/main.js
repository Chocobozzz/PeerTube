async function register ({ transcodingManager }) {

  {
    const builder = () => {
      return {
        outputOptions: [
          '-r 10'
        ]
      }
    }

    transcodingManager.addVODProfile('libx264', 'low-vod', builder)
  }

  {
    const builder = () => {
      return {
        videoFilters: [
          'fps=10'
        ]
      }
    }

    transcodingManager.addVODProfile('libx264', 'video-filters-vod', builder)
  }

  {
    const builder = () => {
      return {
        inputOptions: [
          '-r 5'
        ]
      }
    }

    transcodingManager.addVODProfile('libx264', 'input-options-vod', builder)
  }

  {
    const builder = (options) => {
      return {
        outputOptions: [
          '-r:' + options.streamNum + ' 5'
        ]
      }
    }

    transcodingManager.addLiveProfile('libx264', 'low-live', builder)
  }

  {
    const builder = () => {
      return {
        inputOptions: [
          '-r 5'
        ]
      }
    }

    transcodingManager.addLiveProfile('libx264', 'input-options-live', builder)
  }
}


async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}
