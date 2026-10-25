import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill window.matchMedia for testing Responsive hooks & Framer Motion
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Polyfill IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe(el) {
    // Don't auto-trigger for infinite scroll sentinel to allow testing the "Load more" button
    if (el && el.className && typeof el.className === 'string' && el.className.includes('h-4 w-full')) {
      return null;
    }
    if (this.callback) {
      this.callback([{ isIntersecting: true, target: el }]);
    }
    return null;
  }
  unobserve() { return null; }
  disconnect() { return null; }
};

// Polyfill ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() { return null; }
  unobserve() { return null; }
  disconnect() { return null; }
};

// Polyfill Storage (localStorage / sessionStorage)
function createStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => Object.keys(store)[index] || null),
  };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

global.localStorage = localStorageMock;
global.sessionStorage = sessionStorageMock;

