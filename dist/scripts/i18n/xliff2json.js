"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const xliff12ToJs = require("xliff/xliff12ToJs");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const i18n_1 = require("../../shared/models/i18n/i18n");
const async_1 = require("async");
const sources = [];
const availableLocales = Object.keys(i18n_1.I18N_LOCALES)
    .filter(l => i18n_1.isDefaultLocale(l) === false)
    .map(l => i18n_1.buildFileLocale(l));
for (const file of ['player', 'server', 'iso639']) {
    for (const locale of availableLocales) {
        sources.push(path_1.join(__dirname, '../../../client/src/locale/target/', `${file}_${locale}.xml`));
    }
}
async_1.eachSeries(sources, (source, cb) => {
    xliffFile2JSON(source, cb);
}, err => {
    if (err)
        return handleError(err);
    mergeISO639InServer(err => {
        if (err)
            return handleError(err);
        process.exit(0);
    });
});
function handleError(err) {
    console.error(err);
    process.exit(-1);
}
function xliffFile2JSON(filePath, cb) {
    const fileTarget = filePath.replace('.xml', '.json');
    let fileContent = fs_extra_1.readFileSync(filePath).toString();
    fileContent = removeFirstLine(fileContent);
    fileContent = removeFirstLine(fileContent);
    xliff12ToJs(fileContent, (err, res) => {
        if (err)
            return cb(err);
        const json = createJSONString(res);
        fs_extra_1.writeFile(fileTarget, json, err => {
            if (err)
                return cb(err);
            return fs_extra_1.unlink(filePath, cb);
        });
    });
}
function mergeISO639InServer(cb) {
    async_1.eachSeries(availableLocales, (locale, eachCallback) => {
        const serverPath = path_1.join(__dirname, '../../../client/src/locale/target/', `server_${locale}.json`);
        const iso639Path = path_1.join(__dirname, '../../../client/src/locale/target/', `iso639_${locale}.json`);
        const resServer = fs_extra_1.readFileSync(serverPath).toString();
        const resISO639 = fs_extra_1.readFileSync(iso639Path).toString();
        const jsonServer = JSON.parse(resServer);
        const jsonISO639 = JSON.parse(resISO639);
        Object.assign(jsonServer, jsonISO639);
        const serverString = JSON.stringify(jsonServer);
        fs_extra_1.writeFile(serverPath, serverString, err => {
            if (err)
                return eachCallback(err);
            return fs_extra_1.unlink(iso639Path, eachCallback);
        });
    }, cb);
}
function removeFirstLine(str) {
    return str.substring(str.indexOf('\n') + 1);
}
function createJSONString(obj) {
    const res = {};
    const strings = obj.resources[''];
    Object.keys(strings).forEach(k => res[k] = strings[k].target);
    return JSON.stringify(res);
}
