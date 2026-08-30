import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 8_000 })
