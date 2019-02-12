import * as express from 'express'
import { createClient, Client, parseFilter } from 'ldapjs'
import { logger } from '../helpers/logger'
import { CONFIG } from '../initializers/config'

class Ldap {

  private static instance: Ldap
  private initialized = false
  private client: Client
  private prefix: string

  private constructor () {}

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    this.client = createClient(Ldap.getLdapClientOptions())
  }

  static getLdapClientOptions () {
    return Object.assign({}, {
      url: CONFIG.AUTH.LDAP.URL,
      reconnect: true,
      tlsOptions: { rejectUnauthorized: !CONFIG.AUTH.LDAP.INSECURE_TLS }
    })
  }

  getClient () {
    this.init()
    return this.client
  }

  findUser (username: string) {
    const filter = parseFilter(CONFIG.AUTH.LDAP.USER_FILTER)
    filter.forEach(function (element) {
      if (element.value === '%username%') element.value = username
    })
    const opts = {
      filter,
      scope: 'sub',
      attributes: [ CONFIG.AUTH.LDAP.MAIL_ENTRY, 'dn' ]
    }

    const client = this.getClient()

    return new Promise(function (resolve, reject) {
      client.bind(CONFIG.AUTH.LDAP.BIND_DN, CONFIG.AUTH.LDAP.BIND_PASSWORD, function (err) {
        if (err) reject(err)
        let entries = []
        client.search(CONFIG.AUTH.LDAP.BASE, opts, function (err, search) {
          if (err) reject(err)
          search.on('searchEntry', function (entry) {
            entries.push(entry.object)
          })
          search.on('end', function (result) {
            if (entries.length === 1) {
              resolve(entries[0])
            } else {
              reject("No user found corresponding to this username")
            }
          })
        })
      })
    })
  }

  checkUser (dn: string, password: string) {
    const client = this.getClient()
    return new Promise(function (resolve, reject) {
      client.bind(dn, password, function (err) {
        resolve(!err)
      })
    })
  }


  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Ldap
}
