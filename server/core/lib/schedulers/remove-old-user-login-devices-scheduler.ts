import { createLogger } from '../../helpers/logger.js'
import { SCHEDULER_INTERVALS_MS, USER_LOGIN_DEVICE_MAX_AGE } from '../../initializers/constants.js'
import { UserLoginDeviceModel } from '../../models/user/user-login-device.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('schedulers')

export class RemoveOldUserLoginDevicesScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_OLD_USER_LOGIN_DEVICES

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected internalExecute () {
    logger.info('Removing old user login devices.')

    const now = new Date()
    const beforeDate = new Date(now.getTime() - USER_LOGIN_DEVICE_MAX_AGE).toISOString()

    return UserLoginDeviceModel.removeOldDevices(beforeDate)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
