from pathlib import Path
p = Path('app/(tabs)/index.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace('  }, [ownedEvents]);\n', '  }, [events, sessionId]);\n', 1)
p.write_text(s, encoding='utf-8', newline='\n')
