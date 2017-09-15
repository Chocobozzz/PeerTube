import * as Sequelize from 'sequelize'

import { SortType } from '../../helpers'
import { addMethodsToModel, getSortOnModel } from '../utils'
import { VideoInstance } from './video-interface'
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
  let video: VideoInstance

  video = this.Video

  return {
    id: this.id,
    videoId: this.videoId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    name: video.name,
    uuid: video.uuid,
    description: video.description,
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    nsfw: video.nsfw
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

listForApi = function (start: number, count: number, sort: SortType) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSortOnModel(sort.sortModel, sort.sortValue) ],
    include: [ { model: BlacklistedVideo['sequelize'].models.Video } ]
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
