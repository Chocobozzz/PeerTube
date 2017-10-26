import * as Sequelize from 'sequelize'

import { isVideoChannelNameValid, isVideoChannelDescriptionValid } from '../../helpers'
import { removeVideoChannelToFriends } from '../../lib'

import { addMethodsToModel, getSort } from '../utils'
import {
  VideoChannelInstance,
  VideoChannelAttributes,

  VideoChannelMethods
} from './video-channel-interface'

let VideoChannel: Sequelize.Model<VideoChannelInstance, VideoChannelAttributes>
let toFormattedJSON: VideoChannelMethods.ToFormattedJSON
let toAddRemoteJSON: VideoChannelMethods.ToAddRemoteJSON
let toUpdateRemoteJSON: VideoChannelMethods.ToUpdateRemoteJSON
let isOwned: VideoChannelMethods.IsOwned
let countByAuthor: VideoChannelMethods.CountByAuthor
let listOwned: VideoChannelMethods.ListOwned
let listForApi: VideoChannelMethods.ListForApi
let listByAuthor: VideoChannelMethods.ListByAuthor
let loadByIdAndAuthor: VideoChannelMethods.LoadByIdAndAuthor
let loadByUUID: VideoChannelMethods.LoadByUUID
let loadAndPopulateAuthor: VideoChannelMethods.LoadAndPopulateAuthor
let loadByUUIDAndPopulateAuthor: VideoChannelMethods.LoadByUUIDAndPopulateAuthor
let loadByHostAndUUID: VideoChannelMethods.LoadByHostAndUUID
let loadAndPopulateAuthorAndVideos: VideoChannelMethods.LoadAndPopulateAuthorAndVideos

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  VideoChannel = sequelize.define<VideoChannelInstance, VideoChannelAttributes>('VideoChannel',
    {
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        validate: {
          isUUID: 4
        }
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          nameValid: value => {
            const res = isVideoChannelNameValid(value)
            if (res === false) throw new Error('Video channel name is not valid.')
          }
        }
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          descriptionValid: value => {
            const res = isVideoChannelDescriptionValid(value)
            if (res === false) throw new Error('Video channel description is not valid.')
          }
        }
      },
      remote: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      indexes: [
        {
          fields: [ 'authorId' ]
        }
      ],
      hooks: {
        afterDestroy
      }
    }
  )

  const classMethods = [
    associate,

    listForApi,
    listByAuthor,
    listOwned,
    loadByIdAndAuthor,
    loadAndPopulateAuthor,
    loadByUUIDAndPopulateAuthor,
    loadByUUID,
    loadByHostAndUUID,
    loadAndPopulateAuthorAndVideos,
    countByAuthor
  ]
  const instanceMethods = [
    isOwned,
    toFormattedJSON,
    toAddRemoteJSON,
    toUpdateRemoteJSON
  ]
  addMethodsToModel(VideoChannel, classMethods, instanceMethods)

  return VideoChannel
}

// ------------------------------ METHODS ------------------------------

isOwned = function (this: VideoChannelInstance) {
  return this.remote === false
}

toFormattedJSON = function (this: VideoChannelInstance) {
  const json = {
    id: this.id,
    uuid: this.uuid,
    name: this.name,
    description: this.description,
    isLocal: this.isOwned(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }

  if (this.Author !== undefined) {
    json['owner'] = {
      name: this.Author.name,
      uuid: this.Author.uuid
    }
  }

  if (Array.isArray(this.Videos)) {
    json['videos'] = this.Videos.map(v => v.toFormattedJSON())
  }

  return json
}

toAddRemoteJSON = function (this: VideoChannelInstance) {
  const json = {
    uuid: this.uuid,
    name: this.name,
    description: this.description,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ownerUUID: this.Author.uuid
  }

  return json
}

toUpdateRemoteJSON = function (this: VideoChannelInstance) {
  const json = {
    uuid: this.uuid,
    name: this.name,
    description: this.description,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ownerUUID: this.Author.uuid
  }

  return json
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  VideoChannel.belongsTo(models.Author, {
    foreignKey: {
      name: 'authorId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })

  VideoChannel.hasMany(models.Video, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

function afterDestroy (videoChannel: VideoChannelInstance) {
  if (videoChannel.isOwned()) {
    const removeVideoChannelToFriendsParams = {
      uuid: videoChannel.uuid
    }

    return removeVideoChannelToFriends(removeVideoChannelToFriendsParams)
  }

  return undefined
}

countByAuthor = function (authorId: number) {
  const query = {
    where: {
      authorId
    }
  }

  return VideoChannel.count(query)
}

listOwned = function () {
  const query = {
    where: {
      remote: false
    },
    include: [ VideoChannel['sequelize'].models.Author ]
  }

  return VideoChannel.findAll(query)
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [
      {
        model: VideoChannel['sequelize'].models.Author,
        required: true,
        include: [ { model: VideoChannel['sequelize'].models.Pod, required: false } ]
      }
    ]
  }

  return VideoChannel.findAndCountAll(query).then(({ rows, count }) => {
    return { total: count, data: rows }
  })
}

listByAuthor = function (authorId: number) {
  const query = {
    order: [ getSort('createdAt') ],
    include: [
      {
        model: VideoChannel['sequelize'].models.Author,
        where: {
          id: authorId
        },
        required: true,
        include: [ { model: VideoChannel['sequelize'].models.Pod, required: false } ]
      }
    ]
  }

  return VideoChannel.findAndCountAll(query).then(({ rows, count }) => {
    return { total: count, data: rows }
  })
}

loadByUUID = function (uuid: string, t?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<VideoChannelAttributes> = {
    where: {
      uuid
    }
  }

  if (t !== undefined) query.transaction = t

  return VideoChannel.findOne(query)
}

loadByHostAndUUID = function (fromHost: string, uuid: string, t?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<VideoChannelAttributes> = {
    where: {
      uuid
    },
    include: [
      {
        model: VideoChannel['sequelize'].models.Author,
        include: [
          {
            model: VideoChannel['sequelize'].models.Pod,
            required: true,
            where: {
              host: fromHost
            }
          }
        ]
      }
    ]
  }

  if (t !== undefined) query.transaction = t

  return VideoChannel.findOne(query)
}

loadByIdAndAuthor = function (id: number, authorId: number) {
  const options = {
    where: {
      id,
      authorId
    },
    include: [
      {
        model: VideoChannel['sequelize'].models.Author,
        include: [ { model: VideoChannel['sequelize'].models.Pod, required: false } ]
      }
    ]
  }

  return VideoChannel.findOne(options)
}

loadAndPopulateAuthor = function (id: number) {
  const options = {
    include: [
      {
        model: VideoChannel['sequelize'].models.Author,
        include: [ { model: VideoChannel['sequelize'].models.Pod, required: false } ]
      }
    ]
  }

  return VideoChannel.findById(id, options)
}

loadByUUIDAndPopulateAuthor = function (uuid: string) {
  const options = {
    where: {
      uuid
    },
    include: [
      {
        model: VideoChannel['sequelize'].models.Author,
        include: [ { model: VideoChannel['sequelize'].models.Pod, required: false } ]
      }
    ]
  }

  return VideoChannel.findOne(options)
}

loadAndPopulateAuthorAndVideos = function (id: number) {
  const options = {
    include: [
      {
        model: VideoChannel['sequelize'].models.Author,
        include: [ { model: VideoChannel['sequelize'].models.Pod, required: false } ]
      },
      VideoChannel['sequelize'].models.Video
    ]
  }

  return VideoChannel.findById(id, options)
}
