import { Inbox } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import type { ResearchDocument } from '@/types/research'

const DISCOVERY_LABELS: Record<string, string> = {
  container_traversal: 'Workspace folder',
  global_search: 'Search',
}

export function ResearchDocumentTable({ documents }: { documents: ResearchDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No documents yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Documents will appear here as the agent discovers and reviews them.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Discovered via</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.documentId}>
              <TableCell className="font-medium text-foreground">{doc.name ?? doc.documentId}</TableCell>
              <TableCell className="text-muted-foreground">
                {doc.discoveredVia?.map((source) => DISCOVERY_LABELS[source] ?? source).join(', ') || '—'}
              </TableCell>
              <TableCell>
                <DocumentStatusBadge status={doc.status} />
              </TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground" title={doc.reason}>
                {doc.reason ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
