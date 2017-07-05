import * as Sequelize from 'sequelize'

import {
  VideoTagInstance,
  VideoTagAttributes
} from './video-tag-interface'

let VideoTag: Sequelize.Model<VideoTagInstance, VideoTagAttributes>

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  VideoTag = sequelize.define<VideoTagInstance, VideoTagAttributes>('VideoTag', {}, {
    indexes: [
      {
        fields: [ 'videoId' ]
      },
      {
        fields: [ 'tagId' ]
      }
    ]
  })

  return VideoTag
}
