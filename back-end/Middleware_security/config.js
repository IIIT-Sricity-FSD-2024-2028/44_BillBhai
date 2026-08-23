"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { config } = require('./dist/config/config');
module.exports = config || require('./src/config/config').config;
