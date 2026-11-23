import { END, START, StateGraph } from '@langchain/langgraph'
import { ResearchAnnotation } from './state.js'
import { NodeContextAnnotation } from './nodes/shared.js'
import { loadWorkspaceContext } from './nodes/loadWorkspaceContext.js'
import { planSearches } from './nodes/planSearches.js'
import { runGlobalSearches } from './nodes/runGlobalSearches.js'
import { verifyMembership } from './nodes/verifyMembership.js'
import { rankCandidates } from './nodes/rankCandidates.js'
import { selectDocuments } from './nodes/selectDocuments.js'
import { readAndExtract } from './nodes/readAndExtract.js'
import { assessCoverage } from './nodes/assessCoverage.js'
import { routeAfterCoverage } from './nodes/routeAfterCoverage.js'
import { buildOutline } from './nodes/buildOutline.js'
import { writeMarkdown } from './nodes/writeMarkdown.js'
import { validateCitationsNode } from './nodes/validateCitations.js'
import { finalize } from './nodes/finalize.js'

export function buildMatterResearchGraph() {
  return new StateGraph(ResearchAnnotation, NodeContextAnnotation)
    .addNode('loadWorkspaceContext', loadWorkspaceContext)
    .addNode('planSearches', planSearches)
    .addNode('runGlobalSearches', runGlobalSearches)
    .addNode('verifyMembership', verifyMembership)
    .addNode('rankCandidates', rankCandidates)
    .addNode('selectDocuments', selectDocuments)
    .addNode('readAndExtract', readAndExtract)
    .addNode('assessCoverage', assessCoverage)
    .addNode('buildOutline', buildOutline)
    .addNode('writeMarkdown', writeMarkdown)
    .addNode('validateCitations', validateCitationsNode)
    .addNode('finalize', finalize)
    .addEdge(START, 'loadWorkspaceContext')
    .addEdge('loadWorkspaceContext', 'planSearches')
    .addEdge('planSearches', 'runGlobalSearches')
    .addEdge('runGlobalSearches', 'verifyMembership')
    .addEdge('verifyMembership', 'rankCandidates')
    .addEdge('rankCandidates', 'selectDocuments')
    .addEdge('selectDocuments', 'readAndExtract')
    .addEdge('readAndExtract', 'assessCoverage')
    .addConditionalEdges('assessCoverage', routeAfterCoverage, {
      refine: 'planSearches',
      proceed: 'buildOutline',
    })
    .addEdge('buildOutline', 'writeMarkdown')
    .addEdge('writeMarkdown', 'validateCitations')
    .addEdge('validateCitations', 'finalize')
    .addEdge('finalize', END)
    .compile()
}

export type MatterResearchGraph = ReturnType<typeof buildMatterResearchGraph>
