#!/usr/bin/env node

import { Command, InvalidArgumentError } from '@commander-js/extra-typings'
import { listRegistered, registerRunner, unregisterRunner } from './register'
import { RunnerServer } from './server'
import { ConfigManager, logger } from './shared'

const packageJSON = require('./package.json')

const program = new Command()
  .version(packageJSON.version)
  .option(
    '--id <id>',
    'Runner server id, so you can run multiple PeerTube server runners with different configurations on the same machine',
    'default'
  )
  .option('--verbose', 'Run in verbose mode')
  .hook('preAction', thisCommand => {
    const options = thisCommand.opts()

    ConfigManager.Instance.init(options.id)

    if (options.verbose === true) {
      logger.level = 'debug'
    }
  })

program.command('server')
  .description('Run in server mode, to execute remote jobs of registered PeerTube instances')
  .action(async () => {
    try {
      await RunnerServer.Instance.run()
    } catch (err) {
      logger.error('Cannot run PeerTube runner as server mode', err)
      process.exit(-1)
    }
  })

program.command('register')
  .description('Register a new PeerTube instance to process runner jobs')
  .requiredOption('--url <url>', 'PeerTube instance URL', parseUrl)
  .requiredOption('--registration-token <token>', 'Runner registration token (can be found in PeerTube instance administration')
  .requiredOption('--runner-name <name>', 'Runner name')
  .option('--runner-description <description>', 'Runner description')
  .action(async options => {
    try {
      await registerRunner(options)
    } catch (err) {
      logger.error('Cannot register this PeerTube runner.', err)
      process.exit(-1)
    }
  })

program.command('unregister')
  .description('Unregister the runner from PeerTube instance')
  .requiredOption('--url <url>', 'PeerTube instance URL', parseUrl)
  .action(async options => {
    try {
      await unregisterRunner(options)
    } catch (err) {
      logger.error('Cannot unregister this PeerTube runner.', err)
      process.exit(-1)
    }
  })

program.command('list-registered')
  .description('List registered PeerTube instances')
  .action(async () => {
    try {
      await listRegistered()
    } catch (err) {
      logger.error('Cannot list registered PeerTube instances.', err)
      process.exit(-1)
    }
  })

program.parse()

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function parseUrl (url: string) {
  if (url.startsWith('http://') !== true && url.startsWith('https://') !== true) {
    throw new InvalidArgumentError('URL should start with a http:// or https://')
  }

  return url
}
