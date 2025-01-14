import { filter, throttleTime } from 'rxjs'
import { Injectable } from '@angular/core'
import { AuthService, AuthStatus } from '@app/core/auth'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { NSFWPolicyType, UserRoleType, UserUpdateMe } from '@peertube/peertube-models'
import { getBoolOrDefault } from '@root-helpers/local-storage-utils'
import { logger } from '@root-helpers/logger'
import { OAuthUserTokens, UserLocalStorageKeys } from '@root-helpers/users'
import { ServerService } from '../server'
import { LocalStorageService } from '../wrappers/storage.service'

@Injectable()
export class UserLocalStorageService {

  constructor (
    private authService: AuthService,
    private server: ServerService,
    private localStorageService: LocalStorageService
  ) {
    this.authService.userInformationLoaded.subscribe({
      next: () => {
        const user = this.authService.getUser()

        this.setLoggedInUser(user)
        this.setUserInfo(user)
        this.setTokens(user.oauthTokens)
      }
    })

    this.authService.loginChangedSource
      .pipe(filter(status => status === AuthStatus.LoggedOut))
      .subscribe({
        next: () => {
          this.flushLoggedInUser()
          this.flushUserInfo()
          this.flushTokens()
        }
      })

    this.authService.tokensRefreshed
      .subscribe({
        next: () => {
          const user = this.authService.getUser()

          this.setTokens(user.oauthTokens)
        }
      })
  }

  // ---------------------------------------------------------------------------

  getLoggedInUser () {
    const usernameLocalStorage = this.localStorageService.getItem(UserLocalStorageKeys.USERNAME)

    if (!usernameLocalStorage) return undefined

    return {
      id: parseInt(this.localStorageService.getItem(UserLocalStorageKeys.ID), 10),
      username: this.localStorageService.getItem(UserLocalStorageKeys.USERNAME),
      email: this.localStorageService.getItem(UserLocalStorageKeys.EMAIL),
      role: {
        id: parseInt(this.localStorageService.getItem(UserLocalStorageKeys.ROLE), 10) as UserRoleType,
        label: ''
      },

      ...this.getUserInfo()
    }
  }

  setLoggedInUser (user: {
    id: number
    username: string
    email: string
    role: {
      id: UserRoleType
    }
  }) {
    this.localStorageService.setItem(UserLocalStorageKeys.ID, user.id.toString())
    this.localStorageService.setItem(UserLocalStorageKeys.USERNAME, user.username)
    this.localStorageService.setItem(UserLocalStorageKeys.EMAIL, user.email)
    this.localStorageService.setItem(UserLocalStorageKeys.ROLE, user.role.id.toString())
  }

  flushLoggedInUser () {
    this.localStorageService.removeItem(UserLocalStorageKeys.ID)
    this.localStorageService.removeItem(UserLocalStorageKeys.USERNAME)
    this.localStorageService.removeItem(UserLocalStorageKeys.EMAIL)
    this.localStorageService.removeItem(UserLocalStorageKeys.ROLE)
  }

  // ---------------------------------------------------------------------------

  getUserInfo () {
    let videoLanguages: string[]

    try {
      const languagesString = this.localStorageService.getItem(UserLocalStorageKeys.VIDEO_LANGUAGES)
      videoLanguages = languagesString && languagesString !== 'undefined'
        ? JSON.parse(languagesString)
        : null
    } catch (err) {
      videoLanguages = null
      logger.error('Cannot parse desired video languages from localStorage.', err)
    }

    const htmlConfig = this.server.getHTMLConfig()

    const defaultNSFWPolicy = htmlConfig.instance.defaultNSFWPolicy
    const defaultP2PEnabled = htmlConfig.defaults.p2p.webapp.enabled
    const defaultAutoPlay = htmlConfig.defaults.player.autoPlay

    return {
      nsfwPolicy: this.localStorageService.getItem<NSFWPolicyType>(UserLocalStorageKeys.NSFW_POLICY) || defaultNSFWPolicy,
      p2pEnabled: getBoolOrDefault(this.localStorageService.getItem(UserLocalStorageKeys.P2P_ENABLED), defaultP2PEnabled),
      theme: this.localStorageService.getItem(UserLocalStorageKeys.THEME) || 'instance-default',
      videoLanguages,

      autoPlayVideo: getBoolOrDefault(this.localStorageService.getItem(UserLocalStorageKeys.AUTO_PLAY_VIDEO), defaultAutoPlay),
      autoPlayNextVideo: getBoolOrDefault(this.localStorageService.getItem(UserLocalStorageKeys.AUTO_PLAY_NEXT_VIDEO), false),
      autoPlayNextVideoPlaylist: getBoolOrDefault(this.localStorageService.getItem(UserLocalStorageKeys.AUTO_PLAY_VIDEO_PLAYLIST), true)
    }
  }

  setUserInfo (profile: UserUpdateMe) {
    const localStorageKeys = {
      nsfwPolicy: UserLocalStorageKeys.NSFW_POLICY,
      p2pEnabled: UserLocalStorageKeys.P2P_ENABLED,
      autoPlayVideo: UserLocalStorageKeys.AUTO_PLAY_VIDEO,
      autoPlayNextVideo: UserLocalStorageKeys.AUTO_PLAY_NEXT_VIDEO,
      autoPlayNextVideoPlaylist: UserLocalStorageKeys.AUTO_PLAY_VIDEO_PLAYLIST,
      theme: UserLocalStorageKeys.THEME,
      videoLanguages: UserLocalStorageKeys.VIDEO_LANGUAGES
    }

    const obj: [ string, string | boolean | string[] ][] = objectKeysTyped(localStorageKeys)
      .filter(key => key in profile)
      .map(key => ([ localStorageKeys[key], profile[key] ]))

    for (const [ key, value ] of obj) {
      try {
        if (value === undefined) {
          this.localStorageService.removeItem(key)
          continue
        }

        const localStorageValue = typeof value === 'string'
          ? value
          : JSON.stringify(value)

        this.localStorageService.setItem(key, localStorageValue)
      } catch (err) {
        logger.error(`Cannot set ${key}->${value} in localStorage. Likely due to a value impossible to stringify.`, err)
      }
    }
  }

  flushUserInfo () {
    this.localStorageService.removeItem(UserLocalStorageKeys.NSFW_POLICY)
    this.localStorageService.removeItem(UserLocalStorageKeys.P2P_ENABLED)
    this.localStorageService.removeItem(UserLocalStorageKeys.AUTO_PLAY_VIDEO)
    this.localStorageService.removeItem(UserLocalStorageKeys.AUTO_PLAY_VIDEO_PLAYLIST)
    this.localStorageService.removeItem(UserLocalStorageKeys.THEME)
    this.localStorageService.removeItem(UserLocalStorageKeys.VIDEO_LANGUAGES)
  }

  listenUserInfoChange () {
    return this.localStorageService.watch([
      UserLocalStorageKeys.NSFW_POLICY,
      UserLocalStorageKeys.P2P_ENABLED,
      UserLocalStorageKeys.AUTO_PLAY_VIDEO,
      UserLocalStorageKeys.AUTO_PLAY_NEXT_VIDEO,
      UserLocalStorageKeys.AUTO_PLAY_VIDEO_PLAYLIST,
      UserLocalStorageKeys.THEME,
      UserLocalStorageKeys.VIDEO_LANGUAGES
    ]).pipe(
      throttleTime(200),
      filter(() => this.authService.isLoggedIn() !== true)
    )
  }

  // ---------------------------------------------------------------------------

  getTokens () {
    return OAuthUserTokens.getUserTokens(this.localStorageService)
  }

  setTokens (tokens: OAuthUserTokens) {
    OAuthUserTokens.saveToLocalStorage(this.localStorageService, tokens)
  }

  flushTokens () {
    OAuthUserTokens.flushLocalStorage(this.localStorageService)
  }
}
