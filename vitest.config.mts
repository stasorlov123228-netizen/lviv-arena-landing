import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import 'dotenv/config'

const testDatabaseURL = process.env.TEST_DATABASE_URL
if (!testDatabaseURL) {
  throw new Error('Refusing to run integration tests without TEST_DATABASE_URL pointing to a dedicated test PostgreSQL database.')
}
const testDatabaseName = new URL(testDatabaseURL).pathname.replace(/^\//, '')
if (!/(^|[_-])test([_-]|$)/i.test(testDatabaseName)) {
  throw new Error('Refusing to run integration tests: TEST_DATABASE_URL database name must clearly identify a test database.')
}

process.env.DATABASE_URI = testDatabaseURL

process.env.PAYLOAD_SECRET ??= 'vitest-only-payload-secret-not-for-deployment'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'integration-node',
          environment: 'node',
          include: ['tests/int/**/*.int.spec.ts'],
          exclude: ['tests/int/booking.int.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration-jsdom',
          environment: 'jsdom',
          include: ['tests/int/booking.int.spec.ts'],
        },
      },
    ],
  },
})
