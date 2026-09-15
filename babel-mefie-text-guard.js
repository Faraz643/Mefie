module.exports = function mefieTextGuard({ types: t }) {
  return {
    name: 'mefie-text-guard',
    visitor: {
      JSXText(path, state) {
        const value = path.node.value.replace(/\s+/g, ' ').trim();
        if (!value) return;

        const parent = path.parentPath?.parentPath;
        const parentName = parent?.isJSXElement()
          ? parent.node.openingElement.name.type === 'JSXIdentifier'
            ? parent.node.openingElement.name.name
            : 'component'
          : 'unknown';

        if (parentName === 'Text') return;

        const loc = path.node.loc?.start;
        const location = loc ? `${loc.line}:${loc.column + 1}` : 'unknown';
        const filename = state?.filename || 'unknown file';
        console.error(`[MEFIE TEXT GUARD] RAW JSX TEXT ${filename}:${location} | parent=${parentName} | value=${JSON.stringify(value)}`);
      },

      JSXExpressionContainer(path, state) {
        const expression = path.node.expression;
        if (!expression) return;

        if (expression.type === 'StringLiteral') {
          const value = expression.value.trim();
          if (!value) return;
          const parent = path.parentPath?.parentPath;
          const parentName = parent?.isJSXElement()
            ? parent.node.openingElement.name.type === 'JSXIdentifier'
              ? parent.node.openingElement.name.name
              : 'component'
            : 'unknown';
          if (parentName !== 'Text') {
            const loc = expression.loc?.start;
            const location = loc ? `${loc.line}:${loc.column + 1}` : 'unknown';
            const filename = state?.filename || 'unknown file';
            console.error(`[MEFIE TEXT GUARD] RAW STRING EXPRESSION ${filename}:${location} | parent=${parentName} | value=${JSON.stringify(value)}`);
          }
          return;
        }

        if (expression.type !== 'LogicalExpression' || expression.operator !== '&&') return;

        const parentElement = path.parentPath?.parentPath;
        const name = parentElement?.isJSXElement()
          ? parentElement.node.openingElement.name.type === 'JSXIdentifier'
            ? parentElement.node.openingElement.name.name
            : 'component'
          : 'unknown';
        const loc = expression.loc?.start;
        const location = loc ? `${loc.line}:${loc.column + 1}` : 'unknown';
        const filename = state?.filename || 'unknown file';

        if (process.env.MEFIE_TEXT_GUARD_DEBUG === '1') {
          console.log(`[MEFIE TEXT GUARD] ${filename}:${location} | ${name} logical && -> ternary`);
        }

        path.node.expression = t.conditionalExpression(expression.left, expression.right, t.nullLiteral());
      },
    },
  };
};
