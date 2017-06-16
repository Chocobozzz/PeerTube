import * as Sequelize from 'sequelize'

import { JobState } from '../../../shared/models/job.model'

export namespace JobMethods {
  export type ListWithLimitCallback = (err: Error, jobInstances: JobInstance[]) => void
  export type ListWithLimit = (limit: number, state: JobState, callback: ListWithLimitCallback) => void
}

export interface JobClass {
  listWithLimit: JobMethods.ListWithLimit
}

export interface JobAttributes {
  state: JobState
  handlerName: string
  handlerInputData: object
}

export interface JobInstance extends JobClass, JobAttributes, Sequelize.Instance<JobAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface JobModel extends JobClass, Sequelize.Model<JobInstance, JobAttributes> {}
