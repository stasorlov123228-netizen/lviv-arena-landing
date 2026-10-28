import fs from 'fs'
import path from 'path'

function walk(dir) {
  let res = []
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item)
    if (fs.statSync(full).isDirectory()) res = res.concat(walk(full))
    else if (full.endsWith('.ts')) res.push(full)
  }
  return res
}

const checkDirs = ['src/templates', 'src/collections', 'src/utilities', 'src/server.ts', 'src/app/api']
let found = 0

for (const d of checkDirs) {
  const files = fs.statSync(d).isDirectory() ? walk(d) : [d]
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8')
    if (/from\s+['"][^'"]*(?:blocks|components|heros|providers|Header|Footer)/i.test(content)) {
      console.log('Match in:', f)
      found++
    }
  }
}

console.log('Total imports from react folders in active code:', found)

