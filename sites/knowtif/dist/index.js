#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const action_1 = require("./lib/action");
const setup_1 = require("./lib/setup");
const panel_1 = require("./lib/panel");
const program = new commander_1.Command();
program
    .name('knowtif')
    .description('GitHub notifications to Discord, Phone, Browser, and more')
    .version('1.0.0');
// Default command - Control Panel
program
    .action(async () => {
    if (process.env.GITHUB_ACTIONS) {
        await (0, action_1.runAction)();
        return;
    }
    await (0, panel_1.runControlPanel)();
});
// Setup - First time configuration
program
    .command('setup')
    .alias('install')
    .description('Configure Knowtif from scratch')
    .action(async () => {
    await (0, setup_1.runSetup)();
});
// Test - Send a test notification
program
    .command('test')
    .description('Send a test notification')
    .action(async () => {
    const { testNotifications } = await Promise.resolve().then(() => __importStar(require('./lib/test')));
    await testNotifications();
});
// Action - GitHub Actions internal command
program
    .command('action')
    .description('(internal) Run in GitHub Actions')
    .action(async () => {
    await (0, action_1.runAction)();
});
program.parse();
