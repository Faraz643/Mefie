from pathlib import Path
p = Path('lib/photo-upload-queue.ts')
s = p.read_text(encoding='utf-8')
s = s.replace('  let uploadSourceCleanup = async () => undefined;\n', '  let uploadSourceCleanup: () => Promise<void> = async () => undefined;\n', 1)
p.write_text(s, encoding='utf-8', newline='\n')
