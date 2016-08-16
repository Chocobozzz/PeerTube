'use strict'

const parallel = require('async/parallel')

const utils = {
  listForApiWithCount: listForApiWithCount
}

function listForApiWithCount (query, start, count, sort, callback) {
  const self = this

  parallel([
    function (asyncCallback) {
      self.find(query).skip(start).limit(count).sort(sort).exec(asyncCallback)
    },
    function (asyncCallback) {
      self.count(query, asyncCallback)
    }
  ], function (err, results) {
    if (err) return callback(err)

    const data = results[0]
    const total = results[1]
    return callback(null, data, total)
  })
}

// ---------------------------------------------------------------------------

module.exports = utils
