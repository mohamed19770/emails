import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuickCheck from '../pages/QuickCheck.jsx'

// Mock the API module
vi.mock('../api.js', () => ({
  checkEmail: vi.fn()
}))

describe('QuickCheck Component', () => {
  it('renders email input field', () => {
    render(<QuickCheck />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('renders check button', () => {
    render(<QuickCheck />)
    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument()
  })

  it('allows user to type email address', async () => {
    const user = userEvent.setup()
    render(<QuickCheck />)
    
    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'test@example.com')
    
    expect(emailInput.value).toBe('test@example.com')
  })

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup()
    render(<QuickCheck />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const checkButton = screen.getByRole('button', { name: /check/i })
    
    await user.type(emailInput, 'invalid-email')
    await user.click(checkButton)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
    })
  })
})
