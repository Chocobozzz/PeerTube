"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path = require("path");
const winston = require("winston");
const initializers_1 = require("../initializers");
const label = initializers_1.CONFIG.WEBSERVER.HOSTNAME + ':' + initializers_1.CONFIG.WEBSERVER.PORT;
fs_extra_1.mkdirpSync(initializers_1.CONFIG.STORAGE.LOG_DIR);
function loggerReplacer(key, value) {
    if (value instanceof Error) {
        const error = {};
        Object.getOwnPropertyNames(value).forEach(key => error[key] = value[key]);
        return error;
    }
    return value;
}
const consoleLoggerFormat = winston.format.printf(info => {
    const obj = {
        meta: info.meta,
        err: info.err,
        sql: info.sql
    };
    let additionalInfos = JSON.stringify(obj, loggerReplacer, 2);
    if (additionalInfos === undefined || additionalInfos === '{}')
        additionalInfos = '';
    else
        additionalInfos = ' ' + additionalInfos;
    return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`;
});
exports.consoleLoggerFormat = consoleLoggerFormat;
const jsonLoggerFormat = winston.format.printf(info => {
    return JSON.stringify(info, loggerReplacer);
});
exports.jsonLoggerFormat = jsonLoggerFormat;
const timestampFormatter = winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
});
exports.timestampFormatter = timestampFormatter;
const labelFormatter = winston.format.label({
    label
});
exports.labelFormatter = labelFormatter;
const logger = winston.createLogger({
    level: initializers_1.CONFIG.LOG.LEVEL,
    format: winston.format.combine(labelFormatter, winston.format.splat()),
    transports: [
        new winston.transports.File({
            filename: path.join(initializers_1.CONFIG.STORAGE.LOG_DIR, 'peertube.log'),
            handleExceptions: true,
            maxsize: 1024 * 1024 * 12,
            maxFiles: 5,
            format: winston.format.combine(winston.format.timestamp(), jsonLoggerFormat)
        }),
        new winston.transports.Console({
            handleExceptions: true,
            format: winston.format.combine(timestampFormatter, winston.format.colorize(), consoleLoggerFormat)
        })
    ],
    exitOnError: true
});
exports.logger = logger;
function bunyanLogFactory(level) {
    return function () {
        let meta = null;
        let args = [];
        args.concat(arguments);
        if (arguments[0] instanceof Error) {
            meta = arguments[0].toString();
            args = Array.prototype.slice.call(arguments, 1);
            args.push(meta);
        }
        else if (typeof (args[0]) !== 'string') {
            meta = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
            args.push(meta);
        }
        logger[level].apply(logger, args);
    };
}
const bunyanLogger = {
    trace: bunyanLogFactory('debug'),
    debug: bunyanLogFactory('debug'),
    info: bunyanLogFactory('info'),
    warn: bunyanLogFactory('warn'),
    error: bunyanLogFactory('error'),
    fatal: bunyanLogFactory('error')
};
exports.bunyanLogger = bunyanLogger;
//# sourceMappingURL=logger.js.map