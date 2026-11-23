import type { MatterTypeId } from '../matterTypes.js'

export interface EvalCase {
  name: string
  /** Which taxonomy pair this case is meant to disambiguate between -- the overlapping categories named in the Phase 3 spec. */
  pair: string
  expected: MatterTypeId
  markdown: string
}

function matter(title: string, sections: Record<string, string>): string {
  const body = Object.entries(sections)
    .map(([heading, text]) => `## ${heading}\n\n${text}\n`)
    .join('\n')
  return `# Matter Knowledge File: ${title}\n\n${body}`
}

/**
 * Representative synthetic cases covering the pairs of overlapping taxonomy
 * categories called out in the Phase 3 spec, for an initial classification
 * evaluation harness -- not a statistically validated benchmark. See
 * runEvaluation.ts and matterClassification.eval.test.ts.
 */
export const EVAL_CASES: EvalCase[] = [
  {
    name: 'M&A vs Corporate Advisory -- acquisition',
    pair: 'Mergers & Acquisitions vs Corporate Advisory',
    expected: 'mergers_acquisitions',
    markdown: matter('Acme Corp / Widget Inc Acquisition', {
      '1. Matter Overview': 'Acme Corp is acquiring 100% of the share capital of Widget Inc from its founders.',
      '3. Matter Scope and Objectives': 'Negotiate and close a share purchase agreement, conduct due diligence, and complete the acquisition.',
      '5. Key Activities and Work Performed': 'Due diligence, drafting the SPA and disclosure letter, negotiating warranties, signing and completion.',
      '9. Outcomes and Current Position': 'The acquisition completed; Widget Inc is now a wholly owned subsidiary of Acme Corp.',
    }),
  },
  {
    name: 'M&A vs Corporate Advisory -- governance reorganisation',
    pair: 'Mergers & Acquisitions vs Corporate Advisory',
    expected: 'corporate_advisory',
    markdown: matter('Acme Group Internal Reorganisation', {
      '1. Matter Overview': 'Acme Group is reorganising its existing subsidiaries to simplify its corporate structure; no third party is being acquired.',
      '3. Matter Scope and Objectives': 'Advise the board on a group reorganisation, update shareholder agreements, and amend articles of association.',
      '5. Key Activities and Work Performed': 'Board resolutions, intra-group share transfers between existing group companies, governance advice.',
      '9. Outcomes and Current Position': 'The simplified group structure was implemented; no acquisition of a third-party business occurred.',
    }),
  },
  {
    name: 'M&A vs Banking & Finance -- acquisition with financing',
    pair: 'Mergers & Acquisitions vs Banking & Finance',
    expected: 'mergers_acquisitions',
    markdown: matter('Beta Holdings Acquisition of Gamma Ltd', {
      '1. Matter Overview': 'Beta Holdings is acquiring Gamma Ltd, partly funded by a new acquisition facility from its existing bank.',
      '3. Matter Scope and Objectives': 'The principal engagement is the acquisition; the financing is a condition to closing the purchase.',
      '5. Key Activities and Work Performed': 'Negotiated the acquisition agreement; coordinated with lenders counsel on the acquisition facility as a closing condition.',
      '9. Outcomes and Current Position': 'The acquisition completed, funded in part by the new facility.',
    }),
  },
  {
    name: 'M&A vs Banking & Finance -- standalone refinancing',
    pair: 'Mergers & Acquisitions vs Banking & Finance',
    expected: 'banking_finance',
    markdown: matter('Delta Co Refinancing', {
      '1. Matter Overview': 'Delta Co is refinancing its existing senior debt facility with a new syndicate of lenders; there is no acquisition or sale.',
      '3. Matter Scope and Objectives': 'Negotiate and close a new facility agreement, security documents and an intercreditor agreement.',
      '5. Key Activities and Work Performed': 'Drafted and negotiated the facility agreement, security package and intercreditor arrangements.',
      '9. Outcomes and Current Position': 'The refinancing completed and the prior facility was repaid in full.',
    }),
  },
  {
    name: 'Commercial Litigation vs Arbitration -- court proceedings',
    pair: 'Commercial Litigation vs Arbitration & Dispute Resolution',
    expected: 'commercial_litigation',
    markdown: matter('Epsilon v Zeta Contract Claim', {
      '1. Matter Overview': 'Epsilon Ltd has issued High Court proceedings against Zeta Ltd for breach of a supply contract.',
      '3. Matter Scope and Objectives': 'Pursue the breach of contract claim through the civil courts to trial or settlement.',
      '5. Key Activities and Work Performed': 'Drafted particulars of claim, exchanged disclosure, prepared for a case management conference.',
      '9. Outcomes and Current Position': 'Proceedings are ongoing before the High Court; trial is listed for next year.',
    }),
  },
  {
    name: 'Commercial Litigation vs Arbitration -- ICC arbitration',
    pair: 'Commercial Litigation vs Arbitration & Dispute Resolution',
    expected: 'arbitration_dispute_resolution',
    markdown: matter('Eta v Theta ICC Arbitration', {
      '1. Matter Overview': 'Eta Ltd has commenced ICC arbitration against Theta Ltd pursuant to the arbitration clause in their joint venture agreement.',
      '3. Matter Scope and Objectives': 'Pursue the claim through ICC arbitration seated in London.',
      '5. Key Activities and Work Performed': 'Filed a request for arbitration, appointed an arbitrator, prepared the statement of claim.',
      '9. Outcomes and Current Position': 'The arbitral tribunal has been constituted; the merits hearing is scheduled.',
    }),
  },
  {
    name: 'Commercial Contracts vs Technology & Data Privacy -- generic supply agreement',
    pair: 'Commercial Contracts vs Technology & Data Privacy',
    expected: 'commercial_contracts',
    markdown: matter('Iota Supply Agreement', {
      '1. Matter Overview': 'Iota Ltd is negotiating a multi-year supply agreement with a manufacturer for physical components.',
      '3. Matter Scope and Objectives': 'Draft and negotiate pricing, delivery, and quality-control terms for the supply arrangement.',
      '5. Key Activities and Work Performed': 'Drafted the supply agreement, negotiated liability caps and termination rights.',
      '9. Outcomes and Current Position': 'The supply agreement was signed by both parties.',
    }),
  },
  {
    name: 'Commercial Contracts vs Technology & Data Privacy -- data protection compliance',
    pair: 'Commercial Contracts vs Technology & Data Privacy',
    expected: 'technology_data_privacy',
    markdown: matter('Kappa Data Protection Compliance Review', {
      '1. Matter Overview': 'Kappa Ltd engaged the firm for a standalone review of its data protection compliance framework ahead of a regulatory audit.',
      '3. Matter Scope and Objectives': 'Assess GDPR compliance, update the data processing register, and advise on cross-border transfer mechanisms.',
      '5. Key Activities and Work Performed': 'Reviewed data processing agreements, advised on standard contractual clauses, updated privacy notices.',
      '9. Outcomes and Current Position': 'A compliance gap-analysis report and remediation plan were delivered.',
    }),
  },
  {
    name: 'Regulatory & Compliance vs Investigations -- ongoing licensing advice',
    pair: 'Regulatory & Compliance vs Investigations',
    expected: 'regulatory_compliance',
    markdown: matter('Lambda Financial Services Licensing', {
      '1. Matter Overview': 'Lambda Ltd requires ongoing advice on maintaining its financial services licence and complying with conduct-of-business rules.',
      '3. Matter Scope and Objectives': 'Advise on regulatory obligations, licence conditions, and interactions with the regulator.',
      '5. Key Activities and Work Performed': 'Reviewed policies against regulatory requirements, advised on licence variations, liaised with the regulator.',
      '9. Outcomes and Current Position': 'Lambda Ltd remains compliant and its licence conditions were varied as advised.',
    }),
  },
  {
    name: 'Regulatory & Compliance vs Investigations -- internal fraud inquiry',
    pair: 'Regulatory & Compliance vs Investigations',
    expected: 'investigations',
    markdown: matter('Mu Ltd Internal Fraud Inquiry', {
      '1. Matter Overview': 'Mu Ltd\'s audit committee commissioned an internal investigation into alleged expense fraud by a senior employee.',
      '3. Matter Scope and Objectives': 'Conduct a fact-finding investigation, interview witnesses, and report findings to the audit committee.',
      '5. Key Activities and Work Performed': 'Reviewed financial records, conducted witness interviews, prepared an investigation report.',
      '9. Outcomes and Current Position': 'The investigation concluded that fraud had occurred; the matter was referred to HR for disciplinary action.',
    }),
  },
  {
    name: 'Real Estate vs Projects & Infrastructure -- single property acquisition',
    pair: 'Real Estate vs Projects & Infrastructure',
    expected: 'real_estate',
    markdown: matter('Nu Ltd Office Building Purchase', {
      '1. Matter Overview': 'Nu Ltd is acquiring a single commercial office building for its own occupation.',
      '3. Matter Scope and Objectives': 'Negotiate and complete the purchase of the freehold property.',
      '5. Key Activities and Work Performed': 'Conducted title due diligence, negotiated the sale contract, dealt with completion and registration.',
      '9. Outcomes and Current Position': 'The purchase completed and title was registered in Nu Ltd\'s name.',
    }),
  },
  {
    name: 'Real Estate vs Projects & Infrastructure -- multi-party PPP development',
    pair: 'Real Estate vs Projects & Infrastructure',
    expected: 'projects_infrastructure',
    markdown: matter('Xi Toll Road PPP', {
      '1. Matter Overview': 'A consortium is developing a new toll road under a public-private partnership with the national highways authority.',
      '3. Matter Scope and Objectives': 'Negotiate the concession agreement, construction contracts, and project financing arrangements with multiple stakeholders.',
      '5. Key Activities and Work Performed': 'Drafted the concession agreement, coordinated construction and offtake arrangements, advised on procurement.',
      '9. Outcomes and Current Position': 'Financial close was reached on the infrastructure project.',
    }),
  },
  {
    name: 'Insolvency & Restructuring vs Banking & Finance -- distressed restructuring',
    pair: 'Insolvency & Restructuring vs Banking & Finance',
    expected: 'insolvency_restructuring',
    markdown: matter('Omicron Group Restructuring', {
      '1. Matter Overview': 'Omicron Group is in financial distress and is undertaking a formal restructuring to avoid insolvency, including a creditor scheme of arrangement.',
      '3. Matter Scope and Objectives': 'Advise the company on restructuring options, negotiate with creditors, and implement a scheme of arrangement.',
      '5. Key Activities and Work Performed': 'Advised on administration alternatives, negotiated standstill arrangements, prepared the restructuring plan.',
      '9. Outcomes and Current Position': 'The scheme of arrangement was approved by creditors and the court.',
    }),
  },
  {
    name: 'Insolvency & Restructuring vs Banking & Finance -- ordinary facility amendment',
    pair: 'Insolvency & Restructuring vs Banking & Finance',
    expected: 'banking_finance',
    markdown: matter('Pi Ltd Facility Amendment', {
      '1. Matter Overview': 'Pi Ltd, a solvent and performing company, is amending and extending its existing revolving credit facility on ordinary commercial terms.',
      '3. Matter Scope and Objectives': 'Negotiate amended pricing and covenants and extend the facility maturity date.',
      '5. Key Activities and Work Performed': 'Negotiated an amendment and restatement agreement with the existing lender group.',
      '9. Outcomes and Current Position': 'The amended facility was signed; Pi Ltd remains solvent and in good standing.',
    }),
  },
  {
    name: 'Energy & Environment vs Projects & Infrastructure -- offshore wind development',
    pair: 'Energy & Environment vs Projects & Infrastructure',
    expected: 'energy_environment',
    markdown: matter('Rho Offshore Wind Farm', {
      '1. Matter Overview': 'Rho Energy is developing an offshore wind farm, including grid connection agreements and renewable energy subsidy arrangements.',
      '3. Matter Scope and Objectives': 'Advise on energy regulatory consents, power purchase agreements, and renewable subsidy qualification.',
      '5. Key Activities and Work Performed': 'Negotiated power purchase agreements, advised on emissions and renewables regulation, secured grid connection consents.',
      '9. Outcomes and Current Position': 'Regulatory consents were obtained and the power purchase agreement was executed.',
    }),
  },
  {
    name: 'Energy & Environment vs Projects & Infrastructure -- general construction project',
    pair: 'Energy & Environment vs Projects & Infrastructure',
    expected: 'projects_infrastructure',
    markdown: matter('Sigma Hospital Construction Project', {
      '1. Matter Overview': 'Sigma Health Trust is procuring the construction of a new hospital building under a standard construction contract.',
      '3. Matter Scope and Objectives': 'Negotiate the construction contract, manage procurement, and coordinate multiple contractors.',
      '5. Key Activities and Work Performed': 'Drafted the construction contract, advised on procurement process, managed variation claims.',
      '9. Outcomes and Current Position': 'Construction is underway and on schedule for practical completion.',
    }),
  },
]
