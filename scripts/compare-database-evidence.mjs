import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const databaseDocs = resolve(repositoryRoot, "docs/database");

function readJson(name) {
  return JSON.parse(readFileSync(resolve(databaseDocs, name), "utf8"));
}

function stableKey(value, fields) {
  return JSON.stringify(fields.map((field) => value[field] ?? null));
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function writeJson(name, value) {
  writeFileSync(resolve(databaseDocs, name), `${JSON.stringify(value, null, 2)}\n`);
}

function walkSql(root) {
  const paths = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...walkSql(path));
    else if (entry.isFile() && entry.name.endsWith(".sql")) paths.push(path);
  }
  return paths;
}

const migrationRoots = [
  resolve(repositoryRoot, "supabase/migrations"),
  resolve(repositoryRoot, "supabase/migration-archive"),
];
const migrationSql = migrationRoots.flatMap(walkSql).map((path) => ({
  path: relative(repositoryRoot, path).replaceAll("\\", "/"),
  content: readFileSync(path, "utf8"),
}));

function policySources(policy) {
  return migrationSql
    .filter(({ content }) => content.includes(policy))
    .map(({ path }) => path)
    .sort();
}

function policyDecision(key, candidate, production) {
  const candidateOnly = candidate && !production;
  const nonCanonicalRfqAdmin =
    candidateOnly &&
    candidate.schema === "public" &&
    candidate.table === "rfqs" &&
    ["Admin updates all RFQs", "Admin deletes all RFQs"].includes(candidate.policy);

  if (nonCanonicalRfqAdmin) {
    return {
      securityEffect:
        "Candidate grants authenticated administrators an RFQ UPDATE/DELETE path absent from current Production.",
      canonicalDecisionRecommendation:
        "Classify as non-canonical repository drift and remove from the executable candidate outcome with a future guarded additive reconciliation migration.",
      confidence: "high",
    };
  }

  return {
    securityEffect: "Authorization behavior differs and requires owner review.",
    canonicalDecisionRecommendation: "Do not alter either side until the difference is approved.",
    confidence: "medium",
  };
}

function comparePolicies(candidateExport, productionExport) {
  const fields = ["schema", "table", "policy"];
  const candidate = new Map(
    candidateExport.policies.map((policy) => [stableKey(policy, fields), policy]),
  );
  const production = new Map(
    productionExport.policies.map((policy) => [stableKey(policy, fields), policy]),
  );
  const keys = [...new Set([...candidate.keys(), ...production.keys()])].sort();
  const onlyCandidate = [];
  const onlyProduction = [];
  const changed = [];

  for (const key of keys) {
    const candidatePolicy = candidate.get(key) ?? null;
    const productionPolicy = production.get(key) ?? null;
    if (!productionPolicy) {
      onlyCandidate.push({
        schema: candidatePolicy.schema,
        table: candidatePolicy.table,
        policy: candidatePolicy.policy,
        candidateDefinition: candidatePolicy,
        productionDefinition: null,
        sourceMigrations: policySources(candidatePolicy.policy),
        ...policyDecision(key, candidatePolicy, productionPolicy),
      });
    } else if (!candidatePolicy) {
      onlyProduction.push({
        schema: productionPolicy.schema,
        table: productionPolicy.table,
        policy: productionPolicy.policy,
        candidateDefinition: null,
        productionDefinition: productionPolicy,
        sourceMigrations: policySources(productionPolicy.policy),
        ...policyDecision(key, candidatePolicy, productionPolicy),
      });
    } else if (JSON.stringify(candidatePolicy) !== JSON.stringify(productionPolicy)) {
      const differingFields = Object.keys(candidatePolicy).filter(
        (field) =>
          JSON.stringify(candidatePolicy[field]) !== JSON.stringify(productionPolicy[field]),
      );
      changed.push({
        schema: candidatePolicy.schema,
        table: candidatePolicy.table,
        policy: candidatePolicy.policy,
        differingFields,
        candidateDefinition: candidatePolicy,
        productionDefinition: productionPolicy,
        sourceMigrations: policySources(candidatePolicy.policy),
        ...policyDecision(key, candidatePolicy, productionPolicy),
      });
    }
  }

  return {
    schemaVersion: 1,
    candidatePolicySha256: sha256(candidateExport.policies),
    productionPolicySha256: sha256(productionExport.policies),
    candidateCount: candidateExport.policyCount,
    productionCount: productionExport.policyCount,
    summary: {
      onlyCandidate: onlyCandidate.length,
      onlyProduction: onlyProduction.length,
      semanticDifferences: changed.length,
    },
    onlyCandidate,
    onlyProduction,
    semanticDifferences: changed,
  };
}

const grantCategories = [
  {
    name: "table",
    property: "tableGrants",
    semanticFields: ["schema", "object", "grantee", "privilege", "grantable"],
  },
  {
    name: "column",
    property: "columnGrants",
    semanticFields: ["schema", "object", "column_name", "grantee", "privilege", "grantable"],
  },
  {
    name: "routine",
    property: "routineGrants",
    semanticFields: [
      "schema",
      "routine",
      "identity_arguments",
      "grantee",
      "privilege",
      "grantable",
    ],
  },
  {
    name: "sequence",
    property: "sequenceGrants",
    semanticFields: ["schema", "sequence", "grantee", "privilege", "grantable"],
  },
];

const hostedDefaultTableGrantAllowlist = {
  anon: new Set([
    "agencies_public",
    "agency_verification_events",
    "amenities",
    "bookings",
    "chat_messages",
    "cities",
    "conversation_participants",
    "conversations",
    "countries",
    "hotel_amenities",
    "hotel_rooms",
    "hotel_types",
    "hotels",
    "hotels_public",
    "meal_plans",
    "messages",
    "notifications",
    "organizer_types",
    "platform_settings",
    "profiles",
    "quotes",
    "rfq_invitations",
    "rfqs",
    "room_types",
    "subscription_interest",
    "user_roles",
  ]),
  authenticated: new Set([
    "agencies_public",
    "agency_verification_events",
    "amenities",
    "bookings",
    "cities",
    "countries",
    "hotel_types",
    "hotels_public",
    "meal_plans",
    "notifications",
    "organizer_types",
    "platform_settings",
    "profiles",
    "room_types",
    "subscription_interest",
    "user_roles",
  ]),
};

function grantClassification(grant, category, direction) {
  if (grant.schema === "storage") {
    return {
      classification: "expected_local_stack_difference",
      reason:
        "The storage schema is Supabase-managed; this object/ACL is not owned by application migrations.",
    };
  }

  if (grant.grantee === "service_role") {
    return {
      classification: "supabase_managed_environment_difference",
      reason:
        "service_role default privileges differ between hosted Supabase and the isolated local stack.",
    };
  }

  if (
    category === "routine" &&
    grant.grantee === "authenticated" &&
    grant.routine === "prevent_non_admin_account_status_change" &&
    direction === "production_only"
  ) {
    return {
      classification: "canonical_production_acl_reconstruction_gap",
      reason:
        "The owner deferred revocation, so current Production authenticated EXECUTE remains canonical and is missing from the candidate.",
    };
  }

  if (
    direction === "production_only" &&
    ["table", "column"].includes(category) &&
    grant.schema === "public" &&
    hostedDefaultTableGrantAllowlist[grant.grantee]?.has(grant.object)
  ) {
    return {
      classification: "supabase_hosted_default_acl_difference",
      reason:
        "The exact Production-only privilege is pinned by the evidence SHA and its role/relation pair is approved as a hosted default-ACL difference.",
    };
  }

  if (["anon", "authenticated"].includes(grant.grantee)) {
    return {
      classification: "semantic_application_acl_drift",
      reason:
        "The effective privilege for an application-facing API role differs; hosted default ACL provenance does not make the access difference semantically inert.",
    };
  }

  return {
    classification: "unexplained_blocker",
    reason: "The effective privilege difference does not fit an approved managed-role category.",
  };
}

function compareGrantCategory(category, candidateRows, productionRows) {
  const candidate = new Map(
    candidateRows.map((grant) => [stableKey(grant, category.semanticFields), grant]),
  );
  const production = new Map(
    productionRows.map((grant) => [stableKey(grant, category.semanticFields), grant]),
  );
  const onlyCandidate = [...candidate.entries()]
    .filter(([key]) => !production.has(key))
    .map(([, grant]) => ({
      ...grant,
      ...grantClassification(grant, category.name, "candidate_only"),
    }));
  const onlyProduction = [...production.entries()]
    .filter(([key]) => !candidate.has(key))
    .map(([, grant]) => ({
      ...grant,
      ...grantClassification(grant, category.name, "production_only"),
    }));

  const sharedKeys = [...candidate.keys()].filter((key) => production.has(key));
  const grantorDifferences = sharedKeys
    .map((key) => ({ candidate: candidate.get(key), production: production.get(key) }))
    .filter(
      ({ candidate: candidateGrant, production: productionGrant }) =>
        candidateGrant.grantor !== productionGrant.grantor,
    )
    .map(({ candidate: candidateGrant, production: productionGrant }) => ({
      semanticGrant: Object.fromEntries(
        category.semanticFields.map((field) => [field, candidateGrant[field]]),
      ),
      candidateGrantor: candidateGrant.grantor,
      productionGrantor: productionGrant.grantor,
      classification: "supabase_managed_grantor_provenance_difference",
      reason: "Grantor ownership differs without changing the effective grantee privilege.",
    }));

  const classificationCounts = {};
  for (const difference of [...onlyCandidate, ...onlyProduction, ...grantorDifferences]) {
    classificationCounts[difference.classification] =
      (classificationCounts[difference.classification] ?? 0) + 1;
  }

  return {
    candidateCount: candidateRows.length,
    productionCount: productionRows.length,
    effectiveOnlyCandidate: onlyCandidate.length,
    effectiveOnlyProduction: onlyProduction.length,
    grantorOnlyDifferences: grantorDifferences.length,
    classificationCounts,
    onlyCandidate,
    onlyProduction,
    grantorDifferences,
  };
}

function compareGrants(candidateExport, productionExport) {
  const categories = {};
  for (const category of grantCategories) {
    categories[category.name] = compareGrantCategory(
      category,
      candidateExport[category.property],
      productionExport[category.property],
    );
  }

  const tableDifferenceKey = (grant) =>
    stableKey(grant, ["schema", "object", "grantee", "privilege", "grantable"]);
  const candidateTableDifferences = new Map(
    categories.table.onlyCandidate.map((grant) => [tableDifferenceKey(grant), grant]),
  );
  const productionTableDifferences = new Map(
    categories.table.onlyProduction.map((grant) => [tableDifferenceKey(grant), grant]),
  );
  for (const [rows, parentRows] of [
    [categories.column.onlyCandidate, candidateTableDifferences],
    [categories.column.onlyProduction, productionTableDifferences],
  ]) {
    for (const row of rows) {
      const parent = parentRows.get(tableDifferenceKey(row));
      if (!parent) continue;
      row.classification = "derived_from_table_acl_difference";
      row.reason =
        "information_schema.column_privileges expands the corresponding table grant; this is not an independent column ACL change.";
      row.parentTableClassification = parent.classification;
    }
  }
  categories.column.classificationCounts = {};
  for (const difference of [
    ...categories.column.onlyCandidate,
    ...categories.column.onlyProduction,
    ...categories.column.grantorDifferences,
  ]) {
    categories.column.classificationCounts[difference.classification] =
      (categories.column.classificationCounts[difference.classification] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    candidateGrantSha256: sha256(
      grantCategories.flatMap(({ property }) => candidateExport[property]),
    ),
    productionGrantSha256: sha256(
      grantCategories.flatMap(({ property }) => productionExport[property]),
    ),
    candidateCounts: candidateExport.counts,
    productionCounts: productionExport.counts,
    candidateRoleClassifications: candidateExport.roleClassifications,
    productionRoleClassifications: productionExport.roleClassifications,
    categories,
  };
}

function compareFunctionAcl(candidateExport, productionExport) {
  const candidate = candidateExport.functions[0] ?? null;
  const production = productionExport.functions[0] ?? null;
  const grantFields = ["grantee", "privilege", "grantable"];
  const candidateGrants = new Map(
    (candidate?.execute_grants ?? []).map((grant) => [stableKey(grant, grantFields), grant]),
  );
  const productionGrants = new Map(
    (production?.execute_grants ?? []).map((grant) => [stableKey(grant, grantFields), grant]),
  );
  return {
    schemaVersion: 1,
    candidateFunctionAclSha256: sha256(candidateExport.functions),
    productionFunctionAclSha256: sha256(productionExport.functions),
    candidate,
    production,
    definitionMatch:
      candidate?.owner === production?.owner &&
      candidate?.security_definer === production?.security_definer &&
      candidate?.search_path === production?.search_path &&
      candidate?.identity_arguments === production?.identity_arguments,
    executeOnlyCandidate: [...candidateGrants.entries()]
      .filter(([key]) => !productionGrants.has(key))
      .map(([, grant]) => grant),
    executeOnlyProduction: [...productionGrants.entries()]
      .filter(([key]) => !candidateGrants.has(key))
      .map(([, grant]) => ({
        ...grant,
        ...grantClassification(
          { ...grant, schema: "public", routine: "prevent_non_admin_account_status_change" },
          "routine",
          "production_only",
        ),
      })),
  };
}

const candidatePolicies = readJson("candidate-policies-current.json");
const productionPolicies = readJson("production-policies-current.json");
const candidateGrants = readJson("candidate-grants-current.json");
const productionGrants = readJson("production-grants-current.json");
const candidateFunctionAcl = readJson("candidate-function-acl-current.json");
const productionFunctionAcl = readJson("production-function-acl-current.json");

const policyDiff = comparePolicies(candidatePolicies, productionPolicies);
const grantDiff = compareGrants(candidateGrants, productionGrants);
const functionAclDiff = compareFunctionAcl(candidateFunctionAcl, productionFunctionAcl);

writeJson("policy-diff-current.json", policyDiff);
writeJson("grant-diff-current.json", grantDiff);
writeJson("function-acl-diff-current.json", functionAclDiff);

process.stdout.write(
  `${JSON.stringify(
    {
      policySummary: policyDiff.summary,
      grantSummary: Object.fromEntries(
        Object.entries(grantDiff.categories).map(([name, category]) => [
          name,
          {
            candidate: category.candidateCount,
            production: category.productionCount,
            effectiveOnlyCandidate: category.effectiveOnlyCandidate,
            effectiveOnlyProduction: category.effectiveOnlyProduction,
            grantorOnlyDifferences: category.grantorOnlyDifferences,
            classificationCounts: category.classificationCounts,
          },
        ]),
      ),
      functionAcl: {
        definitionMatch: functionAclDiff.definitionMatch,
        executeOnlyCandidate: functionAclDiff.executeOnlyCandidate,
        executeOnlyProduction: functionAclDiff.executeOnlyProduction,
      },
    },
    null,
    2,
  )}\n`,
);
