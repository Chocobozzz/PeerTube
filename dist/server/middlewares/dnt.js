"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const advertiseDoNotTrack = (_, res, next) => {
    res.setHeader('Tk', 'N');
    return next();
};
exports.advertiseDoNotTrack = advertiseDoNotTrack;
