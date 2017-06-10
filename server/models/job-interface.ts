import * as Sequelize from 'sequelize'

export namespace JobMethods {
  export type ListWithLimitCallback = (err: Error, jobInstances: JobInstance[]) => void
  export type ListWithLimit = (limit: number, state: string, callback: ListWithLimitCallback) => void
}

export interface JobClass {
  listWithLimit: JobMethods.ListWithLimit
}

export interface JobAttributes {
  state: string
  handlerName: string
  handlerInputData: object
}

export interface JobInstance extends JobClass, JobAttributes, Sequelize.Instance<JobAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface JobModel extends JobClass, Sequelize.Model<JobInstance, JobAttributes> {}
