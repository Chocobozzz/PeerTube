import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { JOB_STATES } from '../../initializers'

import { addMethodsToModel } from '../utils'
import {
  JobClass,
  JobInstance,
  JobAttributes,

  JobMethods
} from './job-interface'
import { JobState } from '../../../shared/models/job.model'

let Job: Sequelize.Model<JobInstance, JobAttributes>
let listWithLimit: JobMethods.ListWithLimit

export default function defineJob (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Job = sequelize.define<JobInstance, JobAttributes>('Job',
    {
      state: {
        type: DataTypes.ENUM(values(JOB_STATES)),
        allowNull: false
      },
      handlerName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      handlerInputData: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      indexes: [
        {
          fields: [ 'state' ]
        }
      ]
    }
  )

  const classMethods = [ listWithLimit ]
  addMethodsToModel(Job, classMethods)

  return Job
}

// ---------------------------------------------------------------------------

listWithLimit = function (limit: number, state: JobState, callback: JobMethods.ListWithLimitCallback) {
  const query = {
    order: [
      [ 'id', 'ASC' ]
    ],
    limit: limit,
    where: {
      state
    }
  }

  return Job.findAll(query).asCallback(callback)
}
