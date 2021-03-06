const core = require('@actions/core');
const github = require('@actions/github');

async function isFirstPull(
  client, owner, repo,
  sender, curPullNumber,
  page = 1
) {
  const { status, data: pulls } = await client.pulls.list({
    owner: owner,
    repo: repo,
    per_page: 100,
    page: page,
    state: 'all'
  });

  if (status !== 200) {
    throw new Error(`Received unexpected API status code ${status}`);
  }

  if (pulls.length === 0) {
    return true;
  }

  for (const pull of pulls) {
    const login = pull.user.login;
    if (login === sender && pull.number < curPullNumber) {
      return false;
    }
  }

  return await isFirstPull(
    client,
    owner,
    repo,
    sender,
    curPullNumber,
    page + 1
  );
}


async function run() {
  try {
    const accessToken = core.getInput('access-token');
    const message = core.getInput('message');

    const payload = github.context.payload;
    const githubClient = github.getOctokit(accessToken);
    core.info("Request received");

    if (payload.action === "opened") {
      core.info("New Pull Request..");
      const pullRequest = payload.pull_request;
      const userName = pullRequest.user.login;
      const owner = pullRequest.base.repo.owner.login;
      const repoName = pullRequest.base.repo.name;
      const issueNumber = pullRequest.number;
      const comment = message.replace(/{}/g, userName);

      const shouldComment = await isFirstPull(
        githubClient, owner, repoName,
        userName, issueNumber
      );

      // Comment on the pull request made by a new contributor
      if (shouldComment) {
        core.info("Commenting");
        githubClient.issues.createComment({ owner, repo: repoName, issue_number: issueNumber, body: comment });
      }
    }
  } catch (err) {
    core.setFailed(err.message);
  }

}

run();





