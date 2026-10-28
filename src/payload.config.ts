import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Bookings } from './collections/Bookings'
import { Computers } from './collections/Computers'
import { Tariffs } from './collections/Tariffs'
import { Payments } from './collections/Payments'
import { Inquiries } from './collections/Inquiries'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const payloadSecret = process.env.PAYLOAD_SECRET
const blobToken = process.env.BLOB_READ_WRITE_TOKEN
const corsOrigins = [
  getServerSideURL(),
  ...(process.env.FRONTEND_URLS ?? '').split(',').map((origin) => origin.trim()),
]
  .filter(Boolean)
  .map((origin) => {
    try {
      return new URL(origin).origin
    } catch {
      return ''
    }
  })
  .filter((origin, index, all) => origin && all.indexOf(origin) === index)

if (process.env.VERCEL && !blobToken) {
  throw new Error('BLOB_READ_WRITE_TOKEN must be configured in Vercel before deploying media uploads.')
}

if (!payloadSecret || payloadSecret.length < 32) {
  throw new Error('PAYLOAD_SECRET must be set to a private value of at least 32 characters.')
}

export default buildConfig({
  admin: {
    components: {
      beforeLogin: ['@/components/BeforeLogin'],
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  editor: defaultLexical,
  db: postgresAdapter({

    push: process.env.PAYLOAD_DB_PUSH === 'true',
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL || '',
    },
  }),
  collections: [Pages, Posts, Media, Categories, Users, Bookings, Computers, Tariffs, Payments, Inquiries],
  cors: corsOrigins,
  globals: [Header, Footer],
  plugins: [
    ...plugins,
    vercelBlobStorage({
      enabled: Boolean(blobToken),
      alwaysInsertFields: true,
      clientUploads: true,
      collections: { media: true },
      token: blobToken,
    }),
  ],
  secret: payloadSecret,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        if (req.user) return true
        const secret = process.env.CRON_SECRET
        if (!secret) return false
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
