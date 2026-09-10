export type ProcessRole = 'primary' | 'secondary'

let processRole: ProcessRole

export function getProcessRole (): ProcessRole {
  if (!processRole) processRole = resolveProcessRole()

  return processRole
}

export function isSecondaryProcess () {
  return getProcessRole() === 'secondary'
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function resolveProcessRole (): ProcessRole {
  const value = getCLIRole() ?? process.env.PEERTUBE_PROCESS_ROLE

  if (!value || value === 'primary') return 'primary'
  if (value === 'secondary') return 'secondary'

  throw new Error(`Unknown PeerTube process role "${value}". Expected "primary" or "secondary".`)
}

function getCLIRole () {
  const args = process.argv.slice(2)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--role') return args[i + 1]

    if (args[i].startsWith('--role=')) return args[i].substring('--role='.length)
  }

  return undefined
}
