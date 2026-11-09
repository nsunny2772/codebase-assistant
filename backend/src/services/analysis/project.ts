import path from "node:path";
import ts from "typescript";
import type { SourceFile } from "../../models/index.js";
import { systemStrings } from "../../constants/system.js";
export function projectContext(file: string) {
  if (
    /(?:^|\/)(?:client|frontend|web|components|pages|hooks)(?:\/|$)/i.test(
      file,
    ) ||
    /\.tsx$|\.jsx$/i.test(file)
  )
    return systemStrings.REACT_SOURCE;
  if (
    /(?:^|\/)(?:server|backend|api|routes|controllers|models|middleware)(?:\/|$)/i.test(
      file,
    )
  )
    return systemStrings.BACKEND_SOURCE;
  if (/\.pyi?$/.test(file)) return systemStrings.PYTHON_SOURCE;
  return systemStrings.REPOSITORY_SOURCE;
}

export function moduleResolver(files: SourceFile[]) {
  const paths = new Set(files.map((f) => f.path));

  const configs = files
    .filter((f) => /(?:^|\/)[tj]sconfig(?:\.[\w-]+)?\.json$/.test(f.path))
    .map((file) => {
      const parsed = ts.parseConfigFileTextToJson(file.path, file.text)
        .config as
        | { compilerOptions?: { baseUrl?: unknown; paths?: unknown } }
        | undefined;
      return {
        dir: path.posix.dirname(file.path),
        options: parsed?.compilerOptions,
      };
    })
    .sort((a, b) => b.dir.length - a.dir.length);

  const find = (base: string) => {
    if (base.startsWith("../") || base.startsWith("/")) return undefined;
    const candidates = [
      base,
      ...[
        ".ts",
        ".tsx",
        ".mts",
        ".cts",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        "/index.ts",
        "/index.tsx",
        "/index.js",
        "/index.jsx",
      ].map((ext) => base + ext),
      base.replace(/\.js$/, ".ts"),
      base.replace(/\.jsx$/, ".tsx"),
    ];
    return candidates.find(
      (candidate) => paths.has(candidate) && /\.[cm]?[jt]sx?$/.test(candidate),
    );
  };
  return (file: string, spec: string): string | undefined => {
    if (spec.startsWith("."))
      return find(
        path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)),
      );
    const config = configs.find(
      (c) => c.dir === "." || file.startsWith(c.dir + "/"),
    );
    if (!config) return undefined;
    const baseUrl =
      typeof config.options?.baseUrl === "string"
        ? config.options.baseUrl
        : ".";

    const base = path.posix.normalize(path.posix.join(config.dir, baseUrl));
    if (baseUrl.startsWith("/") || base.startsWith("..")) return undefined;
    const aliases = config.options?.paths;
    if (aliases && typeof aliases === "object" && !Array.isArray(aliases))
      for (const [pattern, targets] of Object.entries(aliases)) {
        if (!Array.isArray(targets) || pattern.split("*").length > 2) continue;
        const [prefix, suffix] = pattern.split("*");
        let middle = "";
        if (suffix === undefined) {
          if (spec !== prefix) continue;
        } else {
          if (!spec.startsWith(prefix!) || !spec.endsWith(suffix)) continue;
          middle = spec.slice(
            prefix!.length,
            suffix ? -suffix.length : undefined,
          );
        }
        for (const target of targets) {
          if (typeof target !== "string" || target.startsWith("/")) continue;
          const found = find(
            path.posix.normalize(
              path.posix.join(base, target.replace("*", middle)),
            ),
          );
          if (found) return found;
        }
      }
    return typeof config.options?.baseUrl === "string"
      ? find(path.posix.normalize(path.posix.join(base, spec)))
      : undefined;
  };
}

