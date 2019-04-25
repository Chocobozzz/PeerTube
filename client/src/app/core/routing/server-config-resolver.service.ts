import { Injectable } from '@angular/core'
import { Resolve } from '@angular/router'
import { ServerService } from '@app/core/server'

@Injectable()
export class ServerConfigResolver implements Resolve<boolean> {
  constructor (
    private server: ServerService
  ) {}

  resolve () {
    // FIXME: directly returning this.server.configLoaded does not seem to work
    return new Promise<boolean>(res => {
      return this.server.configLoaded.subscribe(() => res(true))
    })
  }
}
