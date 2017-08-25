import * as Sequelize from 'sequelize'

import { addMethodsToModel, getSort } from '../utils'
import {
  BlacklistedVideoInstance,
  BlacklistedVideoAttributes,

  BlacklistedVideoMethods
} from './video-blacklist-interface'

let BlacklistedVideo: Sequelize.Model<BlacklistedVideoInstance, BlacklistedVideoAttributes>
let toFormattedJSON: BlacklistedVideoMethods.ToFormattedJSON
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
    toFormattedJSON
  ]
  addMethodsToModel(BlacklistedVideo, classMethods, instanceMethods)

  return BlacklistedVideo
}

// ------------------------------ METHODS ------------------------------

toFormattedJSON = function (this: BlacklistedVideoInstance) {
  return {
    id: this.id,
    videoId: this.videoId,
    createdAt: this.createdAt
  }
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  BlacklistedVideo.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

countTotal = function () {
  return BlacklistedVideo.count()
}

list = function () {
  return BlacklistedVideo.findAll()
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ]
  }

  return BlacklistedVideo.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

loadById = function (id: number) {
  return BlacklistedVideo.findById(id)
}

loadByVideoId = function (id: number) {
  const query = {
    where: {
      videoId: id
    }
  }

  return BlacklistedVideo.findOne(query)
}
