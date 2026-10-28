import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-node',
          environment: 'node',
          include: ['tests/unit/**/*.spec.ts', 'tests/int/booking-api.int.spec.ts'],
          exclude: ['tests/unit/registration-client.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-jsdom',
          environment: 'jsdom',
          include: ['tests/unit/registration-client.spec.ts', 'tests/int/booking.int.spec.ts'],
        },
      },
    ],
  },
})
