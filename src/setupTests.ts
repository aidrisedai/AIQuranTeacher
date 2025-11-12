import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom does not implement scrollIntoView; stub it for components that call it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window.HTMLElement as any).prototype.scrollIntoView = vi.fn()
