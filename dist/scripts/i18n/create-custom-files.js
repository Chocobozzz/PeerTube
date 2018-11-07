"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsToXliff12 = require("xliff/jsToXliff12");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const constants_1 = require("../../server/initializers/constants");
const lodash_1 = require("lodash");
const videojs = require(path_1.join(__dirname, '../../../client/src/locale/source/videojs_en_US.json'));
const playerKeys = {
    'Quality': 'Quality',
    'Auto': 'Auto',
    'Speed': 'Speed',
    'Subtitles/CC': 'Subtitles/CC',
    'peers': 'peers',
    'Go to the video page': 'Go to the video page',
    'Settings': 'Settings',
    'Uses P2P, others may know you are watching this video.': 'Uses P2P, others may know you are watching this video.',
    'Copy the video URL': 'Copy the video URL',
    'Copy the video URL at the current time': 'Copy the video URL at the current time',
    'Copy embed code': 'Copy embed code'
};
const playerTranslations = {
    target: path_1.join(__dirname, '../../../client/src/locale/source/player_en_US.xml'),
    data: Object.assign({}, videojs, playerKeys)
};
const serverKeys = {};
lodash_1.values(constants_1.VIDEO_CATEGORIES)
    .concat(lodash_1.values(constants_1.VIDEO_LICENCES))
    .concat(lodash_1.values(constants_1.VIDEO_PRIVACIES))
    .concat(lodash_1.values(constants_1.VIDEO_STATES))
    .concat(lodash_1.values(constants_1.VIDEO_IMPORT_STATES))
    .forEach(v => serverKeys[v] = v);
Object.assign(serverKeys, {
    'Misc': 'Misc',
    'Unknown': 'Unknown'
});
const serverTranslations = {
    target: path_1.join(__dirname, '../../../client/src/locale/source/server_en_US.xml'),
    data: serverKeys
};
const languageKeys = {};
const languages = constants_1.buildLanguages();
Object.keys(languages).forEach(k => languageKeys[languages[k]] = languages[k]);
const iso639Translations = {
    target: path_1.join(__dirname, '../../../client/src/locale/source/iso639_en_US.xml'),
    data: languageKeys
};
saveToXliffFile(playerTranslations, err => {
    if (err)
        return handleError(err);
    saveToXliffFile(serverTranslations, err => {
        if (err)
            return handleError(err);
        saveToXliffFile(iso639Translations, err => {
            if (err)
                return handleError(err);
            process.exit(0);
        });
    });
});
function saveToXliffFile(jsonTranslations, cb) {
    const obj = {
        resources: {
            namespace1: {}
        }
    };
    Object.keys(jsonTranslations.data).forEach(k => obj.resources.namespace1[k] = { source: jsonTranslations.data[k] });
    jsToXliff12(obj, (err, res) => {
        if (err)
            return cb(err);
        fs_extra_1.writeFile(jsonTranslations.target, res, err => {
            if (err)
                return cb(err);
            return cb(null);
        });
    });
}
function handleError(err) {
    console.error(err);
    process.exit(-1);
}
