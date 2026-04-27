export interface Guideline {
  id: string;
  name: string;
  shortName: string;
  category: "ICH" | "EU_GMP" | "FDA" | "WHO" | "ISO";
  description: string;
  fileName: string;
  ingested: boolean;
}

export const GUIDELINES: Guideline[] = [
  // ICH Q1 - Stability
  { id: "ICH-Q1AR2", name: "ICH Q1A(R2) - Stability Testing of New Drug Substances and Products", shortName: "ICH Q1A(R2)", category: "ICH", description: "Stability testing protocols, conditions, and duration", fileName: "Q1A(R2) Guideline.pdf", ingested: true },
  { id: "ICH-Q1B", name: "ICH Q1B - Stability Testing: Photostability", shortName: "ICH Q1B", category: "ICH", description: "Photostability testing of new drug substances and products", fileName: "Q1B Guideline.pdf", ingested: true },
  { id: "ICH-Q1C", name: "ICH Q1C - Stability Testing: New Dosage Forms", shortName: "ICH Q1C", category: "ICH", description: "Stability for new dosage forms", fileName: "Q1C Guideline.pdf", ingested: true },
  { id: "ICH-Q1D", name: "ICH Q1D - Bracketing and Matrixing", shortName: "ICH Q1D", category: "ICH", description: "Bracketing and matrixing designs for stability testing", fileName: "Q1D Guideline.pdf", ingested: true },
  { id: "ICH-Q1E", name: "ICH Q1E - Evaluation of Stability Data", shortName: "ICH Q1E", category: "ICH", description: "Evaluation and statistical analysis of stability data", fileName: "Q1E Guideline.pdf", ingested: true },
  // ICH Q2 - Analytical Validation
  { id: "ICH-Q2R2", name: "ICH Q2(R2) - Analytical Procedure Validation", shortName: "ICH Q2(R2)", category: "ICH", description: "Validation of analytical procedures", fileName: "ICH_Q2(R2)_Guideline_2023_1130_ErrorCorrection_2025.pdf", ingested: true },
  // ICH Q3 - Impurities
  { id: "ICH-Q3AR2", name: "ICH Q3A(R2) - Impurities in Drug Substances", shortName: "ICH Q3A(R2)", category: "ICH", description: "Impurities in new drug substances", fileName: "Q3A(R2) Guideline.pdf", ingested: true },
  { id: "ICH-Q3BR2", name: "ICH Q3B(R2) - Impurities in Drug Products", shortName: "ICH Q3B(R2)", category: "ICH", description: "Impurities in new drug products", fileName: "Q3B(R2) Guideline.pdf", ingested: true },
  { id: "ICH-Q3CR9", name: "ICH Q3C(R9) - Residual Solvents", shortName: "ICH Q3C(R9)", category: "ICH", description: "Residual solvents classification and limits", fileName: "ICH_Q3C(R9)_Guideline_MinorRevision_2024_2024_Approved.pdf", ingested: true },
  { id: "ICH-Q3DR2", name: "ICH Q3D(R2) - Elemental Impurities", shortName: "ICH Q3D(R2)", category: "ICH", description: "Elemental impurities limits in pharmaceutical products", fileName: "Q3D-R2_Guideline_Step4_2022_0308.pdf", ingested: true },
  // ICH Q4B - Pharmacopoeias
  { id: "ICH-Q4B", name: "ICH Q4B - Regulatory Acceptance of Pharmacopoeial Interchangeability", shortName: "ICH Q4B", category: "ICH", description: "Evaluation and recommendation of pharmacopoeial texts", fileName: "Q4B Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A1", name: "ICH Q4B Annex 1(R1) - Residue on Ignition", shortName: "ICH Q4B Annex 1", category: "ICH", description: "Residue on ignition/sulphated ash general chapter", fileName: "Q4B Annex 1(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A2", name: "ICH Q4B Annex 2(R1) - Test for Extractable Volume", shortName: "ICH Q4B Annex 2", category: "ICH", description: "Test for extractable volume of parenteral preparations", fileName: "Q4B Annex 2(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A3", name: "ICH Q4B Annex 3(R1) - Test for Particulate Contamination", shortName: "ICH Q4B Annex 3", category: "ICH", description: "Test for particulate contamination: sub-visible particles", fileName: "Q4B Annex 3(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A4A", name: "ICH Q4B Annex 4A(R1) - Microbiological Examination (Non-Sterile)", shortName: "ICH Q4B Annex 4A", category: "ICH", description: "Microbiological examination of non-sterile products", fileName: "Q4B Annex4A(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A4B", name: "ICH Q4B Annex 4B(R1) - Microbiological Examination (Specified Organisms)", shortName: "ICH Q4B Annex 4B", category: "ICH", description: "Tests for specified micro-organisms", fileName: "Q4B Annex4B(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A4C", name: "ICH Q4B Annex 4C(R1) - Microbiological Examination (Acceptance Criteria)", shortName: "ICH Q4B Annex 4C", category: "ICH", description: "Acceptance criteria for pharmaceutical preparations", fileName: "Q4B Annex4C(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A5", name: "ICH Q4B Annex 5(R1) - Disintegration Test", shortName: "ICH Q4B Annex 5", category: "ICH", description: "Disintegration test for tablets and capsules", fileName: "Q4B Annex 5(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A6", name: "ICH Q4B Annex 6 - Uniformity of Dosage Units", shortName: "ICH Q4B Annex 6", category: "ICH", description: "Uniformity of dosage units", fileName: "Q4B Annex 6 Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A7", name: "ICH Q4B Annex 7(R2) - Dissolution Test", shortName: "ICH Q4B Annex 7", category: "ICH", description: "Dissolution test for solid oral dosage forms", fileName: "Q4B Annex 7 (R2) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A8", name: "ICH Q4B Annex 8(R1) - Sterility", shortName: "ICH Q4B Annex 8", category: "ICH", description: "Sterility test", fileName: "Q4B Annex 8(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A9", name: "ICH Q4B Annex 9(R1) - Tablet Friability", shortName: "ICH Q4B Annex 9", category: "ICH", description: "Tablet friability test", fileName: "Q4B Annex 9(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A10", name: "ICH Q4B Annex 10(R1) - Polyacrylamide Gel Electrophoresis", shortName: "ICH Q4B Annex 10", category: "ICH", description: "Polyacrylamide gel electrophoresis", fileName: "Q4B Annex 10(R1) Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A11", name: "ICH Q4B Annex 11 - Capillary Electrophoresis", shortName: "ICH Q4B Annex 11", category: "ICH", description: "Capillary electrophoresis", fileName: "Q4B Annex 11 Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A12", name: "ICH Q4B Annex 12 - Analytical Sieving", shortName: "ICH Q4B Annex 12", category: "ICH", description: "Analytical sieving general chapter", fileName: "Q4B Annex 12 Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A13", name: "ICH Q4B Annex 13 - Bulk Density and Tapped Density", shortName: "ICH Q4B Annex 13", category: "ICH", description: "Bulk density and tapped density of powders", fileName: "Q4B Annex 13 Guideline.pdf", ingested: true },
  { id: "ICH-Q4B-A14", name: "ICH Q4B Annex 14 - Bacterial Endotoxins Test", shortName: "ICH Q4B Annex 14", category: "ICH", description: "Bacterial endotoxins test", fileName: "Q4B Annex 14 Guideline.pdf", ingested: true },
  { id: "ICH-Q4BR1", name: "ICH Q4B(R1) - Guideline Revision", shortName: "ICH Q4B(R1)", category: "ICH", description: "Regulatory acceptance of pharmacopoeial texts revision", fileName: "ICH_Q4B(R1)_Guideline_2024_0605.pdf", ingested: true },
  // ICH Q5 - Biotech
  { id: "ICH-Q5AR2", name: "ICH Q5A(R2) - Viral Safety of Biotech Products", shortName: "ICH Q5A(R2)", category: "ICH", description: "Viral safety evaluation of biotechnology-derived products", fileName: "ICH_Q5A(R2)_Guideline_2023_1101.pdf", ingested: true },
  { id: "ICH-Q5B", name: "ICH Q5B - Biotech Quality: Expression Constructs", shortName: "ICH Q5B", category: "ICH", description: "Analysis of expression construct in cells used for production", fileName: "Q5B Guideline.pdf", ingested: true },
  { id: "ICH-Q5C", name: "ICH Q5C - Stability of Biotech Products", shortName: "ICH Q5C", category: "ICH", description: "Stability testing of biotechnological/biological products", fileName: "Q5C Guideline.pdf", ingested: true },
  { id: "ICH-Q5D", name: "ICH Q5D - Cell Substrates for Biotech Production", shortName: "ICH Q5D", category: "ICH", description: "Derivation and characterisation of cell substrates", fileName: "Q5D Guideline.pdf", ingested: true },
  { id: "ICH-Q5E", name: "ICH Q5E - Comparability of Biotech Products", shortName: "ICH Q5E", category: "ICH", description: "Comparability of biotech products subject to changes", fileName: "Q5E Guideline.pdf", ingested: true },
  // ICH Q6 - Specifications
  { id: "ICH-Q6A", name: "ICH Q6A - Specifications: Chemical Substances", shortName: "ICH Q6A", category: "ICH", description: "Specifications for new drug substances and drug products (chemical)", fileName: "Q6A Guideline.pdf", ingested: true },
  { id: "ICH-Q6B", name: "ICH Q6B - Specifications: Biotech Products", shortName: "ICH Q6B", category: "ICH", description: "Specifications for biotechnological/biological products", fileName: "Q6B Guideline.pdf", ingested: true },
  // ICH Q7-Q14
  { id: "ICH-Q7", name: "ICH Q7 - Good Manufacturing Practice for APIs", shortName: "ICH Q7", category: "ICH", description: "GMP guide for active pharmaceutical ingredient manufacturing", fileName: "Q7 Guideline.pdf", ingested: true },
  { id: "ICH-Q8R2", name: "ICH Q8(R2) - Pharmaceutical Development", shortName: "ICH Q8(R2)", category: "ICH", description: "Quality by Design principles and pharmaceutical development", fileName: "Q8(R2) Guideline.pdf", ingested: true },
  { id: "ICH-Q9R1", name: "ICH Q9(R1) - Quality Risk Management", shortName: "ICH Q9(R1)", category: "ICH", description: "Principles and tools for quality risk management", fileName: "ICH_Q9(R1)_Guideline_Step4_2025_0115_0.pdf", ingested: true },
  { id: "ICH-Q10", name: "ICH Q10 - Pharmaceutical Quality System", shortName: "ICH Q10", category: "ICH", description: "Pharmaceutical quality system across the product lifecycle", fileName: "Q10 Guideline.pdf", ingested: true },
  { id: "ICH-Q11", name: "ICH Q11 - Development and Manufacture of Drug Substances", shortName: "ICH Q11", category: "ICH", description: "Development and manufacture of drug substances", fileName: "Q11 Guideline.pdf", ingested: true },
  { id: "ICH-Q12", name: "ICH Q12 - Lifecycle Management", shortName: "ICH Q12", category: "ICH", description: "Technical and regulatory considerations for lifecycle management", fileName: "Q12_Guideline_Step4_2019_1119.pdf", ingested: true },
  { id: "ICH-Q13", name: "ICH Q13 - Continuous Manufacturing", shortName: "ICH Q13", category: "ICH", description: "Continuous manufacturing of drug substances and drug products", fileName: "ICH_Q13_Step4_Guideline_2022_1116.pdf", ingested: true },
  { id: "ICH-Q14", name: "ICH Q14 - Analytical Procedure Development", shortName: "ICH Q14", category: "ICH", description: "Analytical procedure development principles", fileName: "ICH_Q14_Guideline_2023_1130_ErrorCorrection_2025.pdf", ingested: true },
  // EU GMP
  { id: "EU-GMP-ANNEX1", name: "EU GMP Annex 1 (2022) - Sterile Medicinal Products", shortName: "EU GMP Annex 1", category: "EU_GMP", description: "Manufacture of sterile medicinal products", fileName: "20220825_gmp-an1_en_0.pdf", ingested: true },
  { id: "EU-GMP-ANNEX11", name: "EU GMP Annex 11 - Computerised Systems", shortName: "EU GMP Annex 11", category: "EU_GMP", description: "Requirements for computerised systems in GMP environments", fileName: "annex11_01-2011_en_0.pdf", ingested: true },
  { id: "EU-GMP-ANNEX15", name: "EU GMP Annex 15 - Qualification and Validation", shortName: "EU GMP Annex 15", category: "EU_GMP", description: "Qualification and validation principles", fileName: "2015-10_annex15_0.pdf", ingested: true },
  // FDA
  { id: "FDA-PART11-SCOPE", name: "FDA 21 CFR Part 11 Scope & Application Guidance", shortName: "FDA Part 11 Guidance", category: "FDA", description: "FDA's interpretation guidance on scope and application of Part 11", fileName: "Part-11--Electronic-Records--Electronic-Signatures---Scope-and-Application-(PDF).pdf", ingested: true },
  { id: "FDA-PROCESS-VAL-2011", name: "FDA Process Validation Guidance 2011", shortName: "FDA PV 2011", category: "FDA", description: "General principles and practices for process validation", fileName: "Process-Validation--General-Principles-and-Practices.pdf", ingested: true },
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
