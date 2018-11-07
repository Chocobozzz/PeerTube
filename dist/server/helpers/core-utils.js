"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt = require("bcrypt");
const createTorrent = require("create-torrent");
const crypto_1 = require("crypto");
const path_1 = require("path");
const pem = require("pem");
const url_1 = require("url");
const lodash_1 = require("lodash");
const child_process_1 = require("child_process");
const timeTable = {
    ms: 1,
    second: 1000,
    minute: 60000,
    hour: 3600000,
    day: 3600000 * 24,
    week: 3600000 * 24 * 7,
    month: 3600000 * 24 * 30
};
function parseDuration(duration) {
    if (typeof duration === 'number')
        return duration;
    if (typeof duration === 'string') {
        const split = duration.match(/^([\d\.,]+)\s?(\w+)$/);
        if (split.length === 3) {
            const len = parseFloat(split[1]);
            let unit = split[2].replace(/s$/i, '').toLowerCase();
            if (unit === 'm') {
                unit = 'ms';
            }
            return (len || 1) * (timeTable[unit] || 0);
        }
    }
    throw new Error('Duration could not be properly parsed');
}
exports.parseDuration = parseDuration;
function parseBytes(value) {
    if (typeof value === 'number')
        return value;
    const tgm = /^(\d+)\s*TB\s*(\d+)\s*GB\s*(\d+)\s*MB$/;
    const tg = /^(\d+)\s*TB\s*(\d+)\s*GB$/;
    const tm = /^(\d+)\s*TB\s*(\d+)\s*MB$/;
    const gm = /^(\d+)\s*GB\s*(\d+)\s*MB$/;
    const t = /^(\d+)\s*TB$/;
    const g = /^(\d+)\s*GB$/;
    const m = /^(\d+)\s*MB$/;
    const b = /^(\d+)\s*B$/;
    let match;
    if (value.match(tgm)) {
        match = value.match(tgm);
        return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024
            + parseInt(match[2], 10) * 1024 * 1024 * 1024
            + parseInt(match[3], 10) * 1024 * 1024;
    }
    else if (value.match(tg)) {
        match = value.match(tg);
        return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024
            + parseInt(match[2], 10) * 1024 * 1024 * 1024;
    }
    else if (value.match(tm)) {
        match = value.match(tm);
        return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024
            + parseInt(match[2], 10) * 1024 * 1024;
    }
    else if (value.match(gm)) {
        match = value.match(gm);
        return parseInt(match[1], 10) * 1024 * 1024 * 1024
            + parseInt(match[2], 10) * 1024 * 1024;
    }
    else if (value.match(t)) {
        match = value.match(t);
        return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024;
    }
    else if (value.match(g)) {
        match = value.match(g);
        return parseInt(match[1], 10) * 1024 * 1024 * 1024;
    }
    else if (value.match(m)) {
        match = value.match(m);
        return parseInt(match[1], 10) * 1024 * 1024;
    }
    else if (value.match(b)) {
        match = value.match(b);
        return parseInt(match[1], 10) * 1024;
    }
    else {
        return parseInt(value, 10);
    }
}
exports.parseBytes = parseBytes;
function sanitizeUrl(url) {
    const urlObject = new url_1.URL(url);
    if (urlObject.protocol === 'https:' && urlObject.port === '443') {
        urlObject.port = '';
    }
    else if (urlObject.protocol === 'http:' && urlObject.port === '80') {
        urlObject.port = '';
    }
    return urlObject.href.replace(/\/$/, '');
}
exports.sanitizeUrl = sanitizeUrl;
function sanitizeHost(host, remoteScheme) {
    const toRemove = remoteScheme === 'https' ? 443 : 80;
    return host.replace(new RegExp(`:${toRemove}$`), '');
}
exports.sanitizeHost = sanitizeHost;
function isTestInstance() {
    return process.env.NODE_ENV === 'test';
}
exports.isTestInstance = isTestInstance;
function isProdInstance() {
    return process.env.NODE_ENV === 'production';
}
exports.isProdInstance = isProdInstance;
function root() {
    const paths = [__dirname, '..', '..'];
    if (process.mainModule && process.mainModule.filename.endsWith('.ts') === false) {
        paths.push('..');
    }
    return path_1.join.apply(null, paths);
}
exports.root = root;
function escapeHTML(stringParam) {
    if (!stringParam)
        return '';
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    return String(stringParam).replace(/[&<>"'`=\/]/g, s => entityMap[s]);
}
exports.escapeHTML = escapeHTML;
function pageToStartAndCount(page, itemsPerPage) {
    const start = (page - 1) * itemsPerPage;
    return { start, count: itemsPerPage };
}
exports.pageToStartAndCount = pageToStartAndCount;
function buildPath(path) {
    if (path_1.isAbsolute(path))
        return path;
    return path_1.join(root(), path);
}
exports.buildPath = buildPath;
function peertubeTruncate(str, maxLength) {
    const options = {
        length: maxLength
    };
    const truncatedStr = lodash_1.truncate(str, options);
    if (truncatedStr.length <= maxLength)
        return truncatedStr;
    options.length -= truncatedStr.length - maxLength;
    return lodash_1.truncate(str, options);
}
exports.peertubeTruncate = peertubeTruncate;
function sha256(str, encoding = 'hex') {
    return crypto_1.createHash('sha256').update(str).digest(encoding);
}
exports.sha256 = sha256;
function promisify0(func) {
    return function promisified() {
        return new Promise((resolve, reject) => {
            func.apply(null, [(err, res) => err ? reject(err) : resolve(res)]);
        });
    };
}
exports.promisify0 = promisify0;
function promisify1(func) {
    return function promisified(arg) {
        return new Promise((resolve, reject) => {
            func.apply(null, [arg, (err, res) => err ? reject(err) : resolve(res)]);
        });
    };
}
exports.promisify1 = promisify1;
function promisify1WithVoid(func) {
    return function promisified(arg) {
        return new Promise((resolve, reject) => {
            func.apply(null, [arg, (err) => err ? reject(err) : resolve()]);
        });
    };
}
function promisify2(func) {
    return function promisified(arg1, arg2) {
        return new Promise((resolve, reject) => {
            func.apply(null, [arg1, arg2, (err, res) => err ? reject(err) : resolve(res)]);
        });
    };
}
function promisify2WithVoid(func) {
    return function promisified(arg1, arg2) {
        return new Promise((resolve, reject) => {
            func.apply(null, [arg1, arg2, (err) => err ? reject(err) : resolve()]);
        });
    };
}
const pseudoRandomBytesPromise = promisify1(crypto_1.pseudoRandomBytes);
exports.pseudoRandomBytesPromise = pseudoRandomBytesPromise;
const createPrivateKey = promisify1(pem.createPrivateKey);
exports.createPrivateKey = createPrivateKey;
const getPublicKey = promisify1(pem.getPublicKey);
exports.getPublicKey = getPublicKey;
const bcryptComparePromise = promisify2(bcrypt.compare);
exports.bcryptComparePromise = bcryptComparePromise;
const bcryptGenSaltPromise = promisify1(bcrypt.genSalt);
exports.bcryptGenSaltPromise = bcryptGenSaltPromise;
const bcryptHashPromise = promisify2(bcrypt.hash);
exports.bcryptHashPromise = bcryptHashPromise;
const createTorrentPromise = promisify2(createTorrent);
exports.createTorrentPromise = createTorrentPromise;
const execPromise2 = promisify2(child_process_1.exec);
exports.execPromise2 = execPromise2;
const execPromise = promisify1(child_process_1.exec);
exports.execPromise = execPromise;
