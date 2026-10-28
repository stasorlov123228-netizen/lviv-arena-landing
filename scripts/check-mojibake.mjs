import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ignoredDirs = new Set(['node_modules', 'dist', '.next', '.git', 'coverage', 'build'])
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.scss', '.sql', '.yml', '.yaml', '.toml', '.xml', '.txt', '.sh', '.ps1'])
const patterns = [
  ['replacement character', /\uFFFD/u],
  ['UTF-8 punctuation decoded as Windows-1251', /вЂ./u],
  ['damaged symbol or arrow sequence', /в(?:†|њ|Џ|”|-|“|љ|™)/u],
  ['emoji bytes decoded as Cyrillic', /рџ[А-Яа-я]/u],
  ['Cyrillic bytes decoded as CP1251', /Р[А-Яа-яЁёЀ-ӿ]Р[А-Яа-яЁёЀ-ӿ]/u],
  ['repeated Cyrillic byte sequence', /(?:Р[А-Яа-я]){2,}/u],
  ['UTF-8 decoded as Latin-1', /(?:Ã.|Â.|Ð.|Ñ.)/u],
]

function walk(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) results.push(...walk(path.join(dir, entry.name)))
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.name === '.env' || entry.name.startsWith('.env.') || entry.name.endsWith('.env')) continue
    if (extensions.has(path.extname(entry.name).toLowerCase()) && entry.name !== 'check-mojibake.mjs') results.push(full)
  }
  return results
}

export function findMojibake(text) {
  const issues = []
  text.split(/\r?\n/).forEach((line, index) => {
    const match = patterns.map(([reason, pattern]) => ({ reason, match: line.match(pattern) })).find((item) => item.match)
    if (match) issues.push({ line: index + 1, reason: match.reason, fragment: match.match[0] })
  })
  return issues
}

function selfTest() {
  const good = ['Бронювання комп’ютера у Львові', 'Реєстрація та оплата - цілодобово', 'Дізнатися більше']
  const bad = ['РџРѕС‚СѓР¶РЅРµ залізо', 'Lviv Arena вЂ” Club', 'ÐŸÑ€Ð¸Ð²Ñ–Ñ‚']
  bad.push(`invalid ${String.fromCharCode(65533)}`)
  if (good.some((line) => findMojibake(line).length) || bad.some((line) => !findMojibake(line).length)) {
    throw new Error('Mojibake checker self-test failed')
  }
}

export function runCheck() {
  selfTest()
  const issues = []
  for (const file of walk(root)) {
    const bytes = fs.readFileSync(file)
    if (bytes.includes(0)) continue
    let content
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { continue }
    for (const issue of findMojibake(content)) issues.push({ file: path.relative(root, file), ...issue })
  }
  if (issues.length) {
    console.error(`Mojibake detected (${issues.length} lines):`)
    for (const issue of issues) console.error(`  ${issue.file}:${issue.line} [${issue.reason}] ${JSON.stringify(issue.fragment)}`)
    process.exitCode = 1
  } else {
    console.log('Mojibake check passed (UTF-8 text files; built-in Ukrainian and damage examples passed).')
  }
  return issues
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) runCheck()

