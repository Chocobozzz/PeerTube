import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { initDatabaseModels, sequelizeTypescript } from '../server/initializers/database'
import { isUserUsernameValid } from '@server/helpers/custom-validators/users'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { AccountModel } from '@server/models/account/account'
import { ActorModel } from '@server/models/actor/actor'
import { sendUpdateActor } from '@server/lib/activitypub/send'
import { MChannelDefault } from '@server/types/models'

program
  .description('Transfer a channel from a local account to another')
  .arguments('<channel>')
  .option('--from [fromAccount]', 'Account currently owning the channel (username)')
  .option('--to [toAccount]', 'Account to transfer the channel to (username)')
  .parse(process.argv)

const options = program.opts()
options.channel = program.args[0]

if (options.from === undefined || options.to === undefined || options.channel === undefined) {
  console.error('All parameters are mandatory.')
  process.exit(-1)
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  if (isUserUsernameValid(options.from) === false) {
    console.error('%s is not a valid username.', options.from)
    return
  }

  if (isUserUsernameValid(options.to) === false) {
    console.error('%s is not a valid username.', options.to)
    return
  }

  await sequelizeTypescript.transaction(async t => {
    const from = await AccountModel.loadLocalByName(options.from)
    if (!from) throw new Error('Account not found')

    const to = await AccountModel.loadLocalByName(options.to)
    if (!to) throw new Error('Account not found')

    const channel = await VideoChannelModel.loadLocalByNameAndPopulateAccount(options.channel)
    if (!channel) throw new Error('Channel not found')
    const channelActor = await ActorModel.loadLocalByName(options.channel, t)
    if (channel.accountId !== from.id) throw new Error('Channel is not owned by the account in --from')

    channel.accountId = to.id
    channelActor.Account = to

    console.log('Updating channel…')
    const updatedChannel = await channel.save({ transaction: t }) as MChannelDefault
    console.log('Updating channel actor…')
    await channelActor.save({ transaction: t })
    console.log('Federating channel update…')
    await sendUpdateActor(updatedChannel, t)
  })
}
