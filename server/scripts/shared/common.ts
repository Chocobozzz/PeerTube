import prompt from 'prompt'

export async function askConfirmation (message: string) {
  return new Promise((res, rej) => {
    prompt.start()

    const schema = {
      properties: {
        confirm: {
          type: 'string',
          description: message + ' (y/n)',
          default: 'n',
          validator: /y[es]*|n[o]?/,
          warning: 'Must respond yes or no',
          required: true
        }
      }
    }

    prompt.get(schema, function (err, result) {
      if (err) return rej(err)

      return res(result.confirm?.match(/y/) !== null)
    })
  })
}

export function displayPeerTubeMustBeStoppedWarning () {
  console.log(`/!\\ PeerTube must be stopped before running this script /!\\\n`)
}
