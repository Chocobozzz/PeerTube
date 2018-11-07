"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const readline_1 = require("readline");
const winston = require("winston");
const logger_1 = require("../server/helpers/logger");
const constants_1 = require("../server/initializers/constants");
program
    .option('-l, --level [level]', 'Level log (debug/info/warn/error)')
    .parse(process.argv);
const excludedKeys = {
    level: true,
    message: true,
    splat: true,
    timestamp: true,
    label: true
};
function keysExcluder(key, value) {
    return excludedKeys[key] === true ? undefined : value;
}
const loggerFormat = winston.format.printf((info) => {
    let additionalInfos = JSON.stringify(info, keysExcluder, 2);
    if (additionalInfos === '{}')
        additionalInfos = '';
    else
        additionalInfos = ' ' + additionalInfos;
    return `[${info.label}] ${toTimeFormat(info.timestamp)} ${info.level}: ${info.message}${additionalInfos}`;
});
const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            level: program['level'] || 'debug',
            stderrLevels: [],
            format: winston.format.combine(winston.format.splat(), logger_1.labelFormatter, winston.format.colorize(), loggerFormat)
        })
    ],
    exitOnError: true
});
const logLevels = {
    error: logger.error.bind(logger),
    warn: logger.warn.bind(logger),
    info: logger.info.bind(logger),
    debug: logger.debug.bind(logger)
};
const logFiles = fs_extra_1.readdirSync(constants_1.CONFIG.STORAGE.LOG_DIR);
const lastLogFile = getNewestFile(logFiles, constants_1.CONFIG.STORAGE.LOG_DIR);
const path = path_1.join(constants_1.CONFIG.STORAGE.LOG_DIR, lastLogFile);
console.log('Opening %s.', path);
const rl = readline_1.createInterface({
    input: fs_extra_1.createReadStream(path)
});
rl.on('line', line => {
    const log = JSON.parse(line);
    Object.assign(log, { splat: undefined });
    logLevels[log.level](log);
});
function toTimeFormat(time) {
    const timestamp = Date.parse(time);
    if (isNaN(timestamp) === true)
        return 'Unknown date';
    return new Date(timestamp).toISOString();
}
function getNewestFile(files, basePath) {
    const out = [];
    files.forEach(file => {
        const stats = fs_extra_1.statSync(basePath + '/' + file);
        if (stats.isFile())
            out.push({ file, mtime: stats.mtime.getTime() });
    });
    out.sort((a, b) => b.mtime - a.mtime);
    return (out.length > 0) ? out[0].file : '';
}
//# sourceMappingURL=parse-log.js.map