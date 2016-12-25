/*
  This is just an example.
*/

const db = require('../database')

// options contains the transaction
exports.up = function (options, callback) {
  // db.Application.create({ migrationVersion: 42 }, { transaction: options.transaction }).asCallback(callback)
}

exports.down = function (options, callback) {
  throw new Error('Not implemented.')
}
