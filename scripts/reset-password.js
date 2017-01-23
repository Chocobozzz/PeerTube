#!/usr/bin/env node

'use strict'

// TODO: document this script

const program = require('commander')

const db = require('../server/initializers/database')

program
  .option('-u, --user [user]', 'User')
  .parse(process.argv)

if (program.user === undefined) {
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
      user.password = password

      user.save().asCallback(function (err) {
        if (err) {
          console.error(err)
        } else {
          console.log('User password updated.')
        }

        process.exit(0)
      })
    })
  })
})
