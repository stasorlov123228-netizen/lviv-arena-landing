import fs from 'fs'

const serverJs = fs.readFileSync('dist/server.js', 'utf8')
console.log('dist/server.js includes next/cache:', serverJs.includes('next/cache'))
console.log('dist/server.js includes next/headers:', serverJs.includes('next/headers'))
console.log('dist/server.js includes next/navigation:', serverJs.includes('next/navigation'))
console.log('dist/server.js includes next/server:', serverJs.includes('next/server'))
console.log('dist/server.js includes "react":', serverJs.includes('"react"') || serverJs.includes("'react'"))
console.log('dist/server.js includes "react-dom":', serverJs.includes('"react-dom"') || serverJs.includes("'react-dom'"))

