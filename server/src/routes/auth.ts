import { Router } from 'express'
import { auth } from '@modelcontextprotocol/sdk/client/auth.js'
import { config } from '../config.js'
import { SessionOAuthClientProvider } from '../auth/oauthProvider.js'
import { disconnect } from '../mcp/connection.js'

export const authRouter = Router()

authRouter.get('/connect', async (req, res) => {
  const provider = new SessionOAuthClientProvider(req)
  try {
    const result = await auth(provider, { serverUrl: config.imanageMcpUrl })
    if (result === 'REDIRECT') {
      const authorizationUrl = provider.consumeAuthorizationUrl()
      if (!authorizationUrl) {
        throw new Error('OAuth flow did not produce an authorization URL.')
      }
      res.redirect(authorizationUrl.toString())
      return
    }
    res.redirect(`${config.frontendUrl}/workspaces`)
  } catch (error) {
    console.error('[auth/connect] failed to start the iManage OAuth flow', error)
    res.redirect(`${config.frontendUrl}/settings?connection=error`)
  }
})

authRouter.get('/callback', async (req, res) => {
  const provider = new SessionOAuthClientProvider(req)
  const code = typeof req.query.code === 'string' ? req.query.code : undefined
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  const authorizationError = typeof req.query.error === 'string' ? req.query.error : undefined

  if (authorizationError) {
    console.error('[auth/callback] authorization server returned an error:', authorizationError, req.query.error_description)
    res.redirect(`${config.frontendUrl}/settings?connection=error`)
    return
  }

  if (!code || !provider.verifyState(state)) {
    console.error('[auth/callback] missing authorization code or failed CSRF state check')
    res.redirect(`${config.frontendUrl}/settings?connection=error`)
    return
  }

  try {
    const result = await auth(provider, { serverUrl: config.imanageMcpUrl, authorizationCode: code })
    if (result !== 'AUTHORIZED') {
      throw new Error(`Unexpected OAuth result after code exchange: ${result}`)
    }
    res.redirect(`${config.frontendUrl}/workspaces`)
  } catch (error) {
    console.error('[auth/callback] authorization code exchange failed', error)
    res.redirect(`${config.frontendUrl}/settings?connection=error`)
  }
})

authRouter.post('/disconnect', async (req, res, next) => {
  try {
    await disconnect(req)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})
