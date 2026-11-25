import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCreateSkill, useDeleteSkill, useSkills, useUpdateSkill } from '@/hooks/useSkills'
import { ApiError } from '@/services/api'
import type { AdminSkill } from '@/types/skills'

const DEFAULT_BODY = '## Focus areas\n\nDescribe what documents and searches matter most for this type of matter.\n'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function NewPlaybookDialog({ onCreated }: { onCreated: (skill: AdminSkill) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createMutation = useCreateSkill()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setName('')
      setDescription('')
      createMutation.reset()
    }
  }

  const handleCreate = () => {
    createMutation.mutate(
      { name: name.trim(), description: description.trim(), body: DEFAULT_BODY },
      { onSuccess: (skill) => { handleOpenChange(false); onCreated(skill) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Playbook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Playbook</DialogTitle>
          <DialogDescription>Give it a name and a short description — you&rsquo;ll write the full playbook body next.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-skill-name">Name</Label>
            <Input id="new-skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="real-estate-matter-research" />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only. Cannot be changed later.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-skill-description">Description</Label>
            <Textarea
              id="new-skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown to the agent when it picks a research strategy."
            />
          </div>
          {createMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(createMutation.error, 'Failed to create playbook.')}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || !description.trim() || createMutation.isPending} onClick={handleCreate}>
            {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeletePlaybookDialog({ skill, onOpenChange }: { skill: AdminSkill; onOpenChange: (open: boolean) => void }) {
  const deleteMutation = useDeleteSkill()
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{skill.name}&rdquo;?</DialogTitle>
          <DialogDescription>This permanently removes the playbook. This cannot be undone.</DialogDescription>
        </DialogHeader>
        {deleteMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(deleteMutation.error, 'Failed to delete playbook.')}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(skill, { onSuccess: () => onOpenChange(false) })}
          >
            {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditPlaybookDialog({ skill, onOpenChange }: { skill: AdminSkill; onOpenChange: (open: boolean) => void }) {
  const [description, setDescription] = useState(skill.description)
  const [body, setBody] = useState(skill.body)
  const updateMutation = useUpdateSkill()

  const dirty = description !== skill.description || body !== skill.body

  const handleSave = () => {
    updateMutation.mutate(
      { id: skill.id, description: description.trim(), body, expectedVersion: skill.version },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Editing &ldquo;{skill.name}&rdquo;</DialogTitle>
          <DialogDescription>
            {skill.isSystemDefault ? 'Built-in playbook — description and body are editable, the name is not.' : 'Custom playbook.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-skill-description">Description</Label>
            <Textarea id="edit-skill-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <Tabs defaultValue="markdown" className="gap-3">
            <TabsList>
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
              <TabsTrigger value="preview">Live Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="markdown">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[50vh] w-full font-mono text-xs"
              />
            </TabsContent>
            <TabsContent value="preview">
              <article className="prose prose-sm dark:prose-invert min-h-[50vh] max-w-none rounded-lg border border-input p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </article>
            </TabsContent>
          </Tabs>

          {updateMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(updateMutation.error, 'Failed to save playbook.')}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={updateMutation.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!dirty || updateMutation.isPending} onClick={handleSave}>
            {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save Playbook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlaybooksPage() {
  const { data: skills, isLoading } = useSkills()
  const [editingId, setEditingId] = useState<string | undefined>()
  const [deletingSkill, setDeletingSkill] = useState<AdminSkill | undefined>()

  const editingSkill = skills?.find((s) => s.id === editingId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Playbooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Research strategies the agent chooses between at the start of each matter-research run.
          </p>
        </div>
        <NewPlaybookDialog onCreated={(skill) => setEditingId(skill.id)} />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {skills?.map((skill) => (
                <TableRow key={skill.id}>
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">{skill.description}</TableCell>
                  <TableCell>
                    <Badge variant={skill.isSystemDefault ? 'secondary' : 'outline'}>{skill.isSystemDefault ? 'Built-in' : 'Custom'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(skill.id)}>
                        Edit
                      </Button>
                      {skill.isSystemDefault ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="outline" size="sm" disabled>
                                <Trash2 className="size-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Built-in playbooks cannot be deleted.</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setDeletingSkill(skill)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingSkill && (
        <EditPlaybookDialog
          key={editingSkill.id}
          skill={editingSkill}
          onOpenChange={(open) => {
            if (!open) setEditingId(undefined)
          }}
        />
      )}
      {deletingSkill && (
        <DeletePlaybookDialog
          skill={deletingSkill}
          onOpenChange={(open) => {
            if (!open) setDeletingSkill(undefined)
          }}
        />
      )}
    </div>
  )
}
