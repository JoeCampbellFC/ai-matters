import { describe, expect, it } from 'vitest'
import { buildImanageWorkspaceUrl } from './imanageUrl'

describe('buildImanageWorkspaceUrl', () => {
  it('builds a web UI link from the MCP endpoint origin and the workspace id', () => {
    expect(buildImanageWorkspaceUrl('https://fireman.cloudimanage.com/mcp/work', 'ACTIVE!123772')).toBe(
      'https://fireman.cloudimanage.com/work/web/r/libraries/ACTIVE/workspaces/ACTIVE!123772',
    )
  })

  it('returns undefined when the MCP endpoint is not yet known', () => {
    expect(buildImanageWorkspaceUrl(undefined, 'ACTIVE!123772')).toBeUndefined()
  })

  it('returns undefined when the workspace id has no library prefix', () => {
    expect(buildImanageWorkspaceUrl('https://fireman.cloudimanage.com/mcp/work', '123772')).toBeUndefined()
  })

  it('returns undefined when the MCP endpoint is not a valid URL', () => {
    expect(buildImanageWorkspaceUrl('not-a-url', 'ACTIVE!123772')).toBeUndefined()
  })
})
