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
const express = require("express");
const path_1 = require("path");
const core_utils_1 = require("../helpers/core-utils");
const initializers_1 = require("../initializers");
const middlewares_1 = require("../middlewares");
const i18n_1 = require("../../shared/models/i18n/i18n");
const client_html_1 = require("../lib/client-html");
const logger_1 = require("../helpers/logger");
const clientsRouter = express.Router();
exports.clientsRouter = clientsRouter;
const distPath = path_1.join(core_utils_1.root(), 'client', 'dist');
const assetsImagesPath = path_1.join(core_utils_1.root(), 'client', 'dist', 'assets', 'images');
const embedPath = path_1.join(distPath, 'standalone', 'videos', 'embed.html');
const testEmbedPath = path_1.join(distPath, 'standalone', 'videos', 'test-embed.html');
clientsRouter.use('/videos/watch/:id', middlewares_1.asyncMiddleware(generateWatchHtmlPage));
clientsRouter.use('' +
    '/videos/embed', (req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.sendFile(embedPath);
});
clientsRouter.use('' +
    '/videos/test-embed', (req, res, next) => {
    res.sendFile(testEmbedPath);
});
const staticClientFiles = [
    'manifest.webmanifest',
    'ngsw-worker.js',
    'ngsw.json'
];
for (const staticClientFile of staticClientFiles) {
    const path = path_1.join(core_utils_1.root(), 'client', 'dist', staticClientFile);
    clientsRouter.use('/' + staticClientFile, express.static(path, { maxAge: initializers_1.STATIC_MAX_AGE }));
}
clientsRouter.use('/client', express.static(distPath, { maxAge: initializers_1.STATIC_MAX_AGE }));
clientsRouter.use('/client/assets/images', express.static(assetsImagesPath, { maxAge: initializers_1.STATIC_MAX_AGE }));
clientsRouter.use('/client/locales/:locale/:file.json', function (req, res) {
    const locale = req.params.locale;
    const file = req.params.file;
    if (i18n_1.is18nLocale(locale) && i18n_1.LOCALE_FILES.indexOf(file) !== -1) {
        const completeLocale = i18n_1.getCompleteLocale(locale);
        const completeFileLocale = i18n_1.buildFileLocale(completeLocale);
        return res.sendFile(path_1.join(__dirname, `../../../client/dist/locale/${file}_${completeFileLocale}.json`));
    }
    return res.sendStatus(404);
});
clientsRouter.use('/client/*', (req, res, next) => {
    res.sendStatus(404);
});
clientsRouter.use('/(:language)?', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.accepts(initializers_1.ACCEPT_HEADERS) === 'html') {
            try {
                yield generateHTMLPage(req, res, req.params.language);
                return;
            }
            catch (err) {
                logger_1.logger.error('Cannot generate HTML page.', err);
            }
        }
        return res.status(404).end();
    });
});
function generateHTMLPage(req, res, paramLang) {
    return __awaiter(this, void 0, void 0, function* () {
        const html = yield client_html_1.ClientHtml.getIndexHTML(req, res, paramLang);
        return sendHTML(html, res);
    });
}
function generateWatchHtmlPage(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const html = yield client_html_1.ClientHtml.getWatchHTMLPage(req.params.id + '', req, res);
        return sendHTML(html, res);
    });
}
function sendHTML(html, res) {
    res.set('Content-Type', 'text/html; charset=UTF-8');
    return res.send(html);
}
//# sourceMappingURL=client.js.map