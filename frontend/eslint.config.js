import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

const importGroup = (source) =>
  /\.(?:css|scss|sass)$/.test(source)
    ? 2
    : source.startsWith(".") || source.startsWith("@src/")
      ? 1
      : 0;
const importGroups = {
  meta: { type: "layout", schema: [] },
  create: (context) => ({
    Program: (node) => {
      const imports = node.body.filter(
        (statement) => statement.type === "ImportDeclaration",
      );
      const firstCode = node.body.find(
        (statement) => statement.type !== "ImportDeclaration",
      );
      let previous;
      for (const statement of imports) {
        const group = importGroup(statement.source.value);
        const componentStyle =
          (context.filename ?? "").includes("/shared/components/") &&
          /\.scss$/.test(statement.source.value);
        if (componentStyle && !statement.source.value.endsWith(".module.scss"))
          context.report({
            node: statement,
            message: "Use a component-named .module.scss stylesheet.",
          });
        if (
          statement.source.value.endsWith(".module.scss") &&
          !statement.specifiers.some(
            (specifier) =>
              specifier.type === "ImportDefaultSpecifier" &&
              specifier.local.name === "styles",
          )
        )
          context.report({
            node: statement,
            message: "Import CSS modules as styles.",
          });
        if (firstCode && statement.range[0] > firstCode.range[0]) {
          context.report({
            node: statement,
            message: "Keep all imports before module code.",
          });
        }
        if (previous) {
          const previousGroup = importGroup(previous.source.value);
          if (group < previousGroup)
            context.report({
              node: statement,
              message:
                "Order imports as packages, internal files, then styles.",
            });
          if (
            group !== previousGroup &&
            statement.loc.start.line - previous.loc.end.line < 2
          )
            context.report({
              node: statement,
              message: "Separate import groups with a blank line.",
            });
        }
        previous = statement;
      }
      if (
        previous &&
        firstCode &&
        firstCode.loc.start.line - previous.loc.end.line < 2
      )
        context.report({
          node: firstCode,
          message: "Add a blank line after imports.",
        });
    },
  }),
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { project: { rules: { "import-groups": importGroups } } },
    rules: {
      "project/import-groups": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "FunctionDeclaration", message: "Use an arrow function." },
        { selector: "FunctionExpression", message: "Use an arrow function." },
        {
          selector:
            "JSXAttribute > JSXExpressionContainer > ArrowFunctionExpression",
          message: "Use a named handler instead of an inline JSX function.",
        },
        {
          selector: "JSXAttribute[name.name='className'][value.type='Literal']",
          message:
            "Use a CSS-module class or clsx instead of a literal class name.",
        },
      ],
    },
  },
);
