"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const check_1 = require("express-validator/check");
const path_1 = require("path");
const core_utils_1 = require("../../helpers/core-utils");
const misc_1 = require("../../helpers/custom-validators/misc");
const videos_1 = require("../../helpers/custom-validators/videos");
const logger_1 = require("../../helpers/logger");
const initializers_1 = require("../../initializers");
const utils_1 = require("./utils");
const urlShouldStartWith = initializers_1.CONFIG.WEBSERVER.SCHEME + '://' + path_1.join(initializers_1.CONFIG.WEBSERVER.HOST, 'videos', 'watch') + '/';
const videoWatchRegex = new RegExp('([^/]+)$');
const isURLOptions = {
    require_host: true,
    require_tld: true
};
if (core_utils_1.isTestInstance()) {
    isURLOptions.require_tld = false;
}
const oembedValidator = [
    check_1.query('url').isURL(isURLOptions).withMessage('Should have a valid url'),
    check_1.query('maxwidth').optional().isInt().withMessage('Should have a valid max width'),
    check_1.query('maxheight').optional().isInt().withMessage('Should have a valid max height'),
    check_1.query('format').optional().isIn(['xml', 'json']).withMessage('Should have a valid format'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking oembed parameters', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (req.query.format !== undefined && req.query.format !== 'json') {
            return res.status(501)
                .json({ error: 'Requested format is not implemented on server.' })
                .end();
        }
        const startIsOk = req.query.url.startsWith(urlShouldStartWith);
        const matches = videoWatchRegex.exec(req.query.url);
        if (startIsOk === false || matches === null) {
            return res.status(400)
                .json({ error: 'Invalid url.' })
                .end();
        }
        const videoId = matches[1];
        if (misc_1.isIdOrUUIDValid(videoId) === false) {
            return res.status(400)
                .json({ error: 'Invalid video id.' })
                .end();
        }
        if (!(yield videos_1.isVideoExist(videoId, res)))
            return;
        return next();
    })
];
exports.oembedValidator = oembedValidator;
//# sourceMappingURL=oembed.js.map