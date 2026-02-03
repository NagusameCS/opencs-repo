"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchRepository = void 0;
const octokit_1 = require("octokit");
const config_1 = require("./config");
const notify_1 = require("./notify");
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const axios_1 = __importDefault(require("axios"));
const getGitInfo = () => {
    try {
        const repoUrl = (0, child_process_1.execSync)('git config --get remote.origin.url').toString().trim();
        const branch = (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD').toString().trim();
        // Extract owner/repo from URL (supports https and ssh)
        // git@github.com:owner/repo.git or https://github.com/owner/repo.git
        const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^.]+)/);
        if (!match)
            throw new Error('Could not parse GitHub repo from git config');
        return {
            owner: match[1],
            repo: match[2],
            branch
        };
    }
    catch (e) {
        throw new Error('Not a git repository or no remote origin found. Please specify --repo and --branch.');
    }
};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const watchRepository = async (options) => {
    const config = (0, config_1.getConfig)();
    if (!config.githubToken) {
        throw new Error('GitHub token not configured. Run "knowtif setup" first.');
    }
    const octokit = new octokit_1.Octokit({ auth: config.githubToken });
    let owner, repo, branch;
    if (options.repo) {
        [owner, repo] = options.repo.split('/');
        branch = options.branch || 'main';
    }
    else {
        const gitInfo = getGitInfo();
        owner = gitInfo.owner;
        repo = gitInfo.repo;
        branch = options.branch || gitInfo.branch;
    }
    // Use URL from options or local config
    const healthCheckUrl = options.url || config.healthCheckUrl;
    console.log(chalk_1.default.cyan(`Watching ${owner}/${repo} on branch ${branch}...`));
    // 1. Get the latest local commit (if running in a git repo) or just watch the latest remote commit?
    // The user said "when your changes have fully propagated". This implies we pushed something.
    // So we should look for the HEAD commit of the local branch and wait for it to appear on remote.
    let targetSha;
    try {
        targetSha = (0, child_process_1.execSync)('git rev-parse HEAD').toString().trim();
        console.log(chalk_1.default.gray(`Local HEAD is ${targetSha}`));
    }
    catch (e) {
        // If not in a git repo, we might just want to watch the latest remote commit?
        // But the use case is "my changes".
        // Let's assume we are in the repo or the user provides the SHA (feature for later).
        // For now, if we can't get local SHA, we fetch the latest from remote and watch that.
        const { data: ref } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });
        targetSha = ref.object.sha;
        console.log(chalk_1.default.gray(`Watching latest remote commit ${targetSha}`));
    }
    // 2. Wait for Push Received (Commit available on API)
    let commitAvailable = false;
    while (!commitAvailable) {
        try {
            await octokit.rest.repos.getCommit({ owner, repo, ref: targetSha });
            commitAvailable = true;
            await (0, notify_1.sendNotification)('Push Received', `Commit ${targetSha.substring(0, 7)} is now available on GitHub.`, notify_1.NotificationType.SUCCESS);
        }
        catch (e) {
            await (0, notify_1.sendNotification)('Waiting for Push', `Waiting for commit ${targetSha.substring(0, 7)} to appear on GitHub...`);
            await sleep(5000);
        }
    }
    // 3. Monitor CI (Check Suites)
    let ciFinished = false;
    while (!ciFinished) {
        const { data: checkSuites } = await octokit.rest.checks.listSuitesForRef({
            owner,
            repo,
            ref: targetSha,
        });
        if (checkSuites.total_count === 0) {
            // Maybe checks haven't started yet?
            await (0, notify_1.sendNotification)('CI Status', 'No check suites found yet. Waiting...', notify_1.NotificationType.INFO);
            await sleep(10000);
            continue;
        }
        const inProgress = checkSuites.check_suites.some(suite => suite.status !== 'completed');
        if (!inProgress) {
            const failed = checkSuites.check_suites.some(suite => suite.conclusion === 'failure' || suite.conclusion === 'timed_out');
            if (failed) {
                await (0, notify_1.sendNotification)('CI Failed', `CI checks failed for ${targetSha.substring(0, 7)}.`, notify_1.NotificationType.FAILURE);
            }
            else {
                await (0, notify_1.sendNotification)('CI Passed', `All CI checks passed for ${targetSha.substring(0, 7)}.`, notify_1.NotificationType.SUCCESS);
            }
            ciFinished = true;
        }
        else {
            await (0, notify_1.sendNotification)('CI Running', 'CI checks are still in progress...', notify_1.NotificationType.INFO);
            await sleep(15000);
        }
    }
    // 4. Monitor Deployments (Optional)
    // We check if there are any deployments created for this SHA.
    // This is tricky because deployments might be created LATER.
    // We'll check for a short period if a deployment is created, or if the user asked for it.
    // For now, let's just check if one exists.
    console.log(chalk_1.default.cyan('Checking for deployments...'));
    // Give it a moment for deployment to be created after CI
    await sleep(5000);
    const { data: deployments } = await octokit.rest.repos.listDeployments({
        owner,
        repo,
        sha: targetSha,
    });
    if (deployments.length > 0) {
        const deployment = deployments[0]; // Most recent
        let deploymentFinished = false;
        while (!deploymentFinished) {
            const { data: statuses } = await octokit.rest.repos.listDeploymentStatuses({
                owner,
                repo,
                deployment_id: deployment.id,
            });
            if (statuses.length > 0) {
                const latestStatus = statuses[0];
                if (latestStatus.state === 'success') {
                    await (0, notify_1.sendNotification)('Deployment Successful', `Deployed to ${latestStatus.environment_url || 'environment'}.`, notify_1.NotificationType.SUCCESS);
                    deploymentFinished = true;
                }
                else if (latestStatus.state === 'failure' || latestStatus.state === 'error') {
                    await (0, notify_1.sendNotification)('Deployment Failed', `Deployment failed.`, notify_1.NotificationType.FAILURE);
                    deploymentFinished = true;
                }
                else {
                    await (0, notify_1.sendNotification)('Deployment In Progress', `Deployment state: ${latestStatus.state}`, notify_1.NotificationType.INFO);
                    await sleep(10000);
                }
            }
            else {
                await sleep(5000);
            }
        }
    }
    else {
        console.log(chalk_1.default.gray('No deployments found for this commit.'));
    }
    // 5. Health Check (Optional)
    if (healthCheckUrl) {
        console.log(chalk_1.default.cyan(`Checking health of ${healthCheckUrl}...`));
        let healthy = false;
        let attempts = 0;
        const maxAttempts = 12; // Try for 1 minute (5s interval)
        while (!healthy && attempts < maxAttempts) {
            try {
                const response = await axios_1.default.get(healthCheckUrl);
                if (response.status >= 200 && response.status < 300) {
                    await (0, notify_1.sendNotification)('Health Check Passed', `App is reachable at ${healthCheckUrl}`, notify_1.NotificationType.SUCCESS);
                    healthy = true;
                }
                else {
                    throw new Error(`Status ${response.status}`);
                }
            }
            catch (e) {
                attempts++;
                if (attempts === maxAttempts) {
                    await (0, notify_1.sendNotification)('Health Check Failed', `App is not reachable at ${healthCheckUrl}. Error: ${e.message}`, notify_1.NotificationType.FAILURE);
                }
                else {
                    await sleep(5000);
                }
            }
        }
    }
    console.log(chalk_1.default.green('Monitoring complete.'));
};
exports.watchRepository = watchRepository;
