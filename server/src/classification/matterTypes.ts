/**
 * Phase 3's single, canonical legal matter type taxonomy. Backend-only --
 * the frontend never hardcodes a parallel copy; it fetches the id/label
 * pairs it needs (for the correction Select) from the API, which reads this
 * module directly.
 */
export type MatterTypeId =
  | 'mergers_acquisitions'
  | 'corporate_advisory'
  | 'commercial_contracts'
  | 'banking_finance'
  | 'commercial_litigation'
  | 'arbitration_dispute_resolution'
  | 'employment'
  | 'real_estate'
  | 'intellectual_property'
  | 'technology_data_privacy'
  | 'regulatory_compliance'
  | 'tax'
  | 'insolvency_restructuring'
  | 'competition_antitrust'
  | 'projects_infrastructure'
  | 'energy_environment'
  | 'insurance'
  | 'private_client_trusts'
  | 'immigration'
  | 'investigations'

/** Internal fallback, not one of the 20 official categories -- the UI shows "Needs Review" for it. */
export const UNCLEAR_MATTER_TYPE_ID = 'unclear_other' as const

export type MatterTypeChoiceId = MatterTypeId | typeof UNCLEAR_MATTER_TYPE_ID

export interface MatterTypeDefinition {
  id: MatterTypeChoiceId
  label: string
  description: string
  guidance: string
}

/**
 * Bump when labels/descriptions/guidance change meaningfully enough that an
 * old classification should no longer be compared directly against a new
 * one -- recorded on every ClassificationRecord for traceability.
 */
export const TAXONOMY_VERSION = '2026.1'

export const MATTER_TYPES: Array<MatterTypeDefinition & { id: MatterTypeId }> = [
  {
    id: 'mergers_acquisitions',
    label: 'Mergers & Acquisitions',
    description: 'Buying, selling, merging or disposing of businesses or corporate assets; transaction structuring, acquisition agreements and due diligence.',
    guidance: 'Choose this when an acquisition, sale, merger or disposal is the principal engagement, even if it also involves financing, tax or employment advice as secondary work.',
  },
  {
    id: 'corporate_advisory',
    label: 'Corporate Advisory',
    description: 'General corporate law, governance, board advice, company reorganisations and corporate structuring not principally involving an acquisition.',
    guidance: 'Choose this for ongoing corporate governance, board/shareholder advice or internal reorganisations where no acquisition or disposal is the central transaction.',
  },
  {
    id: 'commercial_contracts',
    label: 'Commercial Contracts',
    description: 'Drafting, negotiating and advising on general commercial agreements, supply contracts, distribution and service arrangements.',
    guidance: 'Choose this for standalone commercial agreements (supply, distribution, services) that are not part of a larger M&A, financing or technology-specific engagement.',
  },
  {
    id: 'banking_finance',
    label: 'Banking & Finance',
    description: 'Lending, acquisition finance, refinancing, debt facilities, security arrangements and other financing transactions.',
    guidance: 'Choose this when the principal engagement is a lending or financing transaction, such as a loan refinancing, even if it relates to an underlying acquisition.',
  },
  {
    id: 'commercial_litigation',
    label: 'Commercial Litigation',
    description: 'Court-based commercial disputes, civil proceedings, contractual claims and contentious business matters.',
    guidance: 'Choose this when a contractual or commercial dispute is principally being pursued through court proceedings rather than arbitration or mediation.',
  },
  {
    id: 'arbitration_dispute_resolution',
    label: 'Arbitration & Dispute Resolution',
    description: 'International or domestic arbitration, mediation and alternative dispute resolution proceedings.',
    guidance: 'Choose this when a dispute is principally conducted through arbitration, mediation or another ADR mechanism rather than court litigation.',
  },
  {
    id: 'employment',
    label: 'Employment',
    description: 'Employment contracts, workplace disputes, employment litigation, HR matters and workforce restructuring.',
    guidance: 'Choose this when the principal subject matter concerns the employment relationship itself, not incidental employment terms within a larger transaction.',
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    description: 'Property acquisitions, disposals, leasing, development, land and real estate financing where the principal matter concerns property.',
    guidance: 'Choose this when the central subject of the engagement is a property asset or transaction, as distinct from a broader infrastructure or development project.',
  },
  {
    id: 'intellectual_property',
    label: 'Intellectual Property',
    description: 'Patents, trademarks, copyright, licensing, IP ownership, protection and infringement disputes.',
    guidance: 'Choose this when IP rights (ownership, licensing, protection or infringement) are the principal subject matter.',
  },
  {
    id: 'technology_data_privacy',
    label: 'Technology & Data Privacy',
    description: 'Technology transactions, IT outsourcing, software agreements, cybersecurity, privacy and data protection.',
    guidance: 'Choose this for technology-specific transactions and standalone data protection/privacy compliance engagements, even without an IP dispute.',
  },
  {
    id: 'regulatory_compliance',
    label: 'Regulatory & Compliance',
    description: 'Regulatory advice, licensing, compliance frameworks, regulatory obligations and interactions with regulators.',
    guidance: 'Choose this for advisory or compliance-framework work with a regulator or regulatory regime, as distinct from a fact-finding internal investigation.',
  },
  {
    id: 'tax',
    label: 'Tax',
    description: 'Tax structuring, advisory, compliance, tax disputes and tax implications as the principal engagement.',
    guidance: 'Choose this only where tax advice, structuring or disputes are themselves the principal engagement, not incidental tax input within an M&A or financing deal.',
  },
  {
    id: 'insolvency_restructuring',
    label: 'Insolvency & Restructuring',
    description: 'Financial distress, restructuring, administration, insolvency proceedings and distressed transactions.',
    guidance: 'Choose this when the matter concerns financial distress or formal insolvency/restructuring proceedings, even if a distressed sale resembles an acquisition.',
  },
  {
    id: 'competition_antitrust',
    label: 'Competition & Antitrust',
    description: 'Merger control, competition investigations, antitrust compliance and restrictive trade practices.',
    guidance: 'Choose this when competition/antitrust clearance or investigation is the principal legal issue, not merely a condition of an unrelated M&A deal.',
  },
  {
    id: 'projects_infrastructure',
    label: 'Projects & Infrastructure',
    description: 'Major development projects, public-private partnerships, construction, infrastructure procurement and project agreements.',
    guidance: 'Choose this for large multi-party development/infrastructure projects, as distinct from a straightforward real estate acquisition or disposal.',
  },
  {
    id: 'energy_environment',
    label: 'Energy & Environment',
    description: 'Energy transactions and regulation, environmental law, renewables, emissions and natural resources.',
    guidance: 'Choose this when the principal subject is energy or environmental regulation/transactions, even where it overlaps with infrastructure work.',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    description: 'Insurance coverage, claims, insurance disputes, policies and insurance regulatory matters.',
    guidance: 'Choose this when insurance coverage, claims or policy disputes are the principal subject matter.',
  },
  {
    id: 'private_client_trusts',
    label: 'Private Client & Trusts',
    description: 'Estate planning, wealth structuring, succession, trusts and private client advisory.',
    guidance: 'Choose this for individual/family wealth, estate and trust matters, as distinct from corporate or commercial engagements.',
  },
  {
    id: 'immigration',
    label: 'Immigration',
    description: 'Immigration applications, visas, residency, nationality and corporate immigration matters.',
    guidance: 'Choose this when the principal engagement concerns immigration status, visas or nationality, whether for an individual or on a corporate immigration programme.',
  },
  {
    id: 'investigations',
    label: 'Investigations',
    description: 'Internal investigations, corporate misconduct, fraud inquiries and regulatory investigations where fact-finding is the principal work.',
    guidance: 'Choose this when fact-finding into alleged misconduct is the principal work, as distinct from ongoing regulatory compliance advice.',
  },
]

export const UNCLEAR_MATTER_TYPE: MatterTypeDefinition = {
  id: UNCLEAR_MATTER_TYPE_ID,
  label: 'Unclear / Other',
  description: 'Internal fallback, not one of the 20 official matter types.',
  guidance:
    'Select this where the evidence is insufficient, contradictory, or genuinely outside the taxonomy. Never force an uncertain matter into one of the 20 categories merely to fill the field.',
}

export const ALL_CLASSIFICATION_CHOICES: MatterTypeDefinition[] = [...MATTER_TYPES, UNCLEAR_MATTER_TYPE]

const BY_ID = new Map(ALL_CLASSIFICATION_CHOICES.map((def) => [def.id, def]))

export function isKnownMatterTypeChoice(id: string): id is MatterTypeChoiceId {
  return BY_ID.has(id as MatterTypeChoiceId)
}

export function getMatterTypeDefinition(id: MatterTypeChoiceId): MatterTypeDefinition | undefined {
  return BY_ID.get(id)
}

export function getMatterTypeLabel(id: MatterTypeChoiceId): string {
  return BY_ID.get(id)?.label ?? id
}

/** id/label only -- descriptions and classification guidance are prompt content and stay server-side. */
export function listMatterTypeOptions(): Array<{ id: MatterTypeId; label: string }> {
  return MATTER_TYPES.map((def) => ({ id: def.id, label: def.label }))
}
