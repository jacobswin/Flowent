import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProcessCanvas } from './ProcessCanvas'

describe('ProcessCanvas', () => {
  it('renders toolbar and title in the canvas shell', () => {
    render(<ProcessCanvas />)

    expect(screen.getByRole('toolbar', { name: /canvas tools/i })).toBeInTheDocument()
    expect(screen.getByText('Flowent')).toBeInTheDocument()
  })
})
