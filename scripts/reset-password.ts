import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { initDatabaseModels } from '../server/initializers/database'
import { UserModel } from '../server/models/account/user'
import { isUserPasswordValid } from '../server/helpers/custom-validators/users'

program
  .option('-u, --user [user]', 'User')
  .parse(process.argv)

if (program['user'] === undefined) {
  console.error('All parameters are mandatory.')
  process.exit(-1)
}

initDatabaseModels(true)
  .then(() => {
    return UserModel.loadByUsername(program['user'])
  })
  .then(user => {
    if (!user) {
      console.error('Unknown user.')
      process.exit(-1)
    }

    const readline = require('readline')
    const Writable = require('stream').Writable
    const mutableStdout = new Writable({
      write: function (chunk, encoding, callback) {
        callback()
      }
    })
    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    })

    console.log('New password?')
    rl.on('line', function (password) {
      if (!isUserPasswordValid(password)) {
        console.error('New password is invalid.')
        process.exit(-1)
      }

      user.password = password

      user.save()
        .then(() => console.log('User password updated.'))
        .catch(err => console.error(err))
        .finally(() => process.exit(0))
    })
  })
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })
