import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { JOB_STATES, JOB_CATEGORIES } from '../../initializers'

import { addMethodsToModel } from '../utils'
import {
  JobInstance,
  JobAttributes,

  JobMethods
} from './job-interface'
import { JobState } from '../../../shared/models/job.model'

let Job: Sequelize.Model<JobInstance, JobAttributes>
let listWithLimitByCategory: JobMethods.ListWithLimitByCategory

export default function defineJob (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Job = sequelize.define<JobInstance, JobAttributes>('Job',
    {
      state: {
        type: DataTypes.ENUM(values(JOB_STATES)),
        allowNull: false
      },
      category: {
        type: DataTypes.ENUM(values(JOB_CATEGORIES)),
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

  const classMethods = [ listWithLimitByCategory ]
  addMethodsToModel(Job, classMethods)

  return Job
}

// ---------------------------------------------------------------------------

listWithLimitByCategory = function (limit: number, state: JobState) {
  const query = {
    order: [
      [ 'id', 'ASC' ]
    ],
    limit: limit,
    where: {
      state
    }
  }

  return Job.findAll(query)
}
