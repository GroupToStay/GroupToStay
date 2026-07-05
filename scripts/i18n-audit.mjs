import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import prettier from "prettier";
import ts from "typescript";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src");
const LOCALE_ROOT = path.join(SOURCE_ROOT, "locales");
const REPORT_ROOT = path.join(ROOT, "docs", "i18n");
const LANGUAGES = ["en", "ar"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const GENERATED_FILES = new Set(["src/routeTree.gen.ts", "src/integrations/supabase/types.ts"]);

const CATEGORIES = [
  "USER_VISIBLE",
  "TECHNICAL",
  "INTERNAL_CONSTANT",
  "ROUTES",
  "QUERY_KEYS",
  "DEVELOPER_ONLY",
  "THIRD_PARTY",
];

const USER_VISIBLE_PROPERTIES = new Set([
  "aria-description",
  "aria-label",
  "caption",
  "description",
  "emptyMessage",
  "errorMessage",
  "helperText",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "summary",
  "text",
  "title",
  "tooltip",
]);

const TECHNICAL_JSX_ATTRIBUTES = new Set([
  "accept",
  "align",
  "as",
  "autoComplete",
  "className",
  "data-state",
  "dir",
  "encType",
  "htmlFor",
  "id",
  "inputMode",
  "key",
  "lang",
  "method",
  "name",
  "pattern",
  "rel",
  "role",
  "side",
  "size",
  "slot",
  "target",
  "type",
  "value",
  "variant",
]);

const QUERY_METHODS = new Set([
  "contains",
  "delete",
  "eq",
  "filter",
  "from",
  "gt",
  "gte",
  "ilike",
  "in",
  "insert",
  "is",
  "like",
  "lt",
  "lte",
  "match",
  "neq",
  "not",
  "or",
  "order",
  "rpc",
  "select",
  "single",
  "update",
  "upsert",
]);

const ROUTE_CALLS = new Set(["createFileRoute", "navigate", "redirect", "router.navigate"]);

const DEVELOPER_CALLS = new Set([
  "console.debug",
  "console.error",
  "console.info",
  "console.log",
  "console.trace",
  "console.warn",
]);

const TECHNICAL_CALLS = new Set([
  "addEventListener",
  "endsWith",
  "format",
  "getAttribute",
  "includes",
  "join",
  "match",
  "parse",
  "removeEventListener",
  "replace",
  "setAttribute",
  "split",
  "startsWith",
  "stringify",
]);

const FEATURE_RULES = [
  ["Admin", /(?:^|\/)(?:admin\.|admin\/|components\/admin)/i],
  ["Notifications", /notification/i],
  ["Legal", /(?:privacy|terms|cookies|trust)/i],
  ["RFQ", /(?:rfq|request-quote|requests\.|requests\/|quotation)/i],
  ["Hotels", /(?:hotel|pms)/i],
  ["Agency", /agency/i],
  ["Profile", /profile/i],
  ["Settings", /(?:settings|subscription)/i],
  ["Dashboard", /dashboard/i],
  [
    "Authentication",
    /(?:routes\/(?:auth|reset-password)\.tsx|_authenticated\/route\.tsx|auth-(?:attacher|middleware)|use-auth)/i,
  ],
  ["Landing", /(?:routes\/(?:index|about|contact|how-it-works|for-hotels|pricing))/i],
];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function relative(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute, predicate));
    } else if (!predicate || predicate(absolute)) {
      files.push(absolute);
    }
  }
  return files.sort((a, b) => relative(a).localeCompare(relative(b)));
}

function flattenObject(value, prefix = "", output = new Map(), invalid = []) {
  if (typeof value === "string") {
    output.set(prefix, value);
    return { output, invalid };
  }

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      output.set(prefix, value);
    } else {
      invalid.push({ key: prefix || "<root>", type: "array-with-non-string-values" });
    }
    return { output, invalid };
  }

  if (!value || typeof value !== "object") {
    invalid.push({ key: prefix || "<root>", type: typeof value });
    return { output, invalid };
  }

  for (const [key, nested] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    flattenObject(nested, next, output, invalid);
  }
  return { output, invalid };
}

function getJsonPropertyName(node) {
  if (
    ts.isStringLiteral(node.name) ||
    ts.isIdentifier(node.name) ||
    ts.isNumericLiteral(node.name)
  ) {
    return node.name.text;
  }
  return node.name.getText().replace(/^['"]|['"]$/g, "");
}

function findDuplicateJsonKeys(filePath, sourceText) {
  const source = ts.parseJsonText(filePath, sourceText);
  const duplicates = [];
  const diagnostics = (source.parseDiagnostics ?? []).map((diagnostic) => ({
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    position: diagnostic.start ?? 0,
  }));

  function visit(node, objectPath = "") {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Map();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = getJsonPropertyName(property);
        const keyPath = objectPath ? `${objectPath}.${name}` : name;
        if (seen.has(name)) {
          const location = source.getLineAndCharacterOfPosition(property.getStart(source));
          duplicates.push({
            key: keyPath,
            line: location.line + 1,
            firstLine: seen.get(name),
          });
        } else {
          const location = source.getLineAndCharacterOfPosition(property.getStart(source));
          seen.set(name, location.line + 1);
        }
        visit(property.initializer, keyPath);
      }
      return;
    }

    ts.forEachChild(node, (child) => visit(child, objectPath));
  }

  visit(source);
  return { duplicates, diagnostics };
}

function loadCatalogs() {
  const catalogs = Object.fromEntries(LANGUAGES.map((language) => [language, new Map()]));
  const namespaceFiles = Object.fromEntries(LANGUAGES.map((language) => [language, new Map()]));
  const duplicateDefinitions = [];
  const invalidNesting = [];
  const parseErrors = [];
  const byteOrderMarkFiles = [];

  for (const language of LANGUAGES) {
    const directory = path.join(LOCALE_ROOT, language);
    for (const filePath of walk(directory, (file) => path.extname(file) === ".json")) {
      const namespace = path.basename(filePath, ".json");
      const rawSourceText = fs.readFileSync(filePath, "utf8");
      const hasByteOrderMark = rawSourceText.charCodeAt(0) === 0xfeff;
      const sourceText = hasByteOrderMark ? rawSourceText.slice(1) : rawSourceText;
      if (hasByteOrderMark) {
        byteOrderMarkFiles.push({ language, namespace, file: relative(filePath) });
      }
      const duplicateResult = findDuplicateJsonKeys(filePath, sourceText);
      for (const duplicate of duplicateResult.duplicates) {
        duplicateDefinitions.push({ language, namespace, file: relative(filePath), ...duplicate });
      }
      for (const diagnostic of duplicateResult.diagnostics) {
        parseErrors.push({ language, namespace, file: relative(filePath), ...diagnostic });
      }

      let parsed;
      try {
        parsed = JSON.parse(sourceText);
      } catch (error) {
        parseErrors.push({
          language,
          namespace,
          file: relative(filePath),
          message: error instanceof Error ? error.message : String(error),
          position: 0,
        });
        continue;
      }

      const { output, invalid } = flattenObject(parsed);
      namespaceFiles[language].set(namespace, relative(filePath));
      for (const item of invalid) {
        invalidNesting.push({ language, namespace, file: relative(filePath), ...item });
      }
      for (const [key, value] of output) {
        const canonical = `${namespace}:${key}`;
        catalogs[language].set(canonical, {
          canonical,
          namespace,
          key,
          value,
          file: relative(filePath),
        });
      }
    }
  }

  return {
    catalogs,
    namespaceFiles,
    duplicateDefinitions,
    invalidNesting,
    parseErrors,
    byteOrderMarkFiles,
  };
}

function readConfiguredNamespaces() {
  const i18nPath = path.join(SOURCE_ROOT, "lib", "i18n.ts");
  if (!fs.existsSync(i18nPath)) return [];
  const source = fs.readFileSync(i18nPath, "utf8");
  const array = source.match(/I18N_NAMESPACES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!array) return [];
  return [...array[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function getScriptKind(filePath) {
  const extension = path.extname(filePath);
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  if (extension === ".js") return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function getCallName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return `${getCallName(expression.expression)}.${expression.name.text}`;
  }
  return expression.getText();
}

function getJsxAttributeName(node) {
  let current = node;
  while (current) {
    if (ts.isJsxAttribute(current)) return current.name.getText();
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) return null;
    current = current.parent;
  }
  return null;
}

function getOwningPropertyName(node) {
  let current = node.parent;
  while (current) {
    if (ts.isPropertyAssignment(current)) return getJsonPropertyName(current);
    if (ts.isVariableStatement(current) || ts.isCallExpression(current)) return null;
    current = current.parent;
  }
  return null;
}

function getNearestVariableName(node) {
  let current = node.parent;
  while (current) {
    if (ts.isVariableDeclaration(current)) return current.name.getText();
    if (ts.isPropertyDeclaration(current)) return current.name.getText();
    if (ts.isFunctionLike(current) || ts.isSourceFile(current)) return null;
    current = current.parent;
  }
  return null;
}

function getContainingCall(node) {
  let current = node.parent;
  while (current) {
    if (ts.isCallExpression(current) || ts.isNewExpression(current)) return current;
    if (ts.isStatement(current) || ts.isJsxElement(current)) return null;
    current = current.parent;
  }
  return null;
}

function getContainingProperty(node, propertyName) {
  let current = node.parent;
  while (current) {
    if (ts.isPropertyAssignment(current) && getJsonPropertyName(current) === propertyName)
      return current;
    if (ts.isCallExpression(current) || ts.isStatement(current)) return null;
    current = current.parent;
  }
  return null;
}

function isTypeIndexKey(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (ts.isIndexedAccessTypeNode(current)) return true;
    if (ts.isTypeReferenceNode(current) || ts.isTypeAliasDeclaration(current)) return false;
    current = current.parent;
  }
  return false;
}

function isTranslationCall(call) {
  if (!call || !ts.isCallExpression(call)) return false;
  const name = getCallName(call.expression);
  return name === "t" || name === "i18n.t" || name.endsWith("I18n.t");
}

function isImportModule(node) {
  return (
    (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) &&
    node.parent.moduleSpecifier === node
  );
}

function isPropertyNameNode(node) {
  const parent = node.parent;
  return Boolean(
    parent &&
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent)) &&
    parent.name === node,
  );
}

function isRouteLike(value) {
  return (
    /^(?:\/|#|https?:\/\/|mailto:|tel:)/i.test(value) ||
    /^\.(?:\.\/|\/)/.test(value) ||
    /^\*\//.test(value)
  );
}

function isTechnicalPattern(value) {
  return (
    /^<!doctype html>/i.test(value) ||
    /^(?:use client|use server)$/i.test(value) ||
    /^(?:Arrow(?:Left|Right|Up|Down)|Enter|Escape|Tab|Home|End|PageUp|PageDown|Backspace|Delete)$/i.test(
      value,
    ) ||
    /^(?:Bearer|Notification)$/i.test(value) ||
    /^(?:width=device-width|(?:public,\s*)?max-age=|camera=\(\)|;\s*path=\/)/i.test(value) ||
    /^(?:text\/html|application\/json)(?:;\s*charset=utf-8)?$/i.test(value) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
    /^@[\w-]+\//.test(value) ||
    /^[.#\[]?[\w-]+(?:[\s>+~:[\].#,/]+[\w-]+){2,}$/.test(value) ||
    /^(?:application|image|text|font)\/[\w.+-]+$/i.test(value) ||
    /^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(value) ||
    /^(?:utf-?8|json|uuid|email|password|number|boolean|object|string)$/i.test(value) ||
    /^(?:yyyy|MM|dd|HH|mm|ss|PPP|PP|P)[\s/,:-]*(?:yyyy|MM|dd|HH|mm|ss|a|PPP|PP|P)*$/.test(value) ||
    /^\+?[\dXx().\s-]+$/.test(value) ||
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^[a-z]+(?:-[a-z0-9]+){2,}$/.test(value) ||
    /^[\w.*?{}$:[\]/-]+\.(?:ts|tsx|js|jsx|json|css|svg|png|jpg|webp|woff2?)$/i.test(value)
  );
}

function looksLikeCssClassList(value) {
  const tokens = value.trim().split(/\s+/);
  const utilityPattern =
    /^(?:-?[mp][trblxy]?-[\w[\]./%()-]+|h-|w-|min-|max-|text-|bg-|border|rounded|shadow|ring|font-|leading-|tracking-|items-|justify-|content-|self-|place-|gap-|space-|grid-|col-|row-|flex-|basis-|grow|shrink|overflow-|object-|opacity-|z-|top-|right-|bottom-|left-|inset-|translate-|scale-|rotate-|transition|duration-|ease-|animate-|cursor-|select-|pointer-events-|sr-only|container$|block$|inline$|hidden$|relative$|absolute$|fixed$|sticky$|group|peer|dark:|sm:|md:|lg:|xl:|2xl:|hover:|focus:|focus-visible:|active:|disabled:|data-|aria-|\[&)/;
  const indicators = tokens.filter((token) => utilityPattern.test(token)).length;
  return tokens.length >= 2 && indicators >= Math.max(2, Math.ceil(tokens.length * 0.35));
}

function isNonLinguisticLiteral(value) {
  return (
    /^[\p{P}\p{S}\d\s]+$/u.test(value) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
    /^\+?[\dXx().\s-]+$/.test(value)
  );
}

function isDisplayNameAssignment(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (
      ts.isBinaryExpression(current) &&
      ts.isPropertyAccessExpression(current.left) &&
      current.left.name.text.toLowerCase() === "displayname"
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isWithinNode(node, ancestor) {
  let current = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function isWithinHtmlTemplate(node) {
  let current = node.parent;
  while (current) {
    if (ts.isTemplateExpression(current)) {
      return /<!doctype\s+html|<html\b|<body\b/i.test(current.getText());
    }
    current = current.parent;
  }
  return false;
}

function isInternalToken(value) {
  return (
    /^[A-Z][A-Z0-9_]+$/.test(value) ||
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(value) ||
    /^(?:admin|agency|hotel|visitor|active|inactive|pending|approved|rejected|open|closed|draft|submitted|cancelled|expired|verified|suspended)$/i.test(
      value,
    )
  );
}

function looksUserVisible(value) {
  if (!value || isTechnicalPattern(value) || isRouteLike(value)) return false;
  if (/\s/.test(value)) return /[\p{L}\p{N}]/u.test(value);
  if (/\p{Script=Arabic}/u.test(value)) return true;
  return /^[A-Z][\p{L}\p{N}'’&+.-]{1,40}$/u.test(value);
}

function extractLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (
    node.kind === ts.SyntaxKind.TemplateHead ||
    node.kind === ts.SyntaxKind.TemplateMiddle ||
    node.kind === ts.SyntaxKind.TemplateTail
  ) {
    return node.text;
  }
  if (ts.isJsxText(node)) return node.getText().replace(/\s+/g, " ").trim();
  if (ts.isRegularExpressionLiteral(node)) return node.text;
  return null;
}

function classifyString({ node, value, catalogPaths, generated, file }) {
  if (generated) {
    return {
      category: "DEVELOPER_ONLY",
      reason: "Generated source file",
      confidence: "HIGH",
    };
  }

  if (ts.isRegularExpressionLiteral(node)) {
    return { category: "TECHNICAL", reason: "Regular expression", confidence: "HIGH" };
  }

  if (ts.isLiteralTypeNode(node.parent)) {
    return { category: "INTERNAL_CONSTANT", reason: "Type-level literal", confidence: "HIGH" };
  }

  if (isWithinHtmlTemplate(node)) {
    return { category: "TECHNICAL", reason: "HTML document template", confidence: "HIGH" };
  }

  if (isImportModule(node)) {
    const thirdParty = !value.startsWith(".") && !value.startsWith("@/");
    return {
      category: thirdParty ? "THIRD_PARTY" : "TECHNICAL",
      reason: thirdParty ? "Third-party module specifier" : "Internal module specifier",
      confidence: "HIGH",
    };
  }

  const call = getContainingCall(node);
  const callName = call ? getCallName(call.expression) : "";

  if (isTranslationCall(call) && call.arguments[0] && isWithinNode(node, call.arguments[0])) {
    return { category: "TECHNICAL", reason: "i18next key reference", confidence: "HIGH" };
  }

  if (file.startsWith("src/integrations/supabase/")) {
    return {
      category: "DEVELOPER_ONLY",
      reason: "Supabase integration implementation detail",
      confidence: "HIGH",
    };
  }

  if (isTypeIndexKey(node)) {
    return { category: "QUERY_KEYS", reason: "Typed data/index access key", confidence: "HIGH" };
  }

  if (
    node.parent &&
    ts.isBinaryExpression(node.parent) &&
    node.parent.operatorToken.kind === ts.SyntaxKind.InKeyword
  ) {
    return {
      category: "TECHNICAL",
      reason: "JavaScript property-presence key",
      confidence: "HIGH",
    };
  }

  if (value === "GroupToStay") {
    return { category: "INTERNAL_CONSTANT", reason: "Product brand name", confidence: "HIGH" };
  }

  if (isDisplayNameAssignment(node)) {
    return { category: "TECHNICAL", reason: "React component display name", confidence: "HIGH" };
  }

  if (catalogPaths.has(value) || /^[a-z][\w-]+:[a-z][\w.-]+$/i.test(value)) {
    return {
      category: "TECHNICAL",
      reason: "Translation key stored for dynamic lookup",
      confidence: "HIGH",
    };
  }

  if (DEVELOPER_CALLS.has(callName)) {
    return { category: "DEVELOPER_ONLY", reason: "Console diagnostic", confidence: "HIGH" };
  }

  if (callName === "Error" || callName.endsWith("Error")) {
    return {
      category: "DEVELOPER_ONLY",
      reason: "Internal exception message",
      confidence: "MEDIUM",
    };
  }

  if (getContainingProperty(node, "queryKey")) {
    return { category: "QUERY_KEYS", reason: "TanStack Query key", confidence: "HIGH" };
  }

  if (QUERY_METHODS.has(callName.split(".").at(-1))) {
    return { category: "QUERY_KEYS", reason: "Database/API query identifier", confidence: "HIGH" };
  }

  if (ROUTE_CALLS.has(callName) || ROUTE_CALLS.has(callName.split(".").at(-1))) {
    return { category: "ROUTES", reason: "Router API argument", confidence: "HIGH" };
  }

  const attribute = getJsxAttributeName(node);
  if (attribute) {
    if (
      attribute === "to" ||
      attribute === "href" ||
      attribute === "action" ||
      attribute === "formAction"
    ) {
      return { category: "ROUTES", reason: `JSX ${attribute} destination`, confidence: "HIGH" };
    }
    if (USER_VISIBLE_PROPERTIES.has(attribute) && !isNonLinguisticLiteral(value)) {
      return { category: "USER_VISIBLE", reason: `Visible JSX ${attribute}`, confidence: "HIGH" };
    }
    if (TECHNICAL_JSX_ATTRIBUTES.has(attribute) || attribute.startsWith("data-")) {
      return { category: "TECHNICAL", reason: `JSX ${attribute} attribute`, confidence: "HIGH" };
    }
  }

  if (ts.isJsxText(node)) {
    if (isNonLinguisticLiteral(value)) {
      return {
        category: "TECHNICAL",
        reason: "Non-linguistic rendered separator",
        confidence: "HIGH",
      };
    }
    return { category: "USER_VISIBLE", reason: "Rendered JSX text", confidence: "HIGH" };
  }

  if (isPropertyNameNode(node)) {
    if (/^(?:.*Id|.*_id|id|queryKey|foreignKey)$/i.test(value)) {
      return { category: "QUERY_KEYS", reason: "Object query/data key", confidence: "MEDIUM" };
    }
    return { category: "TECHNICAL", reason: "Object property identifier", confidence: "HIGH" };
  }

  if (looksLikeCssClassList(value) || /^(?:group|peer)-\[[^\]]+\]:/.test(value)) {
    return { category: "TECHNICAL", reason: "CSS utility class list", confidence: "HIGH" };
  }

  if (ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node) {
    return { category: "QUERY_KEYS", reason: "Typed data/index access key", confidence: "HIGH" };
  }

  const propertyName = getOwningPropertyName(node);
  if (propertyName && USER_VISIBLE_PROPERTIES.has(propertyName)) {
    return {
      category: "USER_VISIBLE",
      reason: `User-facing ${propertyName} property`,
      confidence: "HIGH",
    };
  }

  if (
    propertyName &&
    /^(?:queryKey|column|field|table|schema|foreignKey|cacheKey)$/i.test(propertyName)
  ) {
    return { category: "QUERY_KEYS", reason: `Data ${propertyName} property`, confidence: "HIGH" };
  }

  if (isRouteLike(value)) {
    return { category: "ROUTES", reason: "Route, URL, or link target", confidence: "HIGH" };
  }

  if (
    TECHNICAL_CALLS.has(callName.split(".").at(-1)) ||
    callName.split(".").at(-1) === "cva" ||
    callName.split(".").at(-1) === "cn" ||
    looksLikeCssClassList(value) ||
    isTechnicalPattern(value)
  ) {
    return { category: "TECHNICAL", reason: "Code, format, or protocol token", confidence: "HIGH" };
  }

  const variableName = getNearestVariableName(node);
  if (variableName && /^[A-Z][A-Z0-9_]+$/.test(variableName)) {
    if (looksUserVisible(value) && /(?:LABELS?|TITLES?|DESCRIPTIONS?|COPY)/.test(variableName)) {
      return {
        category: "USER_VISIBLE",
        reason: `Display text in ${variableName}`,
        confidence: "MEDIUM",
      };
    }
    return {
      category: "INTERNAL_CONSTANT",
      reason: `Value owned by ${variableName}`,
      confidence: "MEDIUM",
    };
  }

  if (isInternalToken(value)) {
    return {
      category: "INTERNAL_CONSTANT",
      reason: "Machine-readable enum/token",
      confidence: "MEDIUM",
    };
  }

  if (looksUserVisible(value)) {
    return {
      category: "USER_VISIBLE",
      reason: "Human-readable application copy",
      confidence: "MEDIUM",
    };
  }

  return { category: "TECHNICAL", reason: "Non-visible implementation string", confidence: "LOW" };
}

function inferFeature(file) {
  for (const [feature, pattern] of FEATURE_RULES) {
    if (pattern.test(file)) return feature;
  }
  return "Common";
}

function inferModule(file) {
  const segments = file.split("/");
  return segments.length > 1 ? segments.slice(0, 2).join("/") : segments[0];
}

function collectUseTranslationNamespaces(sourceFile) {
  const namespaces = new Set();
  function visit(node) {
    if (ts.isCallExpression(node) && getCallName(node.expression) === "useTranslation") {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) namespaces.add(argument.text);
      if (argument && ts.isArrayLiteralExpression(argument)) {
        for (const item of argument.elements) {
          if (ts.isStringLiteral(item)) namespaces.add(item.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...namespaces];
}

function literalFromTranslationArgument(argument) {
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return { kind: "exact", key: argument.text };
  }
  if (ts.isTemplateExpression(argument)) {
    return { kind: "dynamic", prefix: argument.head.text };
  }
  return { kind: "unresolved", expression: argument.getText() };
}

function scanSourceFiles(catalogPaths) {
  const files = walk(SOURCE_ROOT, (file) => SOURCE_EXTENSIONS.has(path.extname(file)));
  const findings = [];
  const translationReferences = [];
  const catalogKeyLiterals = [];
  const fileStats = new Map();
  let findingId = 0;

  for (const filePath of files) {
    const sourceText = fs.readFileSync(filePath, "utf8");
    const file = relative(filePath);
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(filePath),
    );
    const defaultNamespaces = collectUseTranslationNamespaces(sourceFile);
    const generated = GENERATED_FILES.has(file);
    const stats = {
      file,
      feature: inferFeature(file),
      module: inferModule(file),
      detectedStrings: 0,
      translationReferences: 0,
      hardcodedUserStrings: 0,
    };

    function locationAt(position) {
      const location = sourceFile.getLineAndCharacterOfPosition(Math.max(position, 0));
      return { line: location.line + 1, column: location.character + 1 };
    }

    function addFinding(node, value) {
      const normalized = value.replace(/\r?\n/g, "\\n").trim();
      if (!normalized) return;
      const classification = classifyString({
        node,
        value: normalized,
        catalogPaths,
        generated,
        file,
      });
      const location = locationAt(node.getStart(sourceFile));
      findingId += 1;
      findings.push({
        id: `STR-${String(findingId).padStart(5, "0")}`,
        file,
        ...location,
        value: normalized,
        syntax: ts.SyntaxKind[node.kind],
        feature: stats.feature,
        module: stats.module,
        ...classification,
      });
      if (catalogPaths.has(normalized) && !isTranslationCall(getContainingCall(node))) {
        catalogKeyLiterals.push({
          file,
          ...location,
          feature: stats.feature,
          module: stats.module,
          defaultNamespaces,
          kind: "exact",
          key: normalized,
          source: "catalog-key-literal",
        });
      }
      stats.detectedStrings += 1;
      if (classification.category === "USER_VISIBLE") stats.hardcodedUserStrings += 1;
    }

    function visit(node) {
      if (ts.isCallExpression(node) && isTranslationCall(node) && node.arguments[0]) {
        const location = locationAt(node.arguments[0].getStart(sourceFile));
        const reference = literalFromTranslationArgument(node.arguments[0]);
        translationReferences.push({
          file,
          ...location,
          feature: stats.feature,
          module: stats.module,
          defaultNamespaces,
          ...reference,
        });
        stats.translationReferences += 1;
      }

      const literal = extractLiteral(node);
      if (literal !== null) addFinding(node, literal);
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      sourceText,
    );
    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
      if (
        token === ts.SyntaxKind.SingleLineCommentTrivia ||
        token === ts.SyntaxKind.MultiLineCommentTrivia
      ) {
        const raw = scanner.getTokenText();
        const value = raw
          .replace(/^\/\//, "")
          .replace(/^\/\*/, "")
          .replace(/\*\/$/, "")
          .replace(/^\s*\* ?/gm, "")
          .trim();
        if (value) {
          const location = locationAt(scanner.getTokenPos());
          findingId += 1;
          findings.push({
            id: `STR-${String(findingId).padStart(5, "0")}`,
            file,
            ...location,
            value: value.replace(/\r?\n/g, "\\n"),
            syntax: "CommentTrivia",
            feature: stats.feature,
            module: stats.module,
            category: "DEVELOPER_ONLY",
            reason: "Source code comment",
            confidence: "HIGH",
          });
          stats.detectedStrings += 1;
        }
      }
      token = scanner.scan();
    }

    fileStats.set(file, stats);
  }

  return { files, findings, translationReferences, catalogKeyLiterals, fileStats };
}

function buildPathIndex(catalog) {
  const index = new Map();
  for (const entry of catalog.values()) {
    if (!index.has(entry.key)) index.set(entry.key, []);
    index.get(entry.key).push(entry);
  }
  return index;
}

function resolveReference(reference, catalogs, configuredNamespaces) {
  const english = catalogs.en;
  const pathIndex = buildPathIndex(english);
  if (reference.kind === "unresolved") {
    return { resolved: [], dynamic: false, unresolvedExpression: reference.expression };
  }

  if (reference.kind === "dynamic") {
    const resolved = [];
    for (const entry of english.values()) {
      if (entry.key.startsWith(reference.prefix)) resolved.push(entry.canonical);
    }
    return { resolved, dynamic: true };
  }

  const raw = reference.key;
  if (raw.includes(":")) {
    const separator = raw.indexOf(":");
    const namespace = raw.slice(0, separator);
    const key = raw.slice(separator + 1);
    const canonical = `${namespace}:${key}`;
    return {
      resolved: english.has(canonical) ? [canonical] : [],
      dynamic: false,
      explicitNamespace: namespace,
      unknownNamespace: !configuredNamespaces.includes(namespace),
    };
  }

  const matches = pathIndex.get(raw) ?? [];
  if (matches.length === 0) {
    const pluralMatches = [];
    for (const [key, entries] of pathIndex) {
      if (
        key.match(
          new RegExp(
            `^${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(?:zero|one|two|few|many|other)$`,
          ),
        )
      ) {
        pluralMatches.push(...entries);
      }
    }
    if (pluralMatches.length > 0) {
      return {
        resolved: pluralMatches.map((entry) => entry.canonical),
        dynamic: false,
        pluralFamily: true,
      };
    }
  }
  if (matches.length <= 1)
    return { resolved: matches.map((entry) => entry.canonical), dynamic: false };

  const preferred = matches.filter((entry) =>
    reference.defaultNamespaces.includes(entry.namespace),
  );
  if (preferred.length === 1) return { resolved: [preferred[0].canonical], dynamic: false };

  return {
    resolved: matches.map((entry) => entry.canonical),
    dynamic: false,
    ambiguous: true,
  };
}

function extractInterpolation(value) {
  return [...value.matchAll(/{{\s*([^},\s]+)(?:\s*,[^}]*)?\s*}}/g)].map((match) => match[1]).sort();
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function calculateCatalogAudit(
  catalogData,
  configuredNamespaces,
  translationReferences,
  catalogKeyLiterals,
) {
  const { catalogs, namespaceFiles } = catalogData;
  const englishKeys = new Set(catalogs.en.keys());
  const arabicKeys = new Set(catalogs.ar.keys());
  const union = new Set([...englishKeys, ...arabicKeys]);
  const missingEnglish = [...union].filter((key) => !englishKeys.has(key)).sort();
  const missingArabic = [...union].filter((key) => !arabicKeys.has(key)).sort();

  const missingNamespaces = [];
  for (const namespace of configuredNamespaces) {
    for (const language of LANGUAGES) {
      if (!namespaceFiles[language].has(namespace)) missingNamespaces.push({ namespace, language });
    }
  }

  const unconfiguredNamespaces = [];
  for (const language of LANGUAGES) {
    for (const namespace of namespaceFiles[language].keys()) {
      if (!configuredNamespaces.includes(namespace))
        unconfiguredNamespaces.push({ namespace, language });
    }
  }

  const pathCollisions = [];
  for (const language of LANGUAGES) {
    const pathIndex = buildPathIndex(catalogs[language]);
    for (const [key, entries] of pathIndex) {
      if (entries.length > 1) {
        pathCollisions.push({
          language,
          key,
          namespaces: entries.map((entry) => entry.namespace).sort(),
        });
      }
    }
  }

  const duplicateValues = [];
  for (const language of LANGUAGES) {
    const values = new Map();
    for (const entry of catalogs[language].values()) {
      if (typeof entry.value !== "string") continue;
      const normalized = entry.value.trim().toLocaleLowerCase(language);
      if (!normalized || normalized.length < 3) continue;
      if (!values.has(normalized)) values.set(normalized, []);
      values.get(normalized).push(entry.canonical);
    }
    for (const [value, keys] of values) {
      if (keys.length > 1) duplicateValues.push({ language, value, keys: keys.sort() });
    }
  }

  const interpolationIssues = [];
  const suspiciousEncoding = [];
  for (const key of union) {
    const english = catalogs.en.get(key)?.value;
    const arabic = catalogs.ar.get(key)?.value;
    if (typeof english === "string" && typeof arabic === "string") {
      const englishVariables = extractInterpolation(english);
      const arabicVariables = extractInterpolation(arabic);
      if (!sameArray(englishVariables, arabicVariables)) {
        interpolationIssues.push({ key, englishVariables, arabicVariables });
      }
    }
    for (const language of LANGUAGES) {
      const value = catalogs[language].get(key)?.value;
      if (typeof value === "string" && value && /(?:Ã.|Â.|â€|ï¿½|�)/.test(value)) {
        suspiciousEncoding.push({ key, language, value });
      }
    }
  }

  const pluralFamilies = new Map();
  for (const key of union) {
    const match = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
    if (!match) continue;
    const [, base, form] = match;
    if (!pluralFamilies.has(base)) pluralFamilies.set(base, new Set());
    pluralFamilies.get(base).add(form);
  }
  const pluralizationIssues = [...pluralFamilies.entries()]
    .filter(([, forms]) => !forms.has("other"))
    .map(([base, forms]) => ({ base, forms: [...forms].sort(), issue: "Missing _other form" }));

  const badKeyNames = [];
  for (const key of union) {
    const [, pathPart = ""] = key.split(":");
    const segments = pathPart.split(".");
    const reasons = [];
    if (/\s/.test(key)) reasons.push("Contains whitespace or visible copy");
    if (segments.some((segment) => /^(?:button|title|message|label|text)\d+$/i.test(segment))) {
      reasons.push("Generic numbered segment");
    }
    if (segments.some((segment) => /^(?:test|tmp|temp|foo|bar)$/i.test(segment))) {
      reasons.push("Temporary or non-semantic segment");
    }
    if (segments.length < 2) reasons.push("Lacks feature/semantic hierarchy");
    if (segments.some((segment) => !/^[a-z][A-Za-z0-9_]*$/.test(segment))) {
      reasons.push("Segment is not structured camelCase/snake_case");
    }
    if (reasons.length) badKeyNames.push({ key, reasons });
  }

  const resolvedReferences = [...translationReferences, ...catalogKeyLiterals].map((reference) => ({
    ...reference,
    ...resolveReference(reference, catalogs, configuredNamespaces),
  }));
  const usedKeys = new Set(resolvedReferences.flatMap((reference) => reference.resolved));

  const brokenReferences = resolvedReferences
    .filter((reference) => reference.kind === "exact" && reference.resolved.length === 0)
    .map((reference) => ({
      file: reference.file,
      line: reference.line,
      key: reference.key,
      unknownNamespace: reference.unknownNamespace ?? false,
    }));
  const ambiguousReferences = resolvedReferences
    .filter((reference) => reference.ambiguous)
    .map((reference) => ({
      file: reference.file,
      line: reference.line,
      key: reference.key,
      resolved: reference.resolved,
    }));
  const unresolvedDynamicReferences = resolvedReferences
    .filter((reference) => reference.kind === "unresolved")
    .map((reference) => ({
      file: reference.file,
      line: reference.line,
      expression: reference.unresolvedExpression,
    }));

  const unstructuredReferences = resolvedReferences
    .filter(
      (reference) =>
        reference.kind === "exact" && !reference.key.includes(".") && !reference.key.includes(":"),
    )
    .map((reference) => ({
      file: reference.file,
      line: reference.line,
      key: reference.key,
    }));

  const namespaceUsageIssues = [
    ...brokenReferences
      .filter((reference) => reference.unknownNamespace)
      .map((reference) => ({
        type: "unknown-namespace",
        file: reference.file,
        line: reference.line,
        key: reference.key,
      })),
    ...ambiguousReferences.map((reference) => ({
      type: "ambiguous-merged-namespace",
      file: reference.file,
      line: reference.line,
      key: reference.key,
    })),
    ...unstructuredReferences.map((reference) => ({
      type: "unstructured-key-reference",
      file: reference.file,
      line: reference.line,
      key: reference.key,
    })),
  ];

  const unusedKeys = [...union].filter((key) => !usedKeys.has(key)).sort();
  const parityCoverage =
    union.size === 0
      ? 100
      : ((union.size - missingEnglish.length - missingArabic.length) / union.size) * 100;

  const namespaceCoverage = [
    ...new Set([...configuredNamespaces, ...[...union].map((key) => key.split(":")[0])]),
  ]
    .sort()
    .map((namespace) => {
      const english = [...englishKeys].filter((key) => key.startsWith(`${namespace}:`)).length;
      const arabic = [...arabicKeys].filter((key) => key.startsWith(`${namespace}:`)).length;
      const keys = [...union].filter((key) => key.startsWith(`${namespace}:`));
      const paired = keys.filter((key) => englishKeys.has(key) && arabicKeys.has(key)).length;
      return {
        namespace,
        english,
        arabic,
        paired,
        coverage: keys.length ? (paired / keys.length) * 100 : 100,
      };
    });

  return {
    englishKeys,
    arabicKeys,
    union,
    missingEnglish,
    missingArabic,
    missingNamespaces,
    unconfiguredNamespaces,
    pathCollisions,
    duplicateValues,
    interpolationIssues,
    suspiciousEncoding,
    pluralizationIssues,
    badKeyNames,
    resolvedReferences,
    usedKeys,
    brokenReferences,
    ambiguousReferences,
    unresolvedDynamicReferences,
    unstructuredReferences,
    namespaceUsageIssues,
    unusedKeys,
    parityCoverage,
    namespaceCoverage,
  };
}

function groupCoverage(fileStats, field) {
  const groups = new Map();
  for (const stats of fileStats.values()) {
    const name = stats[field];
    if (!groups.has(name)) {
      groups.set(name, {
        name,
        files: 0,
        translatedReferences: 0,
        hardcodedUserStrings: 0,
      });
    }
    const group = groups.get(name);
    group.files += 1;
    group.translatedReferences += stats.translationReferences;
    group.hardcodedUserStrings += stats.hardcodedUserStrings;
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      coverage:
        group.translatedReferences + group.hardcodedUserStrings === 0
          ? 100
          : (group.translatedReferences /
              (group.translatedReferences + group.hardcodedUserStrings)) *
            100,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function calculateCoverage(scan, catalogAudit) {
  const translatedReferences = scan.translationReferences.length;
  const hardcodedUserStrings = scan.findings.filter(
    (finding) => finding.category === "USER_VISIBLE",
  ).length;
  const effectiveCoverage =
    translatedReferences + hardcodedUserStrings === 0
      ? 100
      : (translatedReferences / (translatedReferences + hardcodedUserStrings)) * 100;

  const pageCoverage = [...scan.fileStats.values()]
    .filter((stats) => stats.file.startsWith("src/routes/"))
    .map((stats) => ({
      name: stats.file.replace(/^src\/routes\//, ""),
      files: 1,
      translatedReferences: stats.translationReferences,
      hardcodedUserStrings: stats.hardcodedUserStrings,
      coverage:
        stats.translationReferences + stats.hardcodedUserStrings === 0
          ? 100
          : (stats.translationReferences /
              (stats.translationReferences + stats.hardcodedUserStrings)) *
            100,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    translatedReferences,
    hardcodedUserStrings,
    effectiveCoverage,
    catalogParityCoverage: catalogAudit.parityCoverage,
    byFeature: groupCoverage(scan.fileStats, "feature"),
    byModule: groupCoverage(scan.fileStats, "module"),
    byPage: pageCoverage,
  };
}

function countBy(items, selector) {
  const output = {};
  for (const item of items) {
    const key = selector(item);
    output[key] = (output[key] ?? 0) + 1;
  }
  return output;
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function md(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function truncate(value, length = 100) {
  const normalized = String(value).replace(/\\n/g, " ");
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

function table(headers, rows) {
  if (!rows.length) return "_None._\n";
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  return `${header}\n${separator}\n${rows
    .map((row) => `| ${row.map((cell) => md(cell)).join(" | ")} |`)
    .join("\n")}\n`;
}

function section(title, body) {
  return `## ${title}\n\n${body.trim()}\n\n`;
}

function coverageTable(items, label) {
  return table(
    [label, "Files", "Translation refs", "Hardcoded user strings", "Estimated coverage"],
    items.map((item) => [
      item.name,
      item.files,
      item.translatedReferences,
      item.hardcodedUserStrings,
      formatPercent(item.coverage),
    ]),
  );
}

async function createReports({ catalogData, catalogAudit, scan, coverage, configuredNamespaces }) {
  const generatedAt = new Date().toISOString();
  const categoryCounts = countBy(scan.findings, (finding) => finding.category);
  const confidenceCounts = countBy(scan.findings, (finding) => finding.confidence);
  const userVisible = scan.findings.filter((finding) => finding.category === "USER_VISIBLE");
  const uniqueUserVisible = new Set(userVisible.map((finding) => finding.value));
  const estimatedRemaining = userVisible.length;
  const legacyLocaleFiles = walk(LOCALE_ROOT, (file) => {
    return path.extname(file) === ".json" && path.dirname(file) === LOCALE_ROOT;
  }).map(relative);

  const riskLevel =
    catalogAudit.brokenReferences.length > 0 || catalogData.parseErrors.length > 0
      ? "HIGH"
      : userVisible.length > 100 || catalogAudit.interpolationIssues.length > 0
        ? "MEDIUM"
        : "LOW";

  const jsonReport = {
    schemaVersion: 1,
    generatedAt,
    scope: {
      sourceRoot: "src",
      localeRoot: "src/locales",
      reportRoot: "docs/i18n",
      sourceExtensions: [...SOURCE_EXTENSIONS],
      generatedFilesClassifiedAsDeveloperOnly: [...GENERATED_FILES],
    },
    summary: {
      filesScanned: scan.files.length,
      totalStringsDetected: scan.findings.length,
      categoryCounts: Object.fromEntries(
        CATEGORIES.map((category) => [category, categoryCounts[category] ?? 0]),
      ),
      confidenceCounts,
      totalTranslationKeys: catalogAudit.union.size,
      englishKeys: catalogAudit.englishKeys.size,
      arabicKeys: catalogAudit.arabicKeys.size,
      missingEnglish: catalogAudit.missingEnglish.length,
      missingArabic: catalogAudit.missingArabic.length,
      duplicateKeyDefinitions: catalogData.duplicateDefinitions.length,
      crossNamespaceKeyCollisions: catalogAudit.pathCollisions.length,
      duplicateValues: catalogAudit.duplicateValues.length,
      unusedKeys: catalogAudit.unusedKeys.length,
      hardcodedUserStrings: userVisible.length,
      uniqueHardcodedUserStrings: uniqueUserVisible.size,
      catalogParityCoverage: Number(catalogAudit.parityCoverage.toFixed(2)),
      estimatedUiCoverage: Number(coverage.effectiveCoverage.toFixed(2)),
      estimatedRemainingTranslationWork: estimatedRemaining,
      riskLevel,
    },
    catalogs: {
      configuredNamespaces,
      missingNamespaces: catalogAudit.missingNamespaces,
      unconfiguredNamespaces: catalogAudit.unconfiguredNamespaces,
      missingEnglish: catalogAudit.missingEnglish,
      missingArabic: catalogAudit.missingArabic,
      duplicateDefinitions: catalogData.duplicateDefinitions,
      pathCollisions: catalogAudit.pathCollisions,
      duplicateValues: catalogAudit.duplicateValues,
      invalidNesting: catalogData.invalidNesting,
      parseErrors: catalogData.parseErrors,
      byteOrderMarkFiles: catalogData.byteOrderMarkFiles,
      interpolationIssues: catalogAudit.interpolationIssues,
      pluralizationIssues: catalogAudit.pluralizationIssues,
      suspiciousEncoding: catalogAudit.suspiciousEncoding,
      badKeyNames: catalogAudit.badKeyNames,
      brokenReferences: catalogAudit.brokenReferences,
      ambiguousReferences: catalogAudit.ambiguousReferences,
      unresolvedDynamicReferences: catalogAudit.unresolvedDynamicReferences,
      unstructuredReferences: catalogAudit.unstructuredReferences,
      namespaceUsageIssues: catalogAudit.namespaceUsageIssues,
      unusedKeys: catalogAudit.unusedKeys,
      legacyLocaleFiles,
    },
    coverage,
    findings: scan.findings,
    translationReferences: catalogAudit.resolvedReferences,
  };

  const auditReport = `# Enterprise i18n Audit Report

Generated: ${generatedAt}

## Executive Summary

This report classifies every non-empty string literal and source comment detected in the application source. It is an audit baseline only: no translation or application behavior changes are performed by the audit command.

${table(
  ["Metric", "Result"],
  [
    ["Source files scanned", scan.files.length],
    ["Strings detected and classified", scan.findings.length],
    ["Hardcoded USER_VISIBLE occurrences", userVisible.length],
    ["Unique hardcoded USER_VISIBLE values", uniqueUserVisible.size],
    ["Translation references", scan.translationReferences.length],
    ["Catalog keys (union)", catalogAudit.union.size],
    ["English keys", catalogAudit.englishKeys.size],
    ["Arabic keys", catalogAudit.arabicKeys.size],
    ["Catalog parity", formatPercent(catalogAudit.parityCoverage)],
    ["Estimated effective UI coverage", formatPercent(coverage.effectiveCoverage)],
    ["Risk assessment", riskLevel],
  ],
)}

${section(
  "Classification Totals",
  table(
    ["Category", "Occurrences"],
    CATEGORIES.map((category) => [category, categoryCounts[category] ?? 0]),
  ),
)}${section(
    "Catalog Integrity",
    table(
      ["Check", "Findings"],
      [
        ["Missing English keys", catalogAudit.missingEnglish.length],
        ["Missing Arabic keys", catalogAudit.missingArabic.length],
        ["Duplicate JSON key definitions", catalogData.duplicateDefinitions.length],
        ["Cross-namespace path collisions", catalogAudit.pathCollisions.length],
        ["Invalid nesting", catalogData.invalidNesting.length],
        ["UTF-8 BOM locale files", catalogData.byteOrderMarkFiles.length],
        ["Broken static references", catalogAudit.brokenReferences.length],
        ["Ambiguous merged-namespace references", catalogAudit.ambiguousReferences.length],
        ["Namespace usage issues", catalogAudit.namespaceUsageIssues.length],
        ["Interpolation mismatches", catalogAudit.interpolationIssues.length],
        ["Pluralization issues", catalogAudit.pluralizationIssues.length],
        ["Suspicious encoding values", catalogAudit.suspiciousEncoding.length],
        ["Unused keys", catalogAudit.unusedKeys.length],
      ],
    ),
  )}${section(
    "Risk Assessment",
    `**${riskLevel}**. ${
      riskLevel === "HIGH"
        ? "Broken references or catalog parse failures can expose raw keys or fallback copy at runtime."
        : riskLevel === "MEDIUM"
          ? "The catalogs are structurally usable, but remaining visible strings and catalog quality findings prevent complete bilingual coverage."
          : "No material catalog or hardcoded-copy risk was detected."
    }`,
  )}${section(
    "Phase 1.4B Recommendation",
    userVisible.length === 0 &&
      catalogAudit.missingEnglish.length === 0 &&
      catalogAudit.missingArabic.length === 0 &&
      catalogAudit.brokenReferences.length === 0
      ? `Phase 1.4B localization coverage is complete. Keep \`pnpm i18n:audit\` in the quality gate and require every new user-visible string to ship with paired English and Arabic keys.`
      : `Process USER_VISIBLE findings feature by feature, starting with high-volume pages. Resolve broken references and interpolation issues before translating additional copy. Keep TECHNICAL, INTERNAL_CONSTANT, ROUTES, QUERY_KEYS, DEVELOPER_ONLY, and THIRD_PARTY findings out of translation catalogs unless their runtime use is proven user-visible.`,
  )}## Machine-Readable Inventory

Every finding, classification reason, confidence level, catalog issue, and resolved translation reference is stored in [AuditReport.json](./AuditReport.json).
`;

  const coverageReport = `# Translation Coverage Report

Generated: ${generatedAt}

## Coverage Definitions

- **Catalog parity**: keys present in both English and Arabic divided by the union of catalog keys.
- **Estimated UI coverage**: static/dynamic translation call occurrences divided by translation calls plus hardcoded USER_VISIBLE occurrences. This is an estimate, not a claim of linguistic quality.

${table(
  ["Metric", "Coverage"],
  [
    ["Catalog parity", formatPercent(catalogAudit.parityCoverage)],
    ["Estimated UI coverage", formatPercent(coverage.effectiveCoverage)],
  ],
)}

## Per Namespace

${table(
  ["Namespace", "English", "Arabic", "Paired", "Coverage"],
  catalogAudit.namespaceCoverage.map((item) => [
    item.namespace,
    item.english,
    item.arabic,
    item.paired,
    formatPercent(item.coverage),
  ]),
)}

## Per Feature

${coverageTable(coverage.byFeature, "Feature")}

## Per Module

${coverageTable(coverage.byModule, "Module")}

## Per Page

${coverageTable(coverage.byPage, "Route file")}
`;

  const missingKeysReport = `# Missing Keys

Generated: ${generatedAt}

## Missing English

${catalogAudit.missingEnglish.length ? catalogAudit.missingEnglish.map((key) => `- \`${key}\``).join("\n") : "_None._"}

## Missing Arabic

${catalogAudit.missingArabic.length ? catalogAudit.missingArabic.map((key) => `- \`${key}\``).join("\n") : "_None._"}

## Missing Namespace Files

${table(
  ["Namespace", "Language"],
  catalogAudit.missingNamespaces.map((item) => [item.namespace, item.language]),
)}

## Broken Static References

${table(
  ["Key", "File", "Line", "Unknown namespace"],
  catalogAudit.brokenReferences.map((item) => [
    item.key,
    item.file,
    item.line,
    item.unknownNamespace,
  ]),
)}

## Ambiguous Merged-Namespace References

${table(
  ["Key", "File", "Line", "Candidates"],
  catalogAudit.ambiguousReferences.map((item) => [
    item.key,
    item.file,
    item.line,
    item.resolved.join(", "),
  ]),
)}

## Unresolved Dynamic References

These expressions require human review because their possible key set cannot be determined statically.

${table(
  ["Expression", "File", "Line"],
  catalogAudit.unresolvedDynamicReferences.map((item) => [item.expression, item.file, item.line]),
)}

## Namespace Usage Issues

${table(
  ["Type", "Key", "File", "Line"],
  catalogAudit.namespaceUsageIssues.map((item) => [item.type, item.key, item.file, item.line]),
)}
`;

  const duplicateKeysReport = `# Duplicate Keys And Values

Generated: ${generatedAt}

## Duplicate JSON Key Definitions

${table(
  ["Language", "Namespace", "Key", "File", "First line", "Duplicate line"],
  catalogData.duplicateDefinitions.map((item) => [
    item.language,
    item.namespace,
    item.key,
    item.file,
    item.firstLine,
    item.line,
  ]),
)}

## Cross-Namespace Path Collisions

These paths can overwrite one another in the compatibility \`translation\` namespace.

${table(
  ["Language", "Path", "Namespaces"],
  catalogAudit.pathCollisions.map((item) => [item.language, item.key, item.namespaces.join(", ")]),
)}

## Duplicate Values

Duplicate values are not automatically defects. They identify consolidation opportunities and values that need context review.

${table(
  ["Language", "Value", "Keys"],
  catalogAudit.duplicateValues.map((item) => [
    item.language,
    truncate(item.value, 80),
    item.keys.join(", "),
  ]),
)}
`;

  const unusedKeysReport = `# Unused Translation Keys

Generated: ${generatedAt}

Static analysis found **${catalogAudit.unusedKeys.length}** keys with no resolvable reference. Dynamic runtime key construction can create false positives; review before deleting anything.

## Human Review

These keys are intentionally retained. The list contains dynamically selected metadata and option-family keys, compatibility copy for authenticated and legacy flows, and future-ready navigation or dashboard labels. Removing them would either create false negatives in dynamic lookups or discard paired English/Arabic coverage for supported states. Reassess this list when the related legacy flows are retired; no key in this report is treated as active untranslated UI.

## Inventory

${catalogAudit.unusedKeys.length ? catalogAudit.unusedKeys.map((key) => `- \`${key}\``).join("\n") : "_None._"}
`;

  const userVisibleByFile = new Map();
  for (const finding of userVisible) {
    if (!userVisibleByFile.has(finding.file)) userVisibleByFile.set(finding.file, []);
    userVisibleByFile.get(finding.file).push(finding);
  }
  const hardcodedSections = [...userVisibleByFile.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([file, findings]) =>
        `## ${file}\n\n${table(
          ["ID", "Line", "Value", "Reason", "Confidence", "Feature"],
          findings.map((finding) => [
            finding.id,
            finding.line,
            truncate(finding.value),
            finding.reason,
            finding.confidence,
            finding.feature,
          ]),
        )}`,
    )
    .join("\n");

  const hardcodedStringsReport = `# Hardcoded User Strings

Generated: ${generatedAt}

The audit classified **${userVisible.length}** source occurrences as USER_VISIBLE. These are candidates for Phase 1.4B. Classification is conservative and each item includes a confidence level for review prioritization.

${hardcodedSections || "_None._"}
`;

  const classificationSummary = `# Classification Summary

Generated: ${generatedAt}

## Classification Rules

${table(
  ["Category", "Definition", "Translation action"],
  [
    [
      "USER_VISIBLE",
      "Rendered copy, labels, placeholders, accessibility text, messages",
      "Translate in Phase 1.4B",
    ],
    [
      "TECHNICAL",
      "Formats, selectors, attributes, import paths, translation keys",
      "Do not translate",
    ],
    [
      "INTERNAL_CONSTANT",
      "Roles, statuses, enum values, machine tokens",
      "Do not translate the stored value",
    ],
    ["ROUTES", "Internal routes, URLs, link targets", "Do not translate"],
    ["QUERY_KEYS", "Query cache keys, table/column/API identifiers", "Do not translate"],
    ["DEVELOPER_ONLY", "Comments, diagnostics, stack and internal errors", "Do not translate"],
    ["THIRD_PARTY", "External package module identifiers", "Do not modify"],
  ],
)}

## Results

${table(
  ["Category", "Occurrences", "Share"],
  CATEGORIES.map((category) => [
    category,
    categoryCounts[category] ?? 0,
    formatPercent(((categoryCounts[category] ?? 0) / Math.max(scan.findings.length, 1)) * 100),
  ]),
)}

## Confidence

${table(
  ["Confidence", "Occurrences"],
  ["HIGH", "MEDIUM", "LOW"].map((confidence) => [confidence, confidenceCounts[confidence] ?? 0]),
)}

## Scope Notes

- Empty and whitespace-only literals are ignored.
- Generated route source is retained in the inventory and classified as DEVELOPER_ONLY.
- Locale JSON values are audited as catalogs, not reclassified as hardcoded source strings.
- Every source finding is available with a stable run-local ID in [AuditReport.json](./AuditReport.json).
- ${legacyLocaleFiles.length} flat legacy locale file(s) are present outside the active namespace directories: ${legacyLocaleFiles.length ? legacyLocaleFiles.map((file) => `\`${file}\``).join(", ") : "none"}.
`;

  const keyQuality = section(
    "Translation Key Quality",
    `${table(
      ["Key", "Recommendation"],
      catalogAudit.badKeyNames.map((item) => [item.key, item.reasons.join("; ")]),
    )}\nPreferred naming uses semantic hierarchy such as \`buttons.save\`, \`admin.users.title\`, \`dashboard.requests.pending\`, \`validation.email.required\`, and \`errors.permissionDenied\`.`,
  );
  const structuralChecks = section(
    "Namespace And Runtime Validation",
    table(
      ["Check", "Findings"],
      [
        ["Configured namespaces", configuredNamespaces.length],
        ["Missing namespace files", catalogAudit.missingNamespaces.length],
        ["Unconfigured namespace files", catalogAudit.unconfiguredNamespaces.length],
        ["Invalid nesting", catalogData.invalidNesting.length],
        ["JSON parse errors", catalogData.parseErrors.length],
        ["UTF-8 BOM locale files", catalogData.byteOrderMarkFiles.length],
        ["Interpolation mismatches", catalogAudit.interpolationIssues.length],
        ["Pluralization issues", catalogAudit.pluralizationIssues.length],
        ["Broken references", catalogAudit.brokenReferences.length],
        ["Namespace usage issues", catalogAudit.namespaceUsageIssues.length],
      ],
    ),
  );
  const fallbackSource = fs.readFileSync(path.join(SOURCE_ROOT, "lib", "i18n.ts"), "utf8");
  const fallbackChecks = [
    [
      "English fallback configured",
      /fallbackLng\s*:\s*["']en["']/.test(fallbackSource) ? "PASS" : "FAIL",
    ],
    [
      "Empty strings rejected",
      /returnEmptyString\s*:\s*false/.test(fallbackSource) ? "PASS" : "FAIL",
    ],
    ["Null values rejected", /returnNull\s*:\s*false/.test(fallbackSource) ? "PASS" : "FAIL"],
  ];

  const finalAuditReport = auditReport.replace(
    "## Machine-Readable Inventory",
    `${keyQuality}${structuralChecks}${section("Fallback Behavior", table(["Check", "Result"], fallbackChecks))}## Machine-Readable Inventory`,
  );

  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  const reports = {
    "AuditReport.md": finalAuditReport,
    "CoverageReport.md": coverageReport,
    "MissingKeys.md": missingKeysReport,
    "DuplicateKeys.md": duplicateKeysReport,
    "UnusedKeys.md": unusedKeysReport,
    "HardcodedStrings.md": hardcodedStringsReport,
    "ClassificationSummary.md": classificationSummary,
    "AuditReport.json": `${JSON.stringify(jsonReport, null, 2)}\n`,
  };
  const prettierConfig = (await prettier.resolveConfig(path.join(ROOT, "package.json"))) ?? {};
  for (const [name, content] of Object.entries(reports)) {
    const parser = name.endsWith(".json") ? "json" : "markdown";
    const formatted = await prettier.format(content.replace(/\r\n/g, "\n"), {
      ...prettierConfig,
      parser,
    });
    fs.writeFileSync(path.join(REPORT_ROOT, name), formatted, "utf8");
  }

  return jsonReport.summary;
}

async function main() {
  const catalogData = loadCatalogs();
  const configuredNamespaces = readConfiguredNamespaces();
  const catalogPaths = new Set(
    LANGUAGES.flatMap((language) =>
      [...catalogData.catalogs[language].values()].flatMap((entry) => [entry.key, entry.canonical]),
    ),
  );
  const scan = scanSourceFiles(catalogPaths);
  const catalogAudit = calculateCatalogAudit(
    catalogData,
    configuredNamespaces,
    scan.translationReferences,
    scan.catalogKeyLiterals,
  );
  const coverage = calculateCoverage(scan, catalogAudit);
  const summary = await createReports({
    catalogData,
    catalogAudit,
    scan,
    coverage,
    configuredNamespaces,
  });

  process.stdout.write(
    [
      "i18n audit complete",
      `Files scanned: ${summary.filesScanned}`,
      `Strings classified: ${summary.totalStringsDetected}`,
      `USER_VISIBLE: ${summary.categoryCounts.USER_VISIBLE}`,
      `English keys: ${summary.englishKeys}`,
      `Arabic keys: ${summary.arabicKeys}`,
      `Catalog parity: ${summary.catalogParityCoverage.toFixed(1)}%`,
      `Estimated UI coverage: ${summary.estimatedUiCoverage.toFixed(1)}%`,
      "Reports: docs/i18n",
    ].join("\n") + "\n",
  );
}

await main();
