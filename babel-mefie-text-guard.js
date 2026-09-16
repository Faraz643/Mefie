module.exports = function mefieTextGuard({ types: t }) {
  const isTextElement = (path) => {
    const parent = path.parentPath;
    return (
      parent?.isJSXElement() &&
      parent.node.openingElement.name.type === "JSXIdentifier" &&
      parent.node.openingElement.name.name === "Text"
    );
  };

  const makeTextElement = (value) =>
    t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier("Text"), [], false),
      t.jsxClosingElement(t.jsxIdentifier("Text")),
      [t.jsxText(value)],
      false,
    );

  return {
    name: "mefie-text-guard",
    visitor: {
      JSXText(path, state) {
        const value = path.node.value.replace(/\s+/g, " ").trim();
        if (!value || isTextElement(path)) return;

        const loc = path.node.loc?.start;
        const location = loc ? `${loc.line}:${loc.column + 1}` : "unknown";
        const filename = state?.filename || "unknown file";
        console.warn(
          `[MEFIE TEXT GUARD] Wrapped raw JSX text ${filename}:${location} | value=${JSON.stringify(value)}`,
        );
        path.replaceWith(makeTextElement(value));
      },

      JSXExpressionContainer(path, state) {
        const expression = path.node.expression;
        if (!expression || isTextElement(path)) return;

        if (expression.type === "StringLiteral") {
          const value = expression.value.trim();
          if (!value) return;
          const loc = expression.loc?.start;
          const location = loc ? `${loc.line}:${loc.column + 1}` : "unknown";
          const filename = state?.filename || "unknown file";
          console.warn(
            `[MEFIE TEXT GUARD] Wrapped raw string expression ${filename}:${location} | value=${JSON.stringify(value)}`,
          );
          path.replaceWith(makeTextElement(value));
          return;
        }

        if (
          expression.type !== "LogicalExpression" ||
          expression.operator !== "&&"
        )
          return;

        const loc = expression.loc?.start;
        const location = loc ? `${loc.line}:${loc.column + 1}` : "unknown";
        const filename = state?.filename || "unknown file";
        if (process.env.MEFIE_TEXT_GUARD_DEBUG === "1") {
          console.log(
            `[MEFIE TEXT GUARD] ${filename}:${location} | logical && coerced to boolean`,
          );
        }

        const booleanLeft = t.unaryExpression(
          "!",
          t.unaryExpression("!", expression.left, true),
          true,
        );
        path.node.expression = t.conditionalExpression(
          booleanLeft,
          expression.right,
          t.nullLiteral(),
        );
      },
    },
  };
};
