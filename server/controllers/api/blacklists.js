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
const validatorsBlacklists = middlewares.validators.blacklists

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
  admin.ensureIsAdmin,
  validatorsBlacklists.blacklistsRemove,
  removeVideoFromBlacklist
)

module.exports = router

function listBlacklist (req, res, next) {
  db.BlacklistedVideo.listForApi(req.query.start, req.query.count, req.query.sort, function (err, blacklistList, blacklistTotal) {
    if (err) return next(err)

    res.json(formatBlacklist(blacklistList, blacklistTotal))
  })
}

function removeVideoFromBlacklist (req, res, next) {
  waterfall([
    function loadBlacklist (callback) {
      db.BlacklistedVideo.loadByVideoId(req.params.id, callback)
    },

    function deleteBlacklistEntry (entry, callback) {
      entry.destroy().asCallback(callback)
    }
  ], function andFinally (err) {
    if (err) {
      logger.error('Errors when remove the video from the blacklist', { error: err })
      return next(err)
    }

    return res.sendStatus(204)
  })
}

function formatBlacklist (objects, objectsTotal) {
  const formatedObjects = []
  var json = ''

  objects.forEach((object) => {
    json = object.toFormatedJSON()
    if (json) {
      formatedObjects.push(blacklistObjectToJSON(object, object.Video))
    }
  })

  return {
    total: objectsTotal,
    data: formatedObjects
  }
}

function blacklistObjectToJSON (blacklist, video) {
  return {
    id: blacklist.id,
    videoId: blacklist.videoId,
    remoteId: video.remoteId,
    name: video.name,
    nsfw: video.nsfw,
    description: video.description,
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    createdAt: blacklist.createdAt,
    updatedAt: blacklist.updatedAt
  }
}
