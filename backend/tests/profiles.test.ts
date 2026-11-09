import { it, expect } from "vitest";
import {
  analyze,
  analyzeRepository,
  supportedPath,
} from "../src/services/analysis/parser.js";
import { moduleResolver } from "../src/services/analysis/project.js";

it("supports project manifests and Python while excluding environment/build artifacts", () => {
  for (const file of [
    "app/main.py",
    "types/api.pyi",
    "client/package.json",
    "client/tsconfig.json",
    "pyproject.toml",
    "requirements-dev.txt",
  ])
    expect(supportedPath(file), file).toBe(true);
  for (const file of [
    ".venv/lib/a.py",
    "venv/main.py",
    "__pycache__/a.py",
    "node_modules/a.js",
    ".env",
    "package-lock.json",
  ])
    expect(supportedPath(file), file).toBe(false);
});
it("resolves client/server path aliases independently without reading configuration from disk", () => {
  const files = [
    {
      path: "client/tsconfig.json",
      text: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
    },
    {
      path: "server/tsconfig.json",
      text: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
    },
    {
      path: "client/src/view.ts",
      text: 'import {label} from "@/label"; export function render(){return label();}',
    },
    {
      path: "client/src/label.ts",
      text: 'export function label(){return "view";}',
    },
    {
      path: "server/src/view.ts",
      text: 'import {label} from "@/label"; export function render(){return label();}',
    },
    {
      path: "server/src/label.ts",
      text: 'export function label(){return "server";}',
    },
  ];

  const analysis = analyze(files, "aliases");

  const calls = analysis.edges.filter((e) => e.kind === "CALLS");
  expect(calls).toHaveLength(2);
  for (const edge of calls) {
    const from = analysis.symbols.find((s) => s.id === edge.from)!,
      to = analysis.symbols.find((s) => s.id === edge.to)!;
    expect(from.path.split("/")[0]).toBe(to.path.split("/")[0]);
  }
  const unsafe = moduleResolver([
    {
      path: "tsconfig.json",
      text: '{"compilerOptions":{"baseUrl":"/tmp","paths":{"@/*":["../*"]}}}',
    },
    { path: "main.ts", text: "" },
  ]);
  expect(unsafe("main.ts", "@/outside")).toBeUndefined();
});
it("extracts Express callback chunks and CommonJS import edges", () => {
  const analysis = analyze(
    [
      {
        path: "server/routes/users.js",
        text: 'const service = require("../services/users"); app.get("/users", (req,res) => { return res.json(service.list()); });',
      },
      {
        path: "server/services/users.js",
        text: "module.exports = function list(){ return []; };",
      },
    ],
    "mern",
  );
  expect(analysis.edges.some((e) => e.kind === "IMPORTS")).toBe(true);
  expect(
    analysis.chunks.some((c) => c.name.includes("callback:app.get:/users")),
  ).toBe(true);
  expect(analysis.chunks.some((c) => c.name.includes("list"))).toBe(true);
});
it("extracts Python decorators, nested scopes and aliased local calls with exact citations", async () => {
  const files = [
    {
      path: "app/service.py",
      text: "def validate(value):\n    return bool(value)\n\nclass User:\n    def validate(self, value):\n        return value is not None\n",
    },
    {
      path: "app/routes.py",
      text: 'from .service import validate as check\n\n@app.get("/users")\nasync def users(value):\n    """List users."""\n    return check(value)\n',
    },
  ];

  const a = await analyzeRepository(files, "python");
  expect(a.files).toBe(2);
  expect(a.symbols.filter((s) => s.name === "validate")).toHaveLength(2);
  const calls = a.edges.filter((e) => e.kind === "CALLS");
  expect(calls).toHaveLength(1);
  expect(a.symbols.find((s) => s.id === calls[0]!.to)?.scope).toBe("");
  const chunk = a.chunks.find((c) => c.name === "users")!;
  expect(chunk.text).toContain('@app.get("/users")');
  expect(chunk.startLine).toBe(3);
  expect(
    files[1]!.text
      .split("\n")
      .slice(chunk.startLine - 1, chunk.endLine)
      .join("\n"),
  ).toBe(chunk.text);
  expect(a.edges.some((e) => e.kind === "IMPORTS")).toBe(true);
});
it("does not invent Python object dispatch or calls through shadowed parameters", async () => {
  const a = await analyzeRepository(
    [
      {
        path: "main.py",
        text: "def helper():\n    return 1\n\ndef run(helper, obj):\n    helper()\n    obj.helper()\n\nclass Service:\n    def read(self):\n        return self.save()\n    def save(self):\n        return True\n",
      },
    ],
    "shadow",
  );

  const calls = a.edges.filter((e) => e.kind === "CALLS");
  expect(calls).toHaveLength(1);
  expect(a.symbols.find((s) => s.id === calls[0]!.to)?.name).toBe("save");
  expect(a.unresolvedCalls).toBeGreaterThanOrEqual(2);
});
it("reports Python syntax errors and handles Unicode without executing imports", async () => {
  const a = await analyzeRepository(
    [
      {
        path: "unicode.py",
        text: '# 🐍 café\ndef greet(name):\n    return "héllo " + name\n',
      },
      { path: "broken.py", text: "def broken(:\n pass" },
    ],
    "unicode",
  );
  expect(a.warnings.some((w) => w.includes("syntax errors"))).toBe(true);
  expect(a.chunks.find((c) => c.name === "greet")?.text).toBe(
    'def greet(name):\n    return "héllo " + name',
  );
  expect(a.chunks.find((c) => c.name === "greet")?.startLine).toBe(2);
});
