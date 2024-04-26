import {
  MyUser,
  RegisterClientFormFieldOptions,
  RegisterClientHookOptions,
  RegisterClientRouteOptions,
  RegisterClientSettingsScriptOptions,
  RegisterClientVideoFieldOptions,
  ServerConfig, SettingEntries
} from '@peertube/peertube-models'

export type RegisterClientOptions = {
  registerHook: (options: RegisterClientHookOptions) => void

  registerVideoField: (commonOptions: RegisterClientFormFieldOptions, videoFormOptions: RegisterClientVideoFieldOptions) => void

  registerSettingsScript: (options: RegisterClientSettingsScriptOptions) => void

  registerClientRoute: (options: RegisterClientRouteOptions) => void

  peertubeHelpers: RegisterClientHelpers
}

export type RegisterClientHelpers = {
  getBaseStaticRoute: () => string

  getBaseRouterRoute: () => string

  // PeerTube >= 5.0
  getBaseWebSocketRoute: () => string

  getBasePluginClientPath: () => string

  isLoggedIn: () => boolean

  getAuthHeader: () => { 'Authorization': string } | undefined

  getSettings: () => Promise<SettingEntries>

  getUser: () => MyUser

  getServerConfig: () => Promise<ServerConfig>

  notifier: {
    info: (text: string, title?: string, timeout?: number) => void
    error: (text: string, title?: string, timeout?: number) => void
    success: (text: string, title?: string, timeout?: number) => void
  }

  showModal: (input: {
    title: string
    content: string
    close?: boolean
    cancel?: { value: string, action?: () => void }
    confirm?: { value: string, action?: () => void }
  }) => void

  markdownRenderer: {
    textMarkdownToHTML: (textMarkdown: string) => Promise<string>
    enhancedMarkdownToHTML: (enhancedMarkdown: string) => Promise<string>
  }

  translate: (toTranslate: string) => Promise<string>
}
