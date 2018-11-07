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
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const servers_1 = require("../../helpers/custom-validators/servers");
const server_1 = require("../../models/server/server");
const check_1 = require("express-validator/check");
const serverGetValidator = [
    check_1.body('host').custom(servers_1.isHostValid).withMessage('Should have a valid host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking serverGetValidator parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        const server = yield server_1.ServerModel.loadByHost(req.body.host);
        if (!server) {
            return res.status(404)
                .send({ error: 'Server host not found.' })
                .end();
        }
        res.locals.server = server;
        return next();
    })
];
exports.serverGetValidator = serverGetValidator;
