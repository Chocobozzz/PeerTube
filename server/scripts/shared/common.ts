import prompts from 'prompts'

export async function askConfirmation (message: string) {
  const result = await prompts({
    type: 'confirm',
    name: 'confirm',
    message
  }, {
    onCancel: () => {
      process.exit(1)
    }
  })

  return result.confirm === true
}

export function displayPeerTubeMustBeStoppedWarning () {
  console.log(`/!\\ PeerTube must be stopped before running this script /!\\\n`)
}
