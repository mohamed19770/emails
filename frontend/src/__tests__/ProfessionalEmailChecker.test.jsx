import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfessionalEmailChecker from '../pages/ProfessionalEmailChecker';

// Mock the API
jest.mock('../api', () => ({
  runEmailCheck: jest.fn()
}));

const MockedProfessionalEmailChecker = () => (
  <BrowserRouter>
    <ProfessionalEmailChecker />
  </BrowserRouter>
);

describe('ProfessionalEmailChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the professional email checker page', () => {
    render(<MockedProfessionalEmailChecker />);
    
    expect(screen.getByText('Professional Email Checker')).toBeInTheDocument();
    expect(screen.getByText(/Advanced email validation with comprehensive checks/)).toBeInTheDocument();
  });

  it('displays input section with textarea and file upload', () => {
    render(<MockedProfessionalEmailChecker />);
    
    expect(screen.getByLabelText(/Paste emails/)).toBeInTheDocument();
    expect(screen.getByText('📁 Upload .txt or .csv')).toBeInTheDocument();
  });

  it('shows email statistics', () => {
    render(<MockedProfessionalEmailChecker />);
    
    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getByText('Unique:')).toBeInTheDocument();
  });

  it('displays action buttons', () => {
    render(<MockedProfessionalEmailChecker />);
    
    expect(screen.getByText('🔍 Run Check')).toBeInTheDocument();
    expect(screen.getByText('🛡️ Safe Mode Check')).toBeInTheDocument();
    expect(screen.getByText('🗑️ Clear')).toBeInTheDocument();
  });

  it('allows entering emails in textarea', () => {
    render(<MockedProfessionalEmailChecker />);
    
    const textarea = screen.getByLabelText(/Paste emails/);
    fireEvent.change(textarea, { target: { value: 'test@example.com' } });
    
    expect(textarea.value).toBe('test@example.com');
  });

  it('shows advanced pipeline info when expanded', () => {
    render(<MockedProfessionalEmailChecker />);
    
    const details = screen.getByText('Advanced Pipeline Info');
    fireEvent.click(details);
    
    expect(screen.getByText('Verification Pipeline:')).toBeInTheDocument();
    expect(screen.getByText('Regex:')).toBeInTheDocument();
    expect(screen.getByText('MX Lookup:')).toBeInTheDocument();
  });

  it('disables buttons when no emails are entered', () => {
    render(<MockedProfessionalEmailChecker />);
    
    const runButton = screen.getByText('🔍 Run Check');
    const safeModeButton = screen.getByText('🛡️ Safe Mode Check');
    
    expect(runButton.closest('button')).toBeDisabled();
    expect(safeModeButton.closest('button')).toBeDisabled();
  });

  it('enables buttons when emails are entered', () => {
    render(<MockedProfessionalEmailChecker />);
    
    const textarea = screen.getByLabelText(/Paste emails/);
    fireEvent.change(textarea, { target: { value: 'test@example.com' } });
    
    const runButton = screen.getByText('🔍 Run Check');
    const safeModeButton = screen.getByText('🛡️ Safe Mode Check');
    
    expect(runButton.closest('button')).not.toBeDisabled();
    expect(safeModeButton.closest('button')).not.toBeDisabled();
  });

  it('clears all data when clear button is clicked', () => {
    render(<MockedProfessionalEmailChecker />);
    
    const textarea = screen.getByLabelText(/Paste emails/);
    fireEvent.change(textarea, { target: { value: 'test@example.com' } });
    
    const clearButton = screen.getByText('🗑️ Clear');
    fireEvent.click(clearButton);
    
    expect(textarea.value).toBe('');
  });
});
