import express from 'express'
import { param } from 'express-validator'
import { SITEMAP } from '../../initializers/constants.js'
import { areValidationErrors } from './shared/index.js'

export const sitemapPageValidator = [
  param('page')
    .isInt({ min: 1, max: SITEMAP.MAX_PAGE, allow_leading_zeroes: false }).withMessage('Should have a valid page number')
    .toInt(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]
