import { Injectable, inject } from '@angular/core'
import { ServerService } from '../server'

@Injectable()
export class ServerConfigResolver {
  private server = inject(ServerService)

  resolve () {
    return this.server.getConfig()
  }
}
