import * as Sequelize from 'sequelize'

import { addMethodsToModel, getSort } from '../utils'
import {
  BlacklistedVideoClass,
  BlacklistedVideoInstance,
  BlacklistedVideoAttributes,

  BlacklistedVideoMethods
} from './video-blacklist-interface'

let BlacklistedVideo: Sequelize.Model<BlacklistedVideoInstance, BlacklistedVideoAttributes>
let toFormatedJSON: BlacklistedVideoMethods.ToFormatedJSON
let countTotal: BlacklistedVideoMethods.CountTotal
let list: BlacklistedVideoMethods.List
let listForApi: BlacklistedVideoMethods.ListForApi
let loadById: BlacklistedVideoMethods.LoadById
let loadByVideoId: BlacklistedVideoMethods.LoadByVideoId

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  BlacklistedVideo = sequelize.define<BlacklistedVideoInstance, BlacklistedVideoAttributes>('BlacklistedVideo',
    {},
    {
      indexes: [
        {
          fields: [ 'videoId' ],
          unique: true
        }
      ]
    }
  )

  const classMethods = [
    associate,

    countTotal,
    list,
    listForApi,
    loadById,
    loadByVideoId
  ]
  const instanceMethods = [
    toFormatedJSON
  ]
  addMethodsToModel(BlacklistedVideo, classMethods, instanceMethods)

  return BlacklistedVideo
}

// ------------------------------ METHODS ------------------------------

toFormatedJSON = function (this: BlacklistedVideoInstance) {
  return {
    id: this.id,
    videoId: this.videoId,
    createdAt: this.createdAt
  }
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  BlacklistedVideo.belongsTo(models.Video, {
    foreignKey: 'videoId',
    onDelete: 'cascade'
  })
}

countTotal = function (callback: BlacklistedVideoMethods.CountTotalCallback) {
  return BlacklistedVideo.count().asCallback(callback)
}

list = function (callback: BlacklistedVideoMethods.ListCallback) {
  return BlacklistedVideo.findAll().asCallback(callback)
}

listForApi = function (start: number, count: number, sort: string, callback: BlacklistedVideoMethods.ListForApiCallback) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ]
  }

  return BlacklistedVideo.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

loadById = function (id: number, callback: BlacklistedVideoMethods.LoadByIdCallback) {
  return BlacklistedVideo.findById(id).asCallback(callback)
}

loadByVideoId = function (id: string, callback: BlacklistedVideoMethods.LoadByIdCallback) {
  const query = {
    where: {
      videoId: id
    }
  }

  return BlacklistedVideo.find(query).asCallback(callback)
}
