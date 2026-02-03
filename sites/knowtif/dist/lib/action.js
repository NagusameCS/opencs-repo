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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAction = void 0;
const fs = __importStar(require("fs"));
const notify_1 = require("./notify");
const axios_1 = __importDefault(require("axios"));
const chalk_1 = __importDefault(require("chalk"));
const runAction = async () => {
    console.log(chalk_1.default.blue('Running in GitHub Action mode...'));
    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath || !fs.existsSync(eventPath)) {
        console.error('GITHUB_EVENT_PATH not found');
        process.exit(1);
    }
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
    const repo = process.env.GITHUB_REPOSITORY;
    const sha = process.env.GITHUB_SHA?.substring(0, 7);
    try {
        switch (eventName) {
            case 'push':
                await handlePush(event, repo, sha);
                break;
            case 'workflow_run':
                await handleWorkflowRun(event, repo);
                break;
            case 'deployment_status':
                await handleDeploymentStatus(event, repo);
                break;
            case 'pull_request':
                await handlePullRequest(event, repo);
                break;
            case 'pull_request_review':
                await handlePullRequestReview(event, repo);
                break;
            case 'issues':
                await handleIssue(event, repo);
                break;
            case 'release':
                await handleRelease(event, repo);
                break;
            case 'star':
                await handleStar(event, repo);
                break;
            case 'fork':
                await handleFork(event, repo);
                break;
            case 'check_run':
                await handleCheckRun(event, repo);
                break;
            default:
                console.log(`Unhandled event: ${eventName}`);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error processing event:'), error.message);
        process.exit(1);
    }
};
exports.runAction = runAction;
const handlePush = async (event, repo, sha) => {
    const pusher = event.pusher?.name || 'Unknown';
    const message = event.head_commit?.message || 'No message';
    const branch = event.ref.replace('refs/heads/', '');
    const commits = event.commits?.length || 1;
    await (0, notify_1.sendNotification)('Push Received', `**${repo}**\n` +
        `Branch: \`${branch}\`\n` +
        `Pusher: ${pusher}\n` +
        `Commits: ${commits}\n` +
        `Latest: \`${sha}\` - ${message.split('\n')[0]}`, notify_1.NotificationType.INFO);
};
const handleWorkflowRun = async (event, repo) => {
    const workflow = event.workflow_run;
    if (!workflow)
        return;
    const conclusion = workflow.conclusion;
    const branch = workflow.head_branch;
    const sha = workflow.head_sha?.substring(0, 7);
    const name = workflow.name;
    const runUrl = workflow.html_url;
    const duration = workflow.run_started_at ?
        Math.round((new Date(workflow.updated_at).getTime() - new Date(workflow.run_started_at).getTime()) / 1000) : 0;
    if (conclusion === 'success') {
        await (0, notify_1.sendNotification)('CI Passed', `**${repo}**\n` +
            `Workflow: ${name}\n` +
            `Branch: \`${branch}\`\n` +
            `Commit: \`${sha}\`\n` +
            `Duration: ${duration}s\n` +
            `[View Run](${runUrl})`, notify_1.NotificationType.SUCCESS);
    }
    else if (conclusion === 'failure' || conclusion === 'timed_out') {
        await (0, notify_1.sendNotification)('CI Failed', `**${repo}**\n` +
            `Workflow: ${name}\n` +
            `Branch: \`${branch}\`\n` +
            `Commit: \`${sha}\`\n` +
            `Conclusion: ${conclusion}\n` +
            `[View Run](${runUrl})`, notify_1.NotificationType.FAILURE);
    }
    else if (conclusion === 'cancelled') {
        await (0, notify_1.sendNotification)('CI Cancelled', `**${repo}**\n` +
            `Workflow: ${name}\n` +
            `Branch: \`${branch}\``, notify_1.NotificationType.INFO);
    }
};
const handleDeploymentStatus = async (event, repo) => {
    const deploymentStatus = event.deployment_status;
    const state = deploymentStatus.state;
    const environment = deploymentStatus.environment;
    const targetUrl = deploymentStatus.target_url || deploymentStatus.environment_url;
    const description = deploymentStatus.description;
    if (state === 'success') {
        await (0, notify_1.sendNotification)('Deployment Successful', `**${repo}**\n` +
            `Environment: ${environment}\n` +
            (targetUrl ? `URL: ${targetUrl}\n` : '') +
            (description ? `Note: ${description}` : ''), notify_1.NotificationType.SUCCESS);
        // Health Check
        const healthCheckUrl = process.env.HEALTH_CHECK_URL || targetUrl;
        if (healthCheckUrl && process.env.HEALTH_CHECK_URL !== 'false') {
            await performHealthCheck(healthCheckUrl);
        }
    }
    else if (state === 'failure' || state === 'error') {
        await (0, notify_1.sendNotification)('Deployment Failed', `**${repo}**\n` +
            `Environment: ${environment}\n` +
            `State: ${state}\n` +
            (description ? `Error: ${description}` : ''), notify_1.NotificationType.FAILURE);
    }
    else if (state === 'pending' || state === 'in_progress') {
        await (0, notify_1.sendNotification)('Deployment Started', `**${repo}**\n` +
            `Environment: ${environment}\n` +
            `State: ${state}`, notify_1.NotificationType.INFO);
    }
};
const handlePullRequest = async (event, repo) => {
    const pr = event.pull_request;
    const action = event.action;
    const title = pr.title;
    const number = pr.number;
    const author = pr.user.login;
    const url = pr.html_url;
    if (action === 'opened') {
        await (0, notify_1.sendNotification)('New Pull Request', `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Author: ${author}\n` +
            `[View PR](${url})`, notify_1.NotificationType.INFO);
    }
    else if (action === 'closed' && pr.merged) {
        await (0, notify_1.sendNotification)('PR Merged', `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Merged by: ${event.sender.login}`, notify_1.NotificationType.SUCCESS);
    }
    else if (action === 'closed' && !pr.merged) {
        await (0, notify_1.sendNotification)('PR Closed', `**${repo}** #${number}\n` +
            `Title: ${title}`, notify_1.NotificationType.INFO);
    }
};
const handlePullRequestReview = async (event, repo) => {
    const review = event.review;
    const pr = event.pull_request;
    const action = event.action;
    if (action !== 'submitted')
        return;
    const state = review.state;
    const reviewer = review.user.login;
    const number = pr.number;
    const title = pr.title;
    if (state === 'approved') {
        await (0, notify_1.sendNotification)('PR Approved', `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Approved by: ${reviewer}`, notify_1.NotificationType.SUCCESS);
    }
    else if (state === 'changes_requested') {
        await (0, notify_1.sendNotification)('Changes Requested', `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Reviewer: ${reviewer}`, notify_1.NotificationType.INFO);
    }
};
const handleIssue = async (event, repo) => {
    const issue = event.issue;
    const action = event.action;
    if (action === 'opened') {
        await (0, notify_1.sendNotification)('New Issue', `**${repo}** #${issue.number}\n` +
            `Title: ${issue.title}\n` +
            `Author: ${issue.user.login}\n` +
            `[View Issue](${issue.html_url})`, notify_1.NotificationType.INFO);
    }
    else if (action === 'closed') {
        await (0, notify_1.sendNotification)('Issue Closed', `**${repo}** #${issue.number}\n` +
            `Title: ${issue.title}`, notify_1.NotificationType.SUCCESS);
    }
};
const handleRelease = async (event, repo) => {
    const release = event.release;
    const action = event.action;
    if (action === 'published') {
        await (0, notify_1.sendNotification)('New Release', `**${repo}**\n` +
            `Tag: ${release.tag_name}\n` +
            `Name: ${release.name || release.tag_name}\n` +
            `Author: ${release.author.login}\n` +
            `[Download](${release.html_url})`, notify_1.NotificationType.SUCCESS);
    }
};
const handleStar = async (event, repo) => {
    const action = event.action;
    const sender = event.sender.login;
    if (action === 'created') {
        await (0, notify_1.sendNotification)('New Star', `**${repo}**\n` +
            `Starred by: ${sender}`, notify_1.NotificationType.SUCCESS);
    }
};
const handleFork = async (event, repo) => {
    const forkee = event.forkee;
    await (0, notify_1.sendNotification)('Repository Forked', `**${repo}**\n` +
        `Forked to: ${forkee.full_name}\n` +
        `By: ${forkee.owner.login}`, notify_1.NotificationType.INFO);
};
const handleCheckRun = async (event, repo) => {
    const checkRun = event.check_run;
    const action = event.action;
    if (action !== 'completed')
        return;
    const conclusion = checkRun.conclusion;
    const name = checkRun.name;
    const sha = checkRun.head_sha?.substring(0, 7);
    // Only notify on failure to avoid spam
    if (conclusion === 'failure' || conclusion === 'timed_out') {
        await (0, notify_1.sendNotification)('Check Failed', `**${repo}**\n` +
            `Check: ${name}\n` +
            `Commit: \`${sha}\`\n` +
            `Conclusion: ${conclusion}`, notify_1.NotificationType.FAILURE);
    }
};
const performHealthCheck = async (url) => {
    console.log(`Checking health of ${url}...`);
    let healthy = false;
    let attempts = 0;
    const maxAttempts = 5;
    while (!healthy && attempts < maxAttempts) {
        try {
            const response = await axios_1.default.get(url, { timeout: 10000 });
            if (response.status >= 200 && response.status < 300) {
                await (0, notify_1.sendNotification)('Health Check Passed', `App is reachable at ${url}\n` +
                    `Status: ${response.status}\n` +
                    `Response time: ~${attempts * 5}s after deploy`, notify_1.NotificationType.SUCCESS);
                healthy = true;
            }
            else {
                throw new Error(`Status ${response.status}`);
            }
        }
        catch (e) {
            attempts++;
            console.log(`Attempt ${attempts} failed: ${e.message}`);
            if (attempts === maxAttempts) {
                await (0, notify_1.sendNotification)('Health Check Failed', `App is not reachable at ${url}\n` +
                    `Error: ${e.message}\n` +
                    `Tried ${maxAttempts} times over ${maxAttempts * 5}s`, notify_1.NotificationType.FAILURE);
            }
            else {
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
};
