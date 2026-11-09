import runtime from "@vscode/tree-sitter-wasm";
import type { Node, Tree } from "@vscode/tree-sitter-wasm";
import { createRequire } from "node:module";
import path from "node:path";
import {
  type Analysis,
  type SourceFile,
  type SymbolInfo,
} from "../../models/index.js";
import { AppError } from "../../utils/app-error.js";
import { indexingStrings } from "../../constants/indexing.js";
import { hash } from "../../utils/hash.js";
import { splitSource, boundedContext } from "./chunker.js";
import { countTokens } from "../retrieval/context.js";

const { Parser, Language } = runtime;

const children = (node: Node) =>
  node.namedChildren.filter((child): child is Node => child !== null);
let initialized: Promise<InstanceType<typeof Language>> | undefined;
function language() {
  return (initialized ??= (async () => {
    const dir = path.dirname(
      createRequire(import.meta.url).resolve("@vscode/tree-sitter-wasm"),
    );
    await Parser.init({ locateFile: (name) => path.join(dir, name) });
    return Language.load(path.join(dir, "tree-sitter-python.wasm"));
  })());
}

export async function analyzePython(
  files: SourceFile[],
  snapshotId: string,
  maxChunks = 20000,
): Promise<Analysis> {
  const grammar = await language();

  const parser = new Parser();
  parser.setLanguage(grammar);
  parser.setTimeoutMicros(500000);
  const result: Analysis = {
    symbols: [],
    chunks: [],
    edges: [],
    warnings: [],
    unresolvedCalls: 0,
    files: 0,
  };

  const trees = new Map<string, Tree>(),
    fileSymbols = new Map<string, SymbolInfo>(),
    declarations = new Map<string, SymbolInfo>();

  const key = (file: string, scope: string, name: string) =>
    `${file}:${scope}:${name}`;

  const symbol = (
    file: SourceFile,
    node: Node,
    name: string,
    scope: string,
    kind: string,
  ): SymbolInfo => ({
    id: hash(
      `${snapshotId}:${file.path}:${node.startIndex}:${node.endIndex}:${kind}`,
    ),
    snapshotId,
    path: file.path,
    name,
    scope,
    kind,
    start: node.startIndex,
    end: node.endIndex,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  });

  const addChunks = (
    file: SourceFile,
    info: SymbolInfo,
    node: Node,
    imports: string[],
  ) => {
    const body = node.childForFieldName("body");

    const signature = body
      ? file.text.slice(node.startIndex, body.startIndex).trim()
      : "";

    const context = boundedContext(
      file.path,
      [info.scope, info.name].filter(Boolean).join("."),
      signature,
      imports,
    );

    const text = file.text.slice(info.start, info.end);

    const preferredLines = new Set(
      children(node).map((child) => child.endPosition.row + 1),
    );
    for (const part of splitSource(text, {
      firstLine: info.startLine,
      contextTokens: countTokens(context),
      preferredLines,
      overlap: info.kind !== "file",
    })) {
      const embeddingText = `${context}\n\n${part.text}`,
        contentHash = hash(embeddingText);
      result.chunks.push({
        id: hash(`${snapshotId}:${info.id}:${part.start}:${contentHash}`),
        snapshotId,
        symbolId: info.id,
        path: file.path,
        name: [info.scope, info.name].filter(Boolean).join("."),
        text: part.text,
        embeddingText,
        context,
        contentHash,
        startLine: part.startLine,
        endLine: part.endLine,
      });
      if (result.chunks.length > maxChunks)
        throw new AppError(
          "REPOSITORY_LIMIT",
          indexingStrings.CHUNK_LIMIT,
          413,
        );
    }
  };
  try {
    for (const file of files) {
      if (file.text.includes("\0")) {
        result.warnings.push(`${file.path}: binary content skipped`);
        continue;
      }
      const tree = parser.parse(file.text);
      if (!tree)
        throw new AppError(
          "PARSER_TIMEOUT",
          indexingStrings.PARSER_TIMEOUT,
          413,
        );
      trees.set(file.path, tree);
      result.files++;
      if (tree.rootNode.hasError)
        result.warnings.push(
          `${file.path}: Python syntax errors; analysis may be incomplete`,
        );
      const info = symbol(
        file,
        tree.rootNode,
        path.posix.basename(file.path),
        "",
        "file",
      );
      fileSymbols.set(file.path, info);
      result.symbols.push(info);
      const imports = children(tree.rootNode)
        .filter((n) =>
          ["import_statement", "import_from_statement"].includes(n.type),
        )
        .map((n) => n.text);
      addChunks(file, info, tree.rootNode, imports);
      const visit = (node: Node, scope: string) => {
        let next = scope;
        if (["function_definition", "class_definition"].includes(node.type)) {
          const name = node.childForFieldName("name")?.text ?? "<anonymous>";

          const info = symbol(file, node, name, scope, node.type);
          // Decorators are part of the source chunk and may describe framework routes.
          if (node.parent?.type === "decorated_definition") {
            info.start = node.parent.startIndex;
            info.startLine = node.parent.startPosition.row + 1;
          }
          result.symbols.push(info);
          declarations.set(key(file.path, scope, name), info);
          addChunks(file, info, node, imports);
          next = [scope, name].filter(Boolean).join(".");
        }
        for (const child of children(node)) visit(child, next);
      };
      visit(tree.rootNode, "");
    }
    const resolveModule = (
      file: string,
      module: string,
    ): string | undefined => {
      const dots = module.match(/^\.+/)?.[0].length ?? 0;

      const suffix = module.slice(dots).replaceAll(".", "/");

      const base = dots
        ? path.posix.normalize(
            path.posix.join(
              path.posix.dirname(file),
              ...Array.from({ length: dots - 1 }, () => ".."),
              suffix,
            ),
          )
        : suffix;
      if (base.startsWith("../") || base.startsWith("/")) return undefined;
      const candidates = [
        `${base}.py`,
        `${base}/__init__.py`,
        `${base}.pyi`,
        ...(!dots ? [`src/${base}.py`, `src/${base}/__init__.py`] : []),
      ].filter((p) => fileSymbols.has(p));
      return candidates.length === 1 ? candidates[0] : undefined;
    };
    for (const file of files) {
      const tree = trees.get(file.path),
        fileInfo = fileSymbols.get(file.path);
      if (!tree || !fileInfo) continue;
      const bindings = new Map<string, { file: string; name?: string }>();

      const imports = tree.rootNode
        .descendantsOfType(["import_statement", "import_from_statement"])
        .filter((n): n is Node => Boolean(n));
      for (const node of imports) {
        const module = node.childForFieldName("module_name")?.text;

        const names = children(node).filter(
          (n) => n.id !== node.childForFieldName("module_name")?.id,
        );
        for (const item of names) {
          const name =
            item.type === "aliased_import"
              ? item.childForFieldName("name")?.text
              : item.text;

          const alias =
            item.type === "aliased_import"
              ? item.childForFieldName("alias")?.text
              : name;
          if (!name || !alias || name === "*") continue;
          let target = resolveModule(file.path, module ?? name),
            importedName = module ? name : undefined;
          if (module && !target) {
            target = resolveModule(
              file.path,
              `${module}${module.endsWith(".") ? "" : "."}${name}`,
            );
            importedName = undefined;
          }
          if (target) {
            result.edges.push({
              from: fileInfo.id,
              to: fileSymbols.get(target)!.id,
              kind: "IMPORTS",
              path: file.path,
              line: node.startPosition.row + 1,
            });
            if (
              node.parent?.type === "module" &&
              (module || item.type === "aliased_import" || !name.includes("."))
            )
              bindings.set(alias, { file: target, name: importedName });
          } else if (module?.startsWith("."))
            result.warnings.push(
              `${file.path}: unresolved Python import ${module}`,
            );
        }
      }
      const visit = (
        node: Node,
        current: SymbolInfo,
        shadowed: Set<string>,
      ) => {
        let owner = current,
          hidden = shadowed;
        if (["function_definition", "class_definition"].includes(node.type)) {
          const scope =
            current.kind === "file"
              ? ""
              : [current.scope, current.name].filter(Boolean).join(".");
          owner =
            declarations.get(
              key(file.path, scope, node.childForFieldName("name")?.text ?? ""),
            ) ?? current;
          hidden = new Set(shadowed);
          const params = node.childForFieldName("parameters");
          for (const parameter of params ? children(params) : []) {
            const name =
              parameter.type === "identifier"
                ? parameter.text
                : parameter.childForFieldName("name")?.text;
            if (name) hidden.add(name);
          }
          const assignments =
            node.childForFieldName("body")?.descendantsOfType("assignment") ??
            [];
          for (const assignment of assignments) {
            const left = assignment?.childForFieldName("left");
            if (left?.type === "identifier") hidden.add(left.text);
          }
        }
        if (node.type === "call") {
          const fn = node.childForFieldName("function");
          let target: SymbolInfo | undefined;
          if (fn?.type === "identifier" && !hidden.has(fn.text)) {
            let scope =
              owner.kind === "file"
                ? ""
                : [owner.scope, owner.name].filter(Boolean).join(".");
            while (true) {
              target = declarations.get(key(file.path, scope, fn.text));
              if (target || !scope) break;
              scope = scope.split(".").slice(0, -1).join(".");
            }
            const binding = bindings.get(fn.text);
            if (!target && binding?.name)
              target = declarations.get(key(binding.file, "", binding.name));
          } else if (fn?.type === "attribute") {
            const obj = fn.childForFieldName("object")?.text,
              attr = fn.childForFieldName("attribute")?.text;
            if (obj && attr) {
              if (["self", "cls"].includes(obj) && owner.scope)
                target = declarations.get(key(file.path, owner.scope, attr));
              else if (!hidden.has(obj)) {
                const binding = bindings.get(obj);
                if (binding && !binding.name)
                  target = declarations.get(key(binding.file, "", attr));
              }
            }
          }
          if (target)
            result.edges.push({
              from: owner.id,
              to: target.id,
              kind: "CALLS",
              path: file.path,
              line: node.startPosition.row + 1,
            });
          else result.unresolvedCalls++;
        }
        for (const child of children(node)) visit(child, owner, hidden);
      };
      visit(tree.rootNode, fileInfo, new Set());
    }
    result.warnings = [...new Set(result.warnings)].slice(0, 100);
    return result;
  } finally {
    for (const tree of trees.values()) tree.delete();
    parser.delete();
  }
}
