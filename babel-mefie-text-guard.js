module.exports = function mefieTextGuard({ types: t }) {
  return {
    name: 'mefie-text-guard',
    visitor: {
      JSXExpressionContainer(path) {
        const expression = path.node.expression;
        if (!expression || expression.type !== 'LogicalExpression' || expression.operator !== '&&') return;

        const parentElement = path.parentPath?.parentPath;
        const name = parentElement?.isJSXElement()
          ? parentElement.node.openingElement.name.type === 'JSXIdentifier'
            ? parentElement.node.openingElement.name.name
            : 'component'
          : 'unknown';
        const loc = expression.loc?.start;
        const location = loc ? `${loc.line}:${loc.column + 1}` : 'unknown';

        if (process.env.MEFIE_TEXT_GUARD_DEBUG === '1') {
          console.log(`[MEFIE TEXT GUARD] ${name} logical && at ${location} -> ternary`);
        }

        path.node.expression = t.conditionalExpression(expression.left, expression.right, t.nullLiteral());
      },
    },
  };
};
