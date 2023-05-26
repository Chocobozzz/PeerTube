import { Injectable } from '@angular/core'
import { ServerService } from '../server'

@Injectable()
export class ServerConfigResolver {
  constructor (private server: ServerService) {}

  resolve () {
    return this.server.getConfig()
  }
}
