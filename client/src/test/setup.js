import '@testing-library/jest-dom/vitest';

// ManageBillingButton assigns window.location.href — stub for portal tests
Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    ...window.location,
    origin: 'http://localhost:5173',
    href: 'http://localhost:5173/pricing',
    pathname: '/pricing',
    assign: vi.fn(),
    replace: vi.fn()
  }
});
