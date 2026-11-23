import { ALL_CLASSIFICATION_CHOICES, UNCLEAR_MATTER_TYPE_ID } from './matterTypes.js'

/**
 * All 16 classification dimensions, each classified by its own, independent
 * Decisions API call against the same completed Matter Knowledge Markdown.
 * `matter_type` reuses the original, richly-described taxonomy
 * (matterTypes.ts); the other 15 are flatter enumerations with a short,
 * neutral instruction each -- no per-choice disambiguation guidance was
 * specified for them, unlike matter_type's overlapping-category guidance.
 */
export type ClassificationFieldId =
  | 'matter_type'
  | 'practice_area'
  | 'industry_sector'
  | 'matter_subtype'
  | 'jurisdiction'
  | 'client_role'
  | 'transaction_type'
  | 'dispute_type'
  | 'matter_complexity'
  | 'matter_stage'
  | 'risk_level'
  | 'cross_border'
  | 'counterparty_type'
  | 'regulatory_involvement'
  | 'commercial_objective'
  | 'matter_outcome'

export interface ClassificationChoice {
  id: string
  label: string
  /** Sent to the Decisions API as the choice's description -- defaults to the label when no extra guidance is needed. */
  description?: string
}

export interface ClassificationFieldDefinition {
  id: ClassificationFieldId
  label: string
  /** Unique per field -- becomes the Decisions API question's `name`, used to match the answer back to this field. */
  questionName: string
  instructions: string
  choices: ClassificationChoice[]
}

function choices(labels: Array<[id: string, label: string]>): ClassificationChoice[] {
  return labels.map(([id, label]) => ({ id, label }))
}

const MATTER_TYPE_FIELD: ClassificationFieldDefinition = {
  id: 'matter_type',
  label: 'Matter Type',
  questionName: 'matter_type',
  instructions:
    'Determine the primary legal matter type described in this Matter Knowledge File. Classify based on the overall legal ' +
    'engagement, principal activities undertaken, purpose of the matter and substantive deliverables. Do not classify solely ' +
    'by the client industry, names of documents, the presence of particular legal terminology or incidental secondary work. ' +
    'Where multiple categories are relevant, select the category that best represents the central purpose of the engagement. ' +
    'If the evidence is insufficient, contradictory or does not support any category, select Unclear / Other.',
  choices: ALL_CLASSIFICATION_CHOICES.map((def) => ({
    id: def.id,
    label: def.label,
    description: `${def.label}: ${def.description} ${def.guidance}`,
  })),
}

export const OTHER_CLASSIFICATION_FIELDS: ClassificationFieldDefinition[] = [
  {
    id: 'practice_area',
    label: 'Practice Area',
    questionName: 'practice_area',
    instructions: 'Select the practice area that most specifically describes the principal legal work performed in this matter.',
    choices: choices([
      ['corporate', 'Corporate'],
      ['banking_finance', 'Banking & Finance'],
      ['dispute_resolution', 'Dispute Resolution'],
      ['real_estate', 'Real Estate'],
      ['employment', 'Employment'],
      ['intellectual_property', 'Intellectual Property'],
      ['technology', 'Technology'],
      ['regulatory', 'Regulatory'],
      ['tax', 'Tax'],
      ['private_client', 'Private Client'],
    ]),
  },
  {
    id: 'industry_sector',
    label: 'Industry Sector',
    questionName: 'industry_sector',
    instructions: 'Select the industry sector of the client or the business primarily affected by this matter.',
    choices: choices([
      ['financial_services', 'Financial Services'],
      ['technology', 'Technology'],
      ['energy_utilities', 'Energy & Utilities'],
      ['healthcare_life_sciences', 'Healthcare & Life Sciences'],
      ['real_estate_construction', 'Real Estate & Construction'],
      ['manufacturing', 'Manufacturing'],
      ['retail_consumer', 'Retail & Consumer'],
      ['telecommunications', 'Telecommunications'],
      ['media_entertainment', 'Media & Entertainment'],
      ['transportation_logistics', 'Transportation & Logistics'],
      ['insurance', 'Insurance'],
      ['government_public_sector', 'Government & Public Sector'],
      ['professional_services', 'Professional Services'],
      ['agriculture', 'Agriculture'],
      ['mining_natural_resources', 'Mining & Natural Resources'],
    ]),
  },
  {
    id: 'matter_subtype',
    label: 'Matter Subtype',
    questionName: 'matter_subtype',
    instructions: 'Select the subtype that most specifically describes this matter within its broader matter type.',
    choices: choices([
      ['share_acquisition', 'Share Acquisition'],
      ['asset_acquisition', 'Asset Acquisition'],
      ['business_disposal', 'Business Disposal'],
      ['joint_venture', 'Joint Venture'],
      ['corporate_restructuring', 'Corporate Restructuring'],
      ['contract_negotiation', 'Contract Negotiation'],
      ['contract_dispute', 'Contract Dispute'],
      ['regulatory_investigation', 'Regulatory Investigation'],
      ['debt_financing', 'Debt Financing'],
      ['loan_refinancing', 'Loan Refinancing'],
      ['employment_dispute', 'Employment Dispute'],
      ['intellectual_property_dispute', 'Intellectual Property Dispute'],
      ['commercial_property_transaction', 'Commercial Property Transaction'],
      ['insolvency_proceedings', 'Insolvency Proceedings'],
    ]),
  },
  {
    id: 'jurisdiction',
    label: 'Jurisdiction',
    questionName: 'jurisdiction',
    instructions:
      'Select the primary governing jurisdiction for this matter. Choose International / Multi-Jurisdictional only if no single jurisdiction predominates.',
    choices: choices([
      ['england_wales', 'England & Wales'],
      ['scotland', 'Scotland'],
      ['northern_ireland', 'Northern Ireland'],
      ['united_states', 'United States'],
      ['new_york', 'New York'],
      ['delaware', 'Delaware'],
      ['australia', 'Australia'],
      ['singapore', 'Singapore'],
      ['hong_kong', 'Hong Kong'],
      ['european_union', 'European Union'],
      ['germany', 'Germany'],
      ['france', 'France'],
      ['china', 'China'],
      ['international_multi_jurisdictional', 'International / Multi-Jurisdictional'],
    ]),
  },
  {
    id: 'client_role',
    label: 'Client Role',
    questionName: 'client_role',
    instructions: "Select the role the firm's client played in this matter.",
    choices: choices([
      ['buyer', 'Buyer'],
      ['seller', 'Seller'],
      ['lender', 'Lender'],
      ['borrower', 'Borrower'],
      ['investor', 'Investor'],
      ['target_company', 'Target Company'],
      ['claimant', 'Claimant'],
      ['defendant', 'Defendant'],
      ['applicant', 'Applicant'],
      ['respondent', 'Respondent'],
      ['landlord', 'Landlord'],
      ['tenant', 'Tenant'],
      ['employer', 'Employer'],
      ['employee', 'Employee'],
      ['advisor', 'Advisor'],
      ['regulated_entity', 'Regulated Entity'],
    ]),
  },
  {
    id: 'transaction_type',
    label: 'Transaction Type',
    questionName: 'transaction_type',
    instructions: 'Select the type of transaction this matter principally involved, if any.',
    choices: choices([
      ['acquisition', 'Acquisition'],
      ['disposal', 'Disposal'],
      ['merger', 'Merger'],
      ['joint_venture', 'Joint Venture'],
      ['investment', 'Investment'],
      ['financing', 'Financing'],
      ['refinancing', 'Refinancing'],
      ['restructuring', 'Restructuring'],
      ['public_offering', 'Public Offering'],
      ['private_placement', 'Private Placement'],
      ['licensing', 'Licensing'],
      ['outsourcing', 'Outsourcing'],
      ['commercial_agreement', 'Commercial Agreement'],
    ]),
  },
  {
    id: 'dispute_type',
    label: 'Dispute Type',
    questionName: 'dispute_type',
    instructions: 'Select the type of dispute this matter principally involved, if any.',
    choices: choices([
      ['breach_of_contract', 'Breach of Contract'],
      ['professional_negligence', 'Professional Negligence'],
      ['shareholder_dispute', 'Shareholder Dispute'],
      ['employment_dispute', 'Employment Dispute'],
      ['intellectual_property_infringement', 'Intellectual Property Infringement'],
      ['regulatory_enforcement', 'Regulatory Enforcement'],
      ['fraud', 'Fraud'],
      ['debt_recovery', 'Debt Recovery'],
      ['construction_dispute', 'Construction Dispute'],
      ['insurance_coverage_dispute', 'Insurance Coverage Dispute'],
      ['competition_dispute', 'Competition Dispute'],
    ]),
  },
  {
    id: 'matter_complexity',
    label: 'Matter Complexity',
    questionName: 'matter_complexity',
    instructions:
      'Assess the overall complexity of this matter based on its scope, number of parties, and the range of legal issues involved.',
    choices: choices([
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
      ['very_high', 'Very High'],
    ]),
  },
  {
    id: 'matter_stage',
    label: 'Matter Stage',
    questionName: 'matter_stage',
    instructions: 'Select the stage the matter had reached as of the end of the Matter Knowledge File.',
    choices: choices([
      ['initial_advisory', 'Initial Advisory'],
      ['planning', 'Planning'],
      ['due_diligence', 'Due Diligence'],
      ['negotiation', 'Negotiation'],
      ['drafting', 'Drafting'],
      ['regulatory_approval', 'Regulatory Approval'],
      ['execution', 'Execution'],
      ['completion', 'Completion'],
      ['litigation', 'Litigation'],
      ['settlement', 'Settlement'],
      ['closed', 'Closed'],
    ]),
  },
  {
    id: 'risk_level',
    label: 'Risk Level',
    questionName: 'risk_level',
    instructions: 'Assess the overall legal and commercial risk level of this matter.',
    choices: choices([
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
      ['critical', 'Critical'],
    ]),
  },
  {
    id: 'cross_border',
    label: 'Cross-Border',
    questionName: 'cross_border',
    instructions: 'Did this matter involve parties, assets, or legal issues spanning more than one country?',
    choices: choices([
      ['yes', 'Yes'],
      ['no', 'No'],
    ]),
  },
  {
    id: 'counterparty_type',
    label: 'Counterparty Type',
    questionName: 'counterparty_type',
    instructions: "Select the type of the principal counterparty to the firm's client in this matter.",
    choices: choices([
      ['private_company', 'Private Company'],
      ['public_company', 'Public Company'],
      ['financial_institution', 'Financial Institution'],
      ['government_entity', 'Government Entity'],
      ['individual', 'Individual'],
      ['partnership', 'Partnership'],
      ['investment_fund', 'Investment Fund'],
      ['regulatory_authority', 'Regulatory Authority'],
      ['non_profit_organisation', 'Non-Profit Organisation'],
    ]),
  },
  {
    id: 'regulatory_involvement',
    label: 'Regulatory Involvement',
    questionName: 'regulatory_involvement',
    instructions: 'Select which regulator, if any, was principally involved in this matter. Select None if no regulator was involved.',
    choices: choices([
      ['none', 'None'],
      ['fca', 'Financial Conduct Authority (FCA)'],
      ['pra', 'Prudential Regulation Authority (PRA)'],
      ['cma', 'Competition and Markets Authority (CMA)'],
      ['sec', 'Securities and Exchange Commission (SEC)'],
      ['european_commission', 'European Commission'],
      ['ico', "Information Commissioner's Office (ICO)"],
      ['other_regulatory_authority', 'Other Regulatory Authority'],
    ]),
  },
  {
    id: 'commercial_objective',
    label: 'Commercial Objective',
    questionName: 'commercial_objective',
    instructions: "Select the client's principal commercial objective in engaging the firm for this matter.",
    choices: choices([
      ['acquire_business', 'Acquire Business'],
      ['sell_business', 'Sell Business'],
      ['raise_capital', 'Raise Capital'],
      ['secure_financing', 'Secure Financing'],
      ['resolve_dispute', 'Resolve Dispute'],
      ['protect_intellectual_property', 'Protect Intellectual Property'],
      ['ensure_regulatory_compliance', 'Ensure Regulatory Compliance'],
      ['restructure_business', 'Restructure Business'],
      ['manage_legal_risk', 'Manage Legal Risk'],
      ['enter_new_market', 'Enter New Market'],
      ['negotiate_commercial_agreement', 'Negotiate Commercial Agreement'],
    ]),
  },
  {
    id: 'matter_outcome',
    label: 'Matter Outcome',
    questionName: 'matter_outcome',
    instructions: 'Select the current or final outcome of this matter as described in the Matter Knowledge File.',
    choices: choices([
      ['completed', 'Completed'],
      ['settled', 'Settled'],
      ['successful_judgment', 'Successful Judgment'],
      ['unsuccessful_judgment', 'Unsuccessful Judgment'],
      ['withdrawn', 'Withdrawn'],
      ['terminated', 'Terminated'],
      ['ongoing', 'Ongoing'],
      ['unknown', 'Unknown'],
    ]),
  },
]

/** All 16 fields, in the order they're classified and displayed. */
export const CLASSIFICATION_FIELDS: ClassificationFieldDefinition[] = [MATTER_TYPE_FIELD, ...OTHER_CLASSIFICATION_FIELDS]

const FIELDS_BY_ID = new Map(CLASSIFICATION_FIELDS.map((field) => [field.id, field]))
const CHOICES_BY_FIELD = new Map(CLASSIFICATION_FIELDS.map((field) => [field.id, new Map(field.choices.map((c) => [c.id, c]))]))

export function getClassificationField(fieldId: string): ClassificationFieldDefinition | undefined {
  return FIELDS_BY_ID.get(fieldId as ClassificationFieldId)
}

export function isKnownClassificationField(fieldId: string): fieldId is ClassificationFieldId {
  return FIELDS_BY_ID.has(fieldId as ClassificationFieldId)
}

export function isKnownChoice(fieldId: string, choiceId: string): boolean {
  return CHOICES_BY_FIELD.get(fieldId as ClassificationFieldId)?.has(choiceId) ?? false
}

export function getChoiceLabel(fieldId: string, choiceId: string): string {
  return CHOICES_BY_FIELD.get(fieldId as ClassificationFieldId)?.get(choiceId)?.label ?? choiceId
}

/** Specific to matter_type -- the only field with an internal "don't force a guess" fallback. */
export function isUnclearMatterType(fieldId: string, choiceId: string): boolean {
  return fieldId === 'matter_type' && choiceId === UNCLEAR_MATTER_TYPE_ID
}

/** id/label only per field -- for the correction Selects. Descriptions/instructions are prompt content and stay server-side. */
export function listClassificationFieldOptions(): Array<{ fieldId: ClassificationFieldId; label: string; choices: Array<{ id: string; label: string }> }> {
  return CLASSIFICATION_FIELDS.map((field) => ({
    fieldId: field.id,
    label: field.label,
    choices: field.choices.map((c) => ({ id: c.id, label: c.label })),
  }))
}
