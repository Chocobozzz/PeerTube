import { values } from 'lodash'
import * as Sequelize from 'sequelize'
import { JobCategory, JobState } from '../../../shared/models/job.model'
import { JOB_CATEGORIES, JOB_STATES } from '../../initializers'
import { addMethodsToModel, getSort } from '../utils'
import { JobAttributes, JobInstance, JobMethods } from './job-interface'

let Job: Sequelize.Model<JobInstance, JobAttributes>
let listWithLimitByCategory: JobMethods.ListWithLimitByCategory
let listForApi: JobMethods.ListForApi
let toFormattedJSON: JobMethods.ToFormattedJSON

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
          fields: [ 'state', 'category' ]
        }
      ]
    }
  )

  const classMethods = [
    listWithLimitByCategory,
    listForApi
  ]
  const instanceMethods = [
    toFormattedJSON
  ]
  addMethodsToModel(Job, classMethods, instanceMethods)

  return Job
}

toFormattedJSON = function (this: JobInstance) {
  return {
    id: this.id,
    state: this.state,
    category: this.category,
    handlerName: this.handlerName,
    handlerInputData: this.handlerInputData,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }
}

// ---------------------------------------------------------------------------

listWithLimitByCategory = function (limit: number, state: JobState, jobCategory: JobCategory) {
  const query = {
    order: [
      [ 'id', 'ASC' ]
    ],
    limit: limit,
    where: {
      state,
      category: jobCategory
    }
  }

  return Job.findAll(query)
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ]
  }

  return Job.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}
