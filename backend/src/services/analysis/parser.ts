import { moduleResolver, projectContext } from "./project.js";
import ts from "typescript";
import path from "node:path";
import {
  type SourceFile,
  type SymbolInfo,
  type Analysis,
  type Chunk,
} from "../../models/index.js";
import { AppError } from "../../utils/app-error.js";
import { indexingStrings } from "../../constants/indexing.js";
import { hash } from "../../utils/hash.js";
import { countTokens } from "../retrieval/context.js";
import { splitSource, boundedContext } from "./chunker.js";
import { CHUNK_POLICY } from "../../constants/chunking.js";

const codePattern = /\.(?:[cm]?[jt]sx?)$/i;

export function supportedPath(file: string): boolean {
  return (
    (codePattern.test(file) ||
      /\.(?:py|pyi|md)$/i.test(file) ||
      /(?:^|\/)(?:package\.json|[tj]sconfig(?:\.[\w-]+)?\.json|pyproject\.toml|requirements(?:[-\w]*)?\.txt|Pipfile)$/i.test(
        file,
      )) &&
    !/(^|\/)(node_modules|vendor|dist|build|coverage|\.git|\.next|__generated__|\.venv|venv|env|__pycache__|site-packages|\.pytest_cache|\.mypy_cache)(\/|$)/.test(
      file,
    ) &&
    !/(\.min\.[jt]s|\.d\.ts|\.lock)$/.test(file) &&
    !/(^|\/)(\.env[^/]*|[^/]*\.pem|[^/]*\.key)$/.test(file)
  );
}

export function safePath(file: string) {
  return (
    file.length > 0 &&
    file.length <= 1024 &&
    !file.includes("\\") &&
    !file.startsWith("/") &&
    !file.includes("\0") &&
    !file.split("/").some((p) => p === ".." || p === ".")
  );
}

export function analyze(
  files: SourceFile[],
  snapshotId: string,
  maxChunks = 20000,
): Analysis {
  const texts = new Map(
    files
      .filter((f) => codePattern.test(f.path))
      .map((f) => [`/repo/${f.path}`, f.text]),
  );

  const resolveModule = moduleResolver(files);

  const options: ts.CompilerOptions = {
    allowJs: true,
    checkJs: true,
    noLib: true,
    noEmit: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ESNext,
    jsx: ts.JsxEmit.Preserve,
  };

  // Entire compiler filesystem is virtual. Repository config and plugins are never executed.
  const host: ts.CompilerHost = {
    fileExists: (p) => texts.has(p),
    readFile: (p) => texts.get(p),
    getSourceFile: (p, languageVersion) =>
      texts.has(p)
        ? ts.createSourceFile(p, texts.get(p)!, languageVersion, true)
        : undefined,
    resolveModuleNames: (names, containing) =>
      names.map((name) => {
        const target = resolveModule(containing.slice("/repo/".length), name);
        if (!target) return undefined;
        const extension = target.endsWith(".tsx")
          ? ts.Extension.Tsx
          : target.endsWith(".jsx")
            ? ts.Extension.Jsx
            : /\.[mc]?js$/.test(target)
              ? ts.Extension.Js
              : ts.Extension.Ts;
        return { resolvedFileName: `/repo/${target}`, extension };
      }),
    writeFile: () => {},
    getDefaultLibFileName: () => "",
    getCurrentDirectory: () => "/repo",
    getDirectories: () => [],
    directoryExists: (p) =>
      [...texts.keys()].some((k) => k.startsWith(`${p}/`)),
    getCanonicalFileName: (p) => p,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };

  const program = ts.createProgram([...texts.keys()], options, host);

  const checker = program.getTypeChecker();

  const symbols: SymbolInfo[] = [],
    chunks: Chunk[] = [],
    warnings: string[] = [],
    edges: Analysis["edges"] = [];

  const declarations = new Map<ts.Node, SymbolInfo>();

  const fileSymbols = new Map<string, SymbolInfo>();

  function addChunks(
    file: string,
    text: string,
    symbolId: string,
    name: string,
    firstLine = 1,
    context = "",
    preferredLines = new Set<number>(),
    overlap = false,
  ) {
    for (const part of splitSource(text, {
      firstLine,
      contextTokens: countTokens(context),
      preferredLines,
      overlap,
    })) {
      const embeddingText = context ? `${context}\n\n${part.text}` : part.text;
      if (countTokens(embeddingText) > CHUNK_POLICY.max)
        throw new AppError(
          "CHUNK_LIMIT",
          indexingStrings.CHUNK_TOKEN_LIMIT,
          413,
        );
      const contentHash = hash(embeddingText);
      chunks.push({
        id: hash(`${snapshotId}:${symbolId}:${part.start}:${contentHash}`),
        snapshotId,
        symbolId,
        path: file,
        name,
        text: part.text,
        embeddingText,
        context,
        startLine: part.startLine,
        endLine: part.endLine,
        contentHash,
      });
      if (chunks.length > maxChunks)
        throw new AppError(
          "REPOSITORY_LIMIT",
          indexingStrings.CHUNK_LIMIT,
          413,
        );
    }
  }
  for (const file of files) {
    if (
      !safePath(file.path) ||
      !supportedPath(file.path) ||
      /\.pyi?$/i.test(file.path)
    )
      continue;
    if (file.text.includes("\0")) {
      warnings.push(`${file.path}: binary content skipped`);
      continue;
    }
    const sf = program.getSourceFile(`/repo/${file.path}`);

    const imports =
      sf?.statements.filter(ts.isImportDeclaration).map((n) => n.getText(sf)) ??
      [];

    const preferredLines = new Set<number>();
    if (sf) {
      const mark = (node: ts.Node) => {
        if (
          ts.isStatement(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isPropertyDeclaration(node)
        )
          preferredLines.add(
            sf.getLineAndCharacterOfPosition(
              Math.max(node.getStart(sf), node.getEnd() - 1),
            ).line + 1,
          );
        ts.forEachChild(node, mark);
      };
      mark(sf);
    }
    const fileInfo: SymbolInfo = {
      id: hash(`${snapshotId}:${file.path}:file`),
      snapshotId,
      path: file.path,
      name: path.posix.basename(file.path),
      scope: "",
      kind: "file",
      start: 0,
      end: file.text.length,
      startLine: 1,
      endLine: file.text.split("\n").length,
    };
    symbols.push(fileInfo);
    fileSymbols.set(file.path, fileInfo);
    // File chunks retain top-level initialization and imports as well as declarations.
    addChunks(
      file.path,
      file.text,
      fileInfo.id,
      fileInfo.name,
      1,
      boundedContext(
        file.path,
        `file; ${projectContext(file.path)}`,
        "",
        imports,
      ),
      preferredLines,
    );
    if (!sf) continue;
    const diagnostics = program.getSyntacticDiagnostics(sf);
    if (diagnostics.length)
      warnings.push(
        `${file.path}: ${diagnostics.length} syntax diagnostics; analysis may be incomplete`,
      );
    function visit(node: ts.Node, scope: string) {
      const named =
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ((ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
          (ts.isCallExpression(node.parent) ||
            (ts.isBinaryExpression(node.parent) &&
              /^(module\.exports|exports\.)/.test(
                node.parent.left.getText(sf),
              )))) ||
        (ts.isVariableDeclaration(node) &&
          node.initializer &&
          (ts.isArrowFunction(node.initializer) ||
            ts.isFunctionExpression(node.initializer)));
      let nested = scope;
      if (named) {
        const nameNode = (node as ts.NamedDeclaration).name;

        const callbackName = ts.isCallExpression(node.parent)
          ? `callback:${node.parent.expression.getText(sf)}:${node.parent.arguments[0] && ts.isStringLiteral(node.parent.arguments[0]) ? node.parent.arguments[0].text : ""}`
          : "default";

        const name = (nameNode?.getText(sf) ?? callbackName).slice(0, 200);

        const start = node.getStart(sf),
          end = node.getEnd();

        const info: SymbolInfo = {
          id: hash(`${snapshotId}:${file.path}:${start}:${end}`),
          snapshotId,
          path: file.path,
          name,
          scope: scope.slice(0, 1000),
          kind: ts.SyntaxKind[node.kind],
          start,
          end,
          startLine: sf!.getLineAndCharacterOfPosition(start).line + 1,
          endLine: sf!.getLineAndCharacterOfPosition(end).line + 1,
        };
        symbols.push(info);
        declarations.set(node, info);
        nested = (scope ? `${scope}.${name}` : name).slice(0, 1000);
        const functionBody =
          "body" in node &&
          node.body &&
          typeof node.body === "object" &&
          "getStart" in node.body
            ? (node.body as ts.Node)
            : undefined;

        const signature = functionBody
          ? sf!.text.slice(start, functionBody.getStart(sf)).trim()
          : (node.getText(sf).split("\n")[0] ?? "");
        addChunks(
          file.path,
          node.getText(sf),
          info.id,
          nested,
          info.startLine,
          boundedContext(file.path, nested, signature, imports),
          preferredLines,
          true,
        );
      }
      ts.forEachChild(node, (child) => visit(child, nested));
    }
    visit(sf, "");
  }
  let unresolvedCalls = 0;
  for (const sf of program.getSourceFiles()) {
    const file = sf.fileName.slice("/repo/".length),
      fileInfo = fileSymbols.get(file);
    if (!fileInfo) continue;
    function visit(node: ts.Node, current: SymbolInfo) {
      const enclosing = declarations.get(node) ?? current;
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const spec = node.moduleSpecifier.text;

        const targetPath = resolveModule(file, spec),
          target = targetPath ? fileSymbols.get(targetPath) : undefined;
        if (target)
          edges.push({
            from: fileInfo!.id,
            to: target.id,
            kind: "IMPORTS",
            path: file,
            line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
        else if (spec.startsWith(".") || spec.startsWith("@/"))
          warnings.push(`${file}: unresolved import ${spec}`);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]!)
      ) {
        const spec = (node.arguments[0] as ts.StringLiteral).text,
          targetPath = resolveModule(file, spec),
          target = targetPath ? fileSymbols.get(targetPath) : undefined;
        if (target)
          edges.push({
            from: fileInfo!.id,
            to: target.id,
            kind: "IMPORTS",
            path: file,
            line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
      }

      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        let symbol = checker.getSymbolAtLocation(
          ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name
            : node.expression,
        );
        if (symbol && symbol.flags & ts.SymbolFlags.Alias)
          symbol = checker.getAliasedSymbol(symbol);
        const signature = checker.getResolvedSignature(node);

        const target =
          (signature?.declaration && declarations.get(signature.declaration)) ??
          symbol?.declarations?.map((d) => declarations.get(d)).find(Boolean);
        if (target)
          edges.push({
            from: enclosing.id,
            to: target.id,
            kind: "CALLS",
            path: file,
            line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
        else unresolvedCalls++;
      }
      ts.forEachChild(node, (child) => visit(child, enclosing));
    }
    visit(sf, fileInfo);
  }
  return {
    symbols,
    chunks,
    edges,
    warnings: [...new Set(warnings)].slice(0, 100),
    unresolvedCalls,
    files: fileSymbols.size,
  };
}

export async function analyzeRepository(
  files: SourceFile[],
  snapshotId: string,
  maxChunks = 20000,
): Promise<Analysis> {
  const result = analyze(files, snapshotId, maxChunks);

  const pythonFiles = files.filter(
    (file) =>
      /\.pyi?$/i.test(file.path) &&
      safePath(file.path) &&
      supportedPath(file.path),
  );
  if (pythonFiles.length) {
    const { analyzePython } = await import("./python.js");

    const python = await analyzePython(
      pythonFiles,
      snapshotId,
      maxChunks - result.chunks.length,
    );
    result.symbols.push(...python.symbols);
    result.chunks.push(...python.chunks);
    result.edges.push(...python.edges);
    result.warnings.push(...python.warnings);
    result.unresolvedCalls += python.unresolvedCalls;
    result.files += python.files;
  }
  return result;
}
