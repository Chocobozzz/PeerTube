import * as Sequelize from 'sequelize'

import { addMethodsToModel } from './utils'
import {
  VideoTagClass,
  VideoTagInstance,
  VideoTagAttributes,

  VideoTagMethods
} from './video-tag-interface'

let VideoTag: Sequelize.Model<VideoTagInstance, VideoTagAttributes>

export default function (sequelize, DataTypes) {
  VideoTag = sequelize.define('VideoTag', {}, {
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
