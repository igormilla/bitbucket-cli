const axios = require('axios')
const ora = require('ora')
const prettyjson = require('prettyjson')
const git = require('../helpers/git')

module.exports = ({ program }) => {
  let client = null

  const reviewers = []

  const addReviewer = (value) => {
    reviewers.push(value)
  }

  const fetchDescription = function (source, destination) {
    return client.get(`/commits/${source}`, {
      params: {
        exclude: destination
      }
    })
      .then((r) => {
        const messages = r.data.values.map(commit => commit.rendered.message.raw)
          .join("\n\n")

        return [
          '# Included Messages (combined automatically)',
          messages
        ].join('\n\n\n')
      })
      .catch(() => 'No fetchable Data')
  }

  program
    .description('Create a Bitbucket PR')
    .option('-t, --title <title>', 'PR Title', git.getCurrentBranch())
    .option('-rs, --repo-slug <repo-slug>', 'Repo slug', git.getCurrentBitbucketSlug())
    .option('-s, --source <source>', 'Source Branch', git.getCurrentBranch())
    .option('-d, --destination <destination>', 'destination Branch', 'master')
    .option('-r, --reviewer <reviewer>', 'Add one or more reviewers by username (only Username works), use once with comma-separated values or multiple times', addReviewer)
    .option('-d, --description <description>', 'Describe the PR, supports Markdown or leave it to us to generate a comprehensive description')
    .option('-u, --username <username>', 'Username to connect to bitbucket', process.env.BT_USER)
    .option('-p, --password <password>', 'Password to connect to bitbucket', process.env.BT_PASS)
    .option('--keep-branch', 'Should BB keep the branch open after merge?', true)
    .option('--no-fail', 'Command will not exit with code != 0 even on failure')
    .option('--debug', 'Output message to be sent to Bitbucket API')
    .action((cmd) => {
      const spinner = ora(`Creating Pull Request at ${cmd.repoSlug}`).start()

      client = axios.create({
        baseURL: `https://api.bitbucket.org/2.0/repositories/${process.env.BT_COMPANY}/${cmd.repoSlug}`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        withCredentials: true,
        auth: {
          username: cmd.username,
          password: cmd.password
        },
        responseType: 'json'
      })

      const message = {
        title: cmd.title,
        close_source_branch: !cmd.keepBranch,
        source: {
          branch: {
            name: cmd.source
          }
        },
        destination: {
          branch: {
            name: cmd.destination
          }
        }
      }

      let mappableReviewers = reviewers

      if (reviewers.length === 1 && !!reviewers[0]) {
        mappableReviewers = reviewers[0].split(',')
      }

      if (mappableReviewers.length > 0) {
        message.reviewers = mappableReviewers.map((r) => {
          return {
            username: r
          }
        })
      }

      const findDescription = typeof cmd.description === 'string'
        ? Promise.resolve(cmd.description)
        : fetchDescription(message.source.branch.name, message.destination.branch.name)

      findDescription
        .then(description => {
          message.description = description

          return message
        })
        .then(message => {
          if (cmd.debug) {
            console.log('\n', prettyjson.render(message))
          }
          return message
        })
        .then(data => client.post('/pullrequests', data))
        .then((r) => {
          spinner.succeed('Successfully created PR ' + r.data.links.html.href)

          process.exit()
        })
        .catch((e) => {
          spinner.fail('Failed creating PR with Status ' + e.response.status)
          console.log(prettyjson.render(e.response.data, { keysColor: 'red' }))

          if (cmd.fail) {
            process.exit(1)
          }
        })
    })
}

