#!/usr/bin/env node
import { Command } from 'commander';
import { runAction } from './lib/action';
import { runSetup } from './lib/setup';
import { runControlPanel } from './lib/panel';

const program = new Command();

program
    .name('knowtif')
    .description('GitHub notifications to Discord, Phone, Browser, and more')
    .version('1.0.0');

// Default command - Control Panel
program
    .action(async () => {
        if (process.env.GITHUB_ACTIONS) {
            await runAction();
            return;
        }
        await runControlPanel();
    });

// Setup - First time configuration
program
    .command('setup')
    .alias('install')
    .description('Configure Knowtif from scratch')
    .action(async () => {
        await runSetup();
    });

// Test - Send a test notification
program
    .command('test')
    .description('Send a test notification')
    .action(async () => {
        const { testNotifications } = await import('./lib/test');
        await testNotifications();
    });

// Action - GitHub Actions internal command
program
    .command('action')
    .description('(internal) Run in GitHub Actions')
    .action(async () => {
        await runAction();
    });

program.parse();
