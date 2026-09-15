import React from 'react';

// React Native reports this warning from the renderer, which can hide the
// component that actually passed the bad child. In development, inspect
// createElement calls so the offending file/line is printed in Metro logs.
if (__DEV__) {
  const react = React as any;
  const originalCreateElement = react.createElement;

  if (!react.__mefieTextDebugInstalled) {
    react.__mefieTextDebugInstalled = true;

    react.createElement = function mefieCreateElement(type: any, props: any, ...children: any[]) {
      const badChild = children.find(
        child => typeof child === 'string' || typeof child === 'number'
      );

      if (badChild !== undefined && type !== 'Text') {
        const source = props?.__source;
        const typeName =
          typeof type === 'string'
            ? type
            : type?.displayName || type?.name || 'Anonymous';
        const location = source
          ? `${source.fileName}:${source.lineNumber}:${source.columnNumber ?? 0}`
          : 'source location unavailable';

        console.error(
          `[MEFIE TEXT DEBUG] Possible raw text outside <Text>.\n` +
          `  Component: ${typeName}\n` +
          `  Child: ${JSON.stringify(badChild)}\n` +
          `  Source: ${location}`
        );
      }

      return originalCreateElement.call(this, type, props, ...children);
    };
  }
}

export {};
