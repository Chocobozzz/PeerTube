'use strict'

const express = require('express')

const constants = require('../../initializers/constants')
const db = require('../../initializers/database')
const logger = require('../../helpers/logger')
const utils = require('../../helpers/utils')
const middlewares = require('../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const pagination = middlewares.pagination
const sort = middlewares.sort
const validatorsPagination = middlewares.validators.pagination
const validatorsSort = middlewares.validators.sort

const router = express.Router()

router.get('/',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validatorsPagination.pagination,
  validatorsSort.blacklistsSort,
  sort.setBlacklistsSort,
  pagination.setPagination,
  listBlacklist
)

router.delete('/:id',
  oAuth.authenticate,
  admin.ensureIsAdmin
)

module.exports = router

function listBlacklist (req, res, next) {
  db.BlacklistedVideo.listForApi(req.query.start, req.query.count, req.query.sort, function (err, blacklistList, blacklistTotal) {
    if (err) return next(err)

    res.json(utils.getFormatedObjects(blacklistList, blacklistTotal))
  })
}
