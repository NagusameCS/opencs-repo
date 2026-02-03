import * as fs from 'fs';
import { sendNotification, NotificationType } from './notify';
import axios from 'axios';
import chalk from 'chalk';

export const runAction = async () => {
    console.log(chalk.blue('Running in GitHub Action mode...'));

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
                await handlePush(event, repo!, sha!);
                break;
            case 'workflow_run':
                await handleWorkflowRun(event, repo!);
                break;
            case 'deployment_status':
                await handleDeploymentStatus(event, repo!);
                break;
            case 'pull_request':
                await handlePullRequest(event, repo!);
                break;
            case 'pull_request_review':
                await handlePullRequestReview(event, repo!);
                break;
            case 'issues':
                await handleIssue(event, repo!);
                break;
            case 'release':
                await handleRelease(event, repo!);
                break;
            case 'star':
                await handleStar(event, repo!);
                break;
            case 'fork':
                await handleFork(event, repo!);
                break;
            case 'check_run':
                await handleCheckRun(event, repo!);
                break;
            default:
                console.log(`Unhandled event: ${eventName}`);
        }
    } catch (error: any) {
        console.error(chalk.red('Error processing event:'), error.message);
        process.exit(1);
    }
};

const handlePush = async (event: any, repo: string, sha: string) => {
    const pusher = event.pusher?.name || 'Unknown';
    const message = event.head_commit?.message || 'No message';
    const branch = event.ref.replace('refs/heads/', '');
    const commits = event.commits?.length || 1;

    await sendNotification(
        'Push Received',
        `**${repo}**\n` +
        `Branch: \`${branch}\`\n` +
        `Pusher: ${pusher}\n` +
        `Commits: ${commits}\n` +
        `Latest: \`${sha}\` - ${message.split('\n')[0]}`,
        NotificationType.INFO
    );
};

const handleWorkflowRun = async (event: any, repo: string) => {
    const workflow = event.workflow_run;
    if (!workflow) return;

    const conclusion = workflow.conclusion;
    const branch = workflow.head_branch;
    const sha = workflow.head_sha?.substring(0, 7);
    const name = workflow.name;
    const runUrl = workflow.html_url;
    const duration = workflow.run_started_at ?
        Math.round((new Date(workflow.updated_at).getTime() - new Date(workflow.run_started_at).getTime()) / 1000) : 0;

    if (conclusion === 'success') {
        await sendNotification(
            'CI Passed',
            `**${repo}**\n` +
            `Workflow: ${name}\n` +
            `Branch: \`${branch}\`\n` +
            `Commit: \`${sha}\`\n` +
            `Duration: ${duration}s\n` +
            `[View Run](${runUrl})`,
            NotificationType.SUCCESS
        );
    } else if (conclusion === 'failure' || conclusion === 'timed_out') {
        await sendNotification(
            'CI Failed',
            `**${repo}**\n` +
            `Workflow: ${name}\n` +
            `Branch: \`${branch}\`\n` +
            `Commit: \`${sha}\`\n` +
            `Conclusion: ${conclusion}\n` +
            `[View Run](${runUrl})`,
            NotificationType.FAILURE
        );
    } else if (conclusion === 'cancelled') {
        await sendNotification(
            'CI Cancelled',
            `**${repo}**\n` +
            `Workflow: ${name}\n` +
            `Branch: \`${branch}\``,
            NotificationType.INFO
        );
    }
};

const handleDeploymentStatus = async (event: any, repo: string) => {
    const deploymentStatus = event.deployment_status;
    const state = deploymentStatus.state;
    const environment = deploymentStatus.environment;
    const targetUrl = deploymentStatus.target_url || deploymentStatus.environment_url;
    const description = deploymentStatus.description;

    if (state === 'success') {
        await sendNotification(
            'Deployment Successful',
            `**${repo}**\n` +
            `Environment: ${environment}\n` +
            (targetUrl ? `URL: ${targetUrl}\n` : '') +
            (description ? `Note: ${description}` : ''),
            NotificationType.SUCCESS
        );

        // Health Check
        const healthCheckUrl = process.env.HEALTH_CHECK_URL || targetUrl;
        if (healthCheckUrl && process.env.HEALTH_CHECK_URL !== 'false') {
            await performHealthCheck(healthCheckUrl);
        }

    } else if (state === 'failure' || state === 'error') {
        await sendNotification(
            'Deployment Failed',
            `**${repo}**\n` +
            `Environment: ${environment}\n` +
            `State: ${state}\n` +
            (description ? `Error: ${description}` : ''),
            NotificationType.FAILURE
        );
    } else if (state === 'pending' || state === 'in_progress') {
        await sendNotification(
            'Deployment Started',
            `**${repo}**\n` +
            `Environment: ${environment}\n` +
            `State: ${state}`,
            NotificationType.INFO
        );
    }
};

const handlePullRequest = async (event: any, repo: string) => {
    const pr = event.pull_request;
    const action = event.action;
    const title = pr.title;
    const number = pr.number;
    const author = pr.user.login;
    const url = pr.html_url;

    if (action === 'opened') {
        await sendNotification(
            'New Pull Request',
            `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Author: ${author}\n` +
            `[View PR](${url})`,
            NotificationType.INFO
        );
    } else if (action === 'closed' && pr.merged) {
        await sendNotification(
            'PR Merged',
            `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Merged by: ${event.sender.login}`,
            NotificationType.SUCCESS
        );
    } else if (action === 'closed' && !pr.merged) {
        await sendNotification(
            'PR Closed',
            `**${repo}** #${number}\n` +
            `Title: ${title}`,
            NotificationType.INFO
        );
    }
};

const handlePullRequestReview = async (event: any, repo: string) => {
    const review = event.review;
    const pr = event.pull_request;
    const action = event.action;

    if (action !== 'submitted') return;

    const state = review.state;
    const reviewer = review.user.login;
    const number = pr.number;
    const title = pr.title;

    if (state === 'approved') {
        await sendNotification(
            'PR Approved',
            `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Approved by: ${reviewer}`,
            NotificationType.SUCCESS
        );
    } else if (state === 'changes_requested') {
        await sendNotification(
            'Changes Requested',
            `**${repo}** #${number}\n` +
            `Title: ${title}\n` +
            `Reviewer: ${reviewer}`,
            NotificationType.INFO
        );
    }
};

const handleIssue = async (event: any, repo: string) => {
    const issue = event.issue;
    const action = event.action;

    if (action === 'opened') {
        await sendNotification(
            'New Issue',
            `**${repo}** #${issue.number}\n` +
            `Title: ${issue.title}\n` +
            `Author: ${issue.user.login}\n` +
            `[View Issue](${issue.html_url})`,
            NotificationType.INFO
        );
    } else if (action === 'closed') {
        await sendNotification(
            'Issue Closed',
            `**${repo}** #${issue.number}\n` +
            `Title: ${issue.title}`,
            NotificationType.SUCCESS
        );
    }
};

const handleRelease = async (event: any, repo: string) => {
    const release = event.release;
    const action = event.action;

    if (action === 'published') {
        await sendNotification(
            'New Release',
            `**${repo}**\n` +
            `Tag: ${release.tag_name}\n` +
            `Name: ${release.name || release.tag_name}\n` +
            `Author: ${release.author.login}\n` +
            `[Download](${release.html_url})`,
            NotificationType.SUCCESS
        );
    }
};

const handleStar = async (event: any, repo: string) => {
    const action = event.action;
    const sender = event.sender.login;

    if (action === 'created') {
        await sendNotification(
            'New Star',
            `**${repo}**\n` +
            `Starred by: ${sender}`,
            NotificationType.SUCCESS
        );
    }
};

const handleFork = async (event: any, repo: string) => {
    const forkee = event.forkee;

    await sendNotification(
        'Repository Forked',
        `**${repo}**\n` +
        `Forked to: ${forkee.full_name}\n` +
        `By: ${forkee.owner.login}`,
        NotificationType.INFO
    );
};

const handleCheckRun = async (event: any, repo: string) => {
    const checkRun = event.check_run;
    const action = event.action;

    if (action !== 'completed') return;

    const conclusion = checkRun.conclusion;
    const name = checkRun.name;
    const sha = checkRun.head_sha?.substring(0, 7);

    // Only notify on failure to avoid spam
    if (conclusion === 'failure' || conclusion === 'timed_out') {
        await sendNotification(
            'Check Failed',
            `**${repo}**\n` +
            `Check: ${name}\n` +
            `Commit: \`${sha}\`\n` +
            `Conclusion: ${conclusion}`,
            NotificationType.FAILURE
        );
    }
};

const performHealthCheck = async (url: string) => {
    console.log(`Checking health of ${url}...`);
    let healthy = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!healthy && attempts < maxAttempts) {
        try {
            const response = await axios.get(url, { timeout: 10000 });
            if (response.status >= 200 && response.status < 300) {
                await sendNotification(
                    'Health Check Passed',
                    `App is reachable at ${url}\n` +
                    `Status: ${response.status}\n` +
                    `Response time: ~${attempts * 5}s after deploy`,
                    NotificationType.SUCCESS
                );
                healthy = true;
            } else {
                throw new Error(`Status ${response.status}`);
            }
        } catch (e: any) {
            attempts++;
            console.log(`Attempt ${attempts} failed: ${e.message}`);
            if (attempts === maxAttempts) {
                await sendNotification(
                    'Health Check Failed',
                    `App is not reachable at ${url}\n` +
                    `Error: ${e.message}\n` +
                    `Tried ${maxAttempts} times over ${maxAttempts * 5}s`,
                    NotificationType.FAILURE
                );
            } else {
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
};
