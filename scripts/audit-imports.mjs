import fs from 'fs'
import path from 'path'

function walk(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const full = path.join(dir, file)
    const stat = fs.statSync(full)
    if (stat && stat.isDirectory()) results = results.concat(walk(full))
    else results.push(full)
  }
  return results
}

const allSrcFiles = walk('src')
console.log('Total files in src:', allSrcFiles.length)

const targets = [
  { name: 'next', regex: /from\s+['"]next(\/.*)?['"]|require\(['"]next(\/.*)?['"]\)/ },
  { name: 'react', regex: /from\s+['"]react(-dom)?['"]|require\(['"]react(-dom)?['"]\)/ },
  { name: 'payload-next', regex: /@payloadcms\/next/ },
  { name: 'payload-ui', regex: /@payloadcms\/ui/ },
  { name: 'payload-lexical', regex: /@payloadcms\/richtext-lexical/ },
  { name: 'jsx/tsx', regex: /\.(jsx|tsx)$/ },
]

let issues = []
for (const f of allSrcFiles) {
  if (targets[5].regex.test(f)) {
    issues.push({ file: f, problem: 'JSX/TSX file extension' })
  }
  if (f.endsWith('.ts') || f.endsWith('.js')) {
    const code = fs.readFileSync(f, 'utf8')
    for (const t of targets.slice(0, 5)) {
      if (t.regex.test(code)) {
        issues.push({ file: f, problem: t.name })
      }
    }
  }
}

console.log('Issues found:', issues.length)
if (issues.length > 0) {
  console.log(issues)
}

