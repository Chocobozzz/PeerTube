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
const multer = require("multer");
const initializers_1 = require("../initializers");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const path_1 = require("path");
const misc_1 = require("./custom-validators/misc");
function buildNSFWFilter(res, paramNSFW) {
    if (paramNSFW === 'true')
        return true;
    if (paramNSFW === 'false')
        return false;
    if (paramNSFW === 'both')
        return undefined;
    if (res.locals.oauth) {
        const user = res.locals.oauth.token.User;
        if (user.nsfwPolicy === 'do_not_list')
            return false;
        return undefined;
    }
    if (initializers_1.CONFIG.INSTANCE.DEFAULT_NSFW_POLICY === 'do_not_list')
        return false;
    return null;
}
exports.buildNSFWFilter = buildNSFWFilter;
function cleanUpReqFiles(req) {
    const files = req.files;
    if (!files)
        return;
    if (misc_1.isArray(files)) {
        files.forEach(f => utils_1.deleteFileAsync(f.path));
        return;
    }
    for (const key of Object.keys(files)) {
        const file = files[key];
        if (misc_1.isArray(file))
            file.forEach(f => utils_1.deleteFileAsync(f.path));
        else
            utils_1.deleteFileAsync(file.path);
    }
}
exports.cleanUpReqFiles = cleanUpReqFiles;
function getHostWithPort(host) {
    const splitted = host.split(':');
    if (splitted.length === 1) {
        if (initializers_1.REMOTE_SCHEME.HTTP === 'https')
            return host + ':443';
        return host + ':80';
    }
    return host;
}
exports.getHostWithPort = getHostWithPort;
function badRequest(req, res, next) {
    return res.type('json').status(400).end();
}
exports.badRequest = badRequest;
function createReqFiles(fieldNames, mimeTypes, destinations) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, destinations[file.fieldname]);
        },
        filename: (req, file, cb) => __awaiter(this, void 0, void 0, function* () {
            const extension = mimeTypes[file.mimetype] || path_1.extname(file.originalname);
            let randomString = '';
            try {
                randomString = yield utils_1.generateRandomString(16);
            }
            catch (err) {
                logger_1.logger.error('Cannot generate random string for file name.', { err });
                randomString = 'fake-random-string';
            }
            cb(null, randomString + extension);
        })
    });
    let fields = [];
    for (const fieldName of fieldNames) {
        fields.push({
            name: fieldName,
            maxCount: 1
        });
    }
    return multer({ storage }).fields(fields);
}
exports.createReqFiles = createReqFiles;
function isUserAbleToSearchRemoteURI(res) {
    const user = res.locals.oauth ? res.locals.oauth.token.User : undefined;
    return initializers_1.CONFIG.SEARCH.REMOTE_URI.ANONYMOUS === true ||
        (initializers_1.CONFIG.SEARCH.REMOTE_URI.USERS === true && user !== undefined);
}
exports.isUserAbleToSearchRemoteURI = isUserAbleToSearchRemoteURI;
