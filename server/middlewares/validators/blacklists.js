'use strict'

const checkErrors = require('./utils').checkErrors
const db = require('../../initializers/database')
const logger = require('../../helpers/logger')

const validatorsBlacklists = {
  blacklistsRemove
}

function blacklistsRemove (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isUUID(4)

  logger.debug('Checking blacklistsRemove request validator.', { parameters: req.params })

  checkErrors(req, res, function () {
    db.BlacklistedVideo.loadByVideoId(req.params.id, function (err, entry) {
      if (err) {
	logger.error('Error in blacklistsRemove request validator', { error: err })
	return res.sendStatus(500)
      }

      if (!entry) return res.status(404).send('Blacklisted video not found')

      next()
    })
  })
}

// ---------------------------------------------------------------------------

module.exports = validatorsBlacklists
