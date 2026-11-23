import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { MatterTypeProbability } from '@/types/matterProfile'

const UNCLEAR_MATTER_TYPE_ID = 'unclear_other'

/** Top 3 alternative probabilities from the same classification -- explicitly not separate confirmed matter types. */
export function AlternativeCategories({
  probabilities,
  selectedId,
}: {
  probabilities: MatterTypeProbability[]
  selectedId: string | null
}) {
  const alternatives = probabilities
    .filter((p) => p.id !== selectedId && p.id !== UNCLEAR_MATTER_TYPE_ID)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)

  if (alternatives.length === 0) return null

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="alternatives">
        <AccordionTrigger>Other Possible Categories</AccordionTrigger>
        <AccordionContent>
          <p className="mb-2 text-xs text-muted-foreground">
            Alternative probabilities the model returned alongside its selection -- not separate confirmed matter types.
          </p>
          <ul className="flex flex-col gap-1.5">
            {alternatives.map((alt) => (
              <li key={alt.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{alt.label}</span>
                <span className="tabular-nums text-muted-foreground">{Math.round(alt.probability * 100)}%</span>
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
