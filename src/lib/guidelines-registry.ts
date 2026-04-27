// Central registry of all available guidelines
// Add entries here after running the ingestion script for a new PDF

export interface Guideline {
  id: string;
  name: string;
  shortName: string;
  category: "ICH" | "EU_GMP" | "FDA" | "WHO" | "ISO";
  description: string;
  fileName: string; // PDF filename in /guidelines/pdfs/
  ingested: boolean; // Set to true after running ingest script
}

export const GUIDELINES: Guideline[] = [
  {
    id: "ICH-Q7",
    name: "ICH Q7 - Good Manufacturing Practice for APIs",
    shortName: "ICH Q7",
    category: "ICH",
    description: "GMP guide for active pharmaceutical ingredient manufacturing",
    fileName: "ICH_Q7.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q8R2",
    name: "ICH Q8(R2) - Pharmaceutical Development",
    shortName: "ICH Q8(R2)",
    category: "ICH",
    description: "Quality by Design principles and pharmaceutical development",
    fileName: "ICH_Q8R2.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q9R1",
    name: "ICH Q9(R1) - Quality Risk Management",
    shortName: "ICH Q9(R1)",
    category: "ICH",
    description: "Principles and tools for quality risk management",
    fileName: "ICH_Q9R1.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q10",
    name: "ICH Q10 - Pharmaceutical Quality System",
    shortName: "ICH Q10",
    category: "ICH",
    description: "Pharmaceutical quality system across the product lifecycle",
    fileName: "ICH_Q10.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q11",
    name: "ICH Q11 - Development and Manufacture of Drug Substances",
    shortName: "ICH Q11",
    category: "ICH",
    description: "Development and manufacture of drug substances (chemical and biological)",
    fileName: "ICH_Q11.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q12",
    name: "ICH Q12 - Lifecycle Management",
    shortName: "ICH Q12",
    category: "ICH",
    description: "Technical and regulatory considerations for pharmaceutical product lifecycle management",
    fileName: "ICH_Q12.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q13",
    name: "ICH Q13 - Continuous Manufacturing",
    shortName: "ICH Q13",
    category: "ICH",
    description: "Continuous manufacturing of drug substances and drug products",
    fileName: "ICH_Q13.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q14",
    name: "ICH Q14 - Analytical Procedure Development",
    shortName: "ICH Q14",
    category: "ICH",
    description: "Analytical procedure development principles",
    fileName: "ICH_Q14.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q2R2",
    name: "ICH Q2(R2) - Analytical Validation",
    shortName: "ICH Q2(R2)",
    category: "ICH",
    description: "Validation of analytical procedures",
    fileName: "ICH_Q2R2.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q3AR2",
    name: "ICH Q3A(R2) - Impurities in Drug Substances",
    shortName: "ICH Q3A(R2)",
    category: "ICH",
    description: "Impurities in new drug substances",
    fileName: "ICH_Q3AR2.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q3BR2",
    name: "ICH Q3B(R2) - Impurities in Drug Products",
    shortName: "ICH Q3B(R2)",
    category: "ICH",
    description: "Impurities in new drug products",
    fileName: "ICH_Q3BR2.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q3CR8",
    name: "ICH Q3C(R8) - Residual Solvents",
    shortName: "ICH Q3C(R8)",
    category: "ICH",
    description: "Residual solvents in pharmaceuticals",
    fileName: "ICH_Q3CR8.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q3DR2",
    name: "ICH Q3D(R2) - Elemental Impurities",
    shortName: "ICH Q3D(R2)",
    category: "ICH",
    description: "Elemental impurities in pharmaceutical products",
    fileName: "ICH_Q3DR2.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q6A",
    name: "ICH Q6A - Specifications: Chemical Substances",
    shortName: "ICH Q6A",
    category: "ICH",
    description: "Specifications for new drug substances and products (chemical)",
    fileName: "ICH_Q6A.pdf",
    ingested: false,
  },
  {
    id: "ICH-Q1AR2",
    name: "ICH Q1A(R2) - Stability Testing",
    shortName: "ICH Q1A(R2)",
    category: "ICH",
    description: "Stability testing of new drug substances and products",
    fileName: "ICH_Q1AR2.pdf",
    ingested: false,
  },
  {
    id: "EU-GMP-ANNEX1",
    name: "EU GMP Annex 1 (2022) - Sterile Medicinal Products",
    shortName: "EU GMP Annex 1",
    category: "EU_GMP",
    description: "Manufacture of sterile medicinal products",
    fileName: "EU_GMP_Annex1_2022.pdf",
    ingested: false,
  },
  {
    id: "EU-GMP-ANNEX11",
    name: "EU GMP Annex 11 - Computerised Systems",
    shortName: "EU GMP Annex 11",
    category: "EU_GMP",
    description: "Requirements for computerised systems in GMP environments",
    fileName: "EU_GMP_Annex11.pdf",
    ingested: false,
  },
  {
    id: "EU-GMP-ANNEX15",
    name: "EU GMP Annex 15 - Qualification and Validation",
    shortName: "EU GMP Annex 15",
    category: "EU_GMP",
    description: "Qualification and validation principles and practices",
    fileName: "EU_GMP_Annex15.pdf",
    ingested: false,
  },
  {
    id: "EU-GMP-PART1",
    name: "EU GMP Part I - Basic Requirements",
    shortName: "EU GMP Part I",
    category: "EU_GMP",
    description: "Basic GMP requirements for medicinal products",
    fileName: "EU_GMP_Part1.pdf",
    ingested: false,
  },
  {
    id: "EU-GMP-PART2",
    name: "EU GMP Part II - Active Substances (API GMP)",
    shortName: "EU GMP Part II",
    category: "EU_GMP",
    description: "GMP for active substances used as starting materials",
    fileName: "EU_GMP_Part2.pdf",
    ingested: false,
  },
  {
    id: "FDA-CFR-PART11",
    name: "21 CFR Part 11 - Electronic Records & Signatures",
    shortName: "21 CFR Part 11",
    category: "FDA",
    description: "Electronic records and electronic signatures requirements",
    fileName: "FDA_21CFR_Part11.pdf",
    ingested: false,
  },
  {
    id: "FDA-CFR-PART211",
    name: "21 CFR Part 211 - cGMP for Finished Pharmaceuticals",
    shortName: "21 CFR Part 211",
    category: "FDA",
    description: "Current GMP regulations for finished pharmaceutical products",
    fileName: "FDA_21CFR_Part211.pdf",
    ingested: false,
  },
  {
    id: "FDA-PROCESS-VAL-2011",
    name: "FDA Process Validation Guidance 2011",
    shortName: "FDA PV 2011",
    category: "FDA",
    description: "General principles and practices for process validation",
    fileName: "FDA_ProcessValidation_2011.pdf",
    ingested: false,
  },
  {
    id: "FDA-PART11-SCOPE",
    name: "FDA 21 CFR Part 11 Scope & Application Guidance",
    shortName: "FDA Part 11 Guidance",
    category: "FDA",
    description: "FDA's interpretation guidance on scope and application of Part 11",
    fileName: "FDA_Part11_ScopeApplication.pdf",
    ingested: false,
  },
  {
    id: "WHO-GMP-TRS986",
    name: "WHO GMP TRS 986 Annex 2",
    shortName: "WHO GMP",
    category: "WHO",
    description: "WHO good manufacturing practices for pharmaceutical products",
    fileName: "WHO_GMP_TRS986_Annex2.pdf",
    ingested: false,
  },
];

export const GUIDELINES_BY_CATEGORY = GUIDELINES.reduce(
  (acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category].push(g);
    return acc;
  },
  {} as Record<string, Guideline[]>
);

export const INGESTED_GUIDELINES = GUIDELINES.filter((g) => g.ingested);
