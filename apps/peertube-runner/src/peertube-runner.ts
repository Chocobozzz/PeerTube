#!/usr/bin/env node

import { Command, InvalidArgumentError } from '@commander-js/extra-typings'
import { RunnerJobType } from '@peertube/peertube-models'
import { listRegistered, registerRunner, unregisterRunner } from './register/index.js'
import { gracefulShutdown } from './register/shutdown.js'
import { RunnerServer } from './server/index.js'
import { getSupportedJobsList } from './server/shared/supported-job.js'
import { ConfigManager, logger } from './shared/index.js'

const program = new Command()
  .version(process.env.PACKAGE_VERSION)
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
  .option(
    '--enable-job <type>',
    'Enable this job type (multiple --enable-job options can be specified). ' +
    'By default all supported jobs are enabled). ' +
    'Supported job types: ' + getSupportedJobsList().join(', '),
    (value: RunnerJobType, previous: RunnerJobType[]) => [ ...previous, value ],
    []
  )
  .action(async options => {
    try {
      let enabledJobs: Set<RunnerJobType>

      if (options.enableJob) {
        for (const jobType of options.enableJob) {
          if (getSupportedJobsList().includes(jobType) !== true) {
            throw new InvalidArgumentError(`${jobType} is not a supported job`)
          }

          enabledJobs = new Set(options.enableJob)
        }
      }

      await new RunnerServer(enabledJobs).run()
    } catch (err) {
      logger.error(err, 'Cannot run PeerTube runner as server mode')
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
      console.error('Cannot register this PeerTube runner.')
      console.error(err)
      process.exit(-1)
    }
  })

program.command('unregister')
  .description('Unregister the runner from PeerTube instance')
  .requiredOption('--url <url>', 'PeerTube instance URL', parseUrl)
  .requiredOption('--runner-name <name>', 'Runner name')
  .action(async options => {
    try {
      await unregisterRunner(options)
    } catch (err) {
      console.error('Cannot unregister this PeerTube runner.')
      console.error(err)
      process.exit(-1)
    }
  })

program.command('list-registered')
  .description('List registered PeerTube instances')
  .action(async () => {
    try {
      await listRegistered()
    } catch (err) {
      console.error('Cannot list registered PeerTube instances.')
      console.error(err)
      process.exit(-1)
    }
  })

program.command('graceful-shutdown')
  .description('Exit runner when all processing tasks are finished')
  .action(async () => {
    try {
      await gracefulShutdown()
    } catch (err) {
      console.error('Cannot graceful shutdown the runner.')
      console.error(err)
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
