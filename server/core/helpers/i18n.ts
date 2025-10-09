import { AVAILABLE_LOCALES, getCompleteLocale } from '@peertube/peertube-core-utils'
import { CONFIG } from '@server/initializers/config.js'
import { LANGUAGE_COOKIE_NAME, LANGUAGE_HEADER, SERVER_INTERNAL_LOCALES_BASE_PATH } from '@server/initializers/constants.js'
import { MUser } from '@server/types/models/index.js'
import Bluebird from 'bluebird'
import express from 'express'
import { readJson } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import i18next from 'i18next'
import ICU from 'i18next-icu'
import { join } from 'path'
import { logger } from './logger.js'

export async function initI18n () {
  const locales = await readdir(SERVER_INTERNAL_LOCALES_BASE_PATH)
  const resources: Record<string, Record<string, string>> = {}

  await Bluebird.map(locales, async locale => {
    const localePath = join(SERVER_INTERNAL_LOCALES_BASE_PATH, locale)

    const translation = await readJson(join(localePath, 'translation.json'))
    resources[locale] = { translation }
  }, { concurrency: 10 })

  return i18next.use(ICU)
    .init({
      resources,
      nsSeparator: false,
      keySeparator: false,

      // do not load a fallback
      fallbackLng: false
    })
    .then(() => logger.info('i18n initialized with locales: ' + Object.keys(resources).join(', ')))
}

// ---------------------------------------------------------------------------

export type TranslateFn = (key: string, context: Record<string, string | number>) => string

export function useI18n (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.t = (key: string, context: Record<string, string | number> = {}) => {
    // Use req special header language
    // Or user language
    // Or default language
    const language = guessLanguageFromReq(req, res)

    return t(key, language, context)
  }

  next()
}

export function guessLanguageFromReq (req: express.Request, res: express.Response) {
  return req.headers[LANGUAGE_HEADER] as string ||
    res.locals.oauth?.token?.User?.language ||
    req.acceptsLanguages(AVAILABLE_LOCALES) ||
    CONFIG.INSTANCE.DEFAULT_LANGUAGE
}

export function t (
  key: string,
  language: string,
  context: Record<string, string | number> = {}
) {
  if (!language) throw new Error('Language is required for translation')

  if (!i18next.isInitialized) {
    logger.warn('i18next is not initialized, translation will not work')

    return key
  }

  return i18next.t(key, { lng: getCompleteLocale(language), ...context })
}

export function tu (key: string, user: Pick<MUser, 'language' | 'getLanguage'>, context: Record<string, string | number> = {}) {
  return t(key, user.getLanguage(), context)
}

// ---------------------------------------------------------------------------

export function setClientLanguageCookie (res: express.Response, language: string) {
  if (language === null) {
    res.clearCookie(LANGUAGE_COOKIE_NAME)
    return
  }

  res.cookie(LANGUAGE_COOKIE_NAME, language, {
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 3600 * 24 * 90 // 3 months
  })
}

// ---------------------------------------------------------------------------

export const englishLanguage = 'en-US'
