#!/usr/bin/env node

'use strict'

// TODO: document this script

const program = require('commander')

const db = require('../server/initializers/database')

program
  .option('-u, --user [user]', 'User')
  .option('-p, --password [new password]', 'New password')
  .parse(process.argv)

if (program.user === undefined || program.password === undefined) {
  console.error('All parameters are mandatory.')
  process.exit(-1)
}

db.init(true, function () {
  db.User.loadByUsername(program.user, function (err, user) {
    if (err) {
      console.error(err)
      return
    }

    if (!user) {
      console.error('User unknown.')
      return
    }

    user.password = program.password
    user.save().asCallback(function (err) {
      if (err) {
        console.error(err)
        return
      }

      console.log('User pasword updated.')
      process.exit(0)
    })
  })
})
