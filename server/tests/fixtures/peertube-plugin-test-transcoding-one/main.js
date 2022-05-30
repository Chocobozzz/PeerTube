async function register ({ transcodingManager }) {

  // Output options
  {
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
      const builder = (options) => {
        return {
          outputOptions: [
            '-r:' + options.streamNum + ' 5'
          ]
        }
      }

      transcodingManager.addLiveProfile('libx264', 'low-live', builder)
    }
  }

  // Input options
  {
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

  // Scale filters
  {
    {
      const builder = () => {
        return {
          scaleFilter: {
            name: 'Glomgold'
          }
        }
      }

      transcodingManager.addVODProfile('libx264', 'bad-scale-vod', builder)
    }

    {
      const builder = () => {
        return {
          scaleFilter: {
            name: 'Flintheart'
          }
        }
      }

      transcodingManager.addLiveProfile('libx264', 'bad-scale-live', builder)
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
