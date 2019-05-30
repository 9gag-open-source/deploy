/**
 * This is the entry point for your Probot App.
 * @param {import('probot').Application} app - Probot's Application class.
 */
module.exports = app => {
  // Get an express router to expose new HTTP endpoints
  const getConfig = require('probot-config')
  const router = app.route('/my-app')
  router.use(require('express').static('public'))

  router.get('/auth', (req, res) => {
    app.log('Auth with Get')
    res.end('Auth with Get')
  })

  router.post('/auth', (req, res) => {
    app.log('Auth with Post')
    res.end('Auth with Post')
  })

  /**
   * Create deployment from PR labels
   */
  app.on('pull_request.labeled', async context => {
    const config = await getConfig(context, 'deploy.yml')

    let labelName = context.payload.label.name
    let encodedLabelName = encodeURI(labelName)

    if (config && config.labels && config.labels[encodedLabelName]) {
      let deployment = config.labels[encodedLabelName]
      deployment.owner = context.payload.pull_request.head.repo.owner.login
      deployment.repo = context.payload.pull_request.head.repo.name
      deployment.ref = context.payload.pull_request.head.ref
      deployment.headers = {
        accept: 'application/vnd.github.ant-man-preview+json'
      }

      context.github.repos.createDeployment(deployment).then(function (deploymentResult) {
        return deploymentResult
      }, function (apiError) {
        let errorMessage = JSON.parse(apiError.message)
        let body = `:rotating_light: Failed to trigger deployment. :rotating_light:\n${errorMessage.message}`
        if (errorMessage.documentation_url) {
          body = body + ` See [the documentation](${errorMessage.documentation_url}) for more details`
        }

        let errorComment = {
          'owner': context.payload.pull_request.head.repo.owner.login,
          'repo': context.payload.pull_request.head.repo.name,
          'number': context.payload.pull_request.number,
          'body': body
        }
        context.github.issues.createComment(errorComment)
      })

      let labelCleanup = {
        'owner': context.payload.pull_request.head.repo.owner.login,
        'repo': context.payload.pull_request.head.repo.name,
        'number': context.payload.pull_request.number,
        'name': labelName
      }
      context.github.issues.removeLabel(labelCleanup)
    }
  })

  /**
   * Create deployments from Releases
   */
  app.on('release.published', async context => {
    if (context.payload.action != 'published' || context.payload.release.draft) {
      return
    }

    const config = await getConfig(context, 'deploy.yml')
    if (!config || !(config.releases)) {
      return
    }

    app.log(`Creating deployment for release '${context.payload.release.tag_name}'`)

    let deployment = config.releases
    deployment.owner = context.payload.repository.owner.login
    deployment.repo = context.payload.repository.name
    deployment.ref = context.payload.release.tag_name
    deployment.headers = {
      accept: 'application/vnd.github.ant-man-preview+json'
    }

    context.github.repos.createDeployment(deployment).then(function (deploymentResult) {
      return deploymentResult
    }, function (apiError) {
      //TODO: notify errors to owner
      let errorMessage = JSON.parse(apiError.message)
      let body = `Failed to trigger deployment.\n${errorMessage.message}`
      app.log(body)
    })
  })
}
