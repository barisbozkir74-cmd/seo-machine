// Mock for 'server-only' package in test environment.
// In production Next.js, this package throws if imported from client components.
// In Vitest test environment, we allow it so server lib modules can be unit-tested.
export {}
