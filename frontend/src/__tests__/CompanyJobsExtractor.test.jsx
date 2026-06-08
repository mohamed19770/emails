/**
 * Company Jobs Extractor Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompanyJobsExtractor from '../components/CompanyJobsExtractor';

// Mock fetch
global.fetch = jest.fn();

describe('CompanyJobsExtractor', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders extractor header', () => {
    render(<CompanyJobsExtractor />);
    
    expect(screen.getByText('🏢 Company Jobs Extractor')).toBeInTheDocument();
    expect(screen.getByText('▶')).toBeInTheDocument();
  });

  test('expands config panel when toggle is clicked', () => {
    render(<CompanyJobsExtractor />);
    
    const toggleBtn = screen.getByText('▶');
    fireEvent.click(toggleBtn);
    
    expect(screen.getByText('▼')).toBeInTheDocument();
    expect(screen.getByLabelText('Country')).toBeInTheDocument();
    expect(screen.getByLabelText('Cities (comma-separated)')).toBeInTheDocument();
    expect(screen.getByLabelText('Domains (one per line)')).toBeInTheDocument();
  });

  test('has default values for form inputs', () => {
    render(<CompanyJobsExtractor />);
    
    const toggleBtn = screen.getByText('▶');
    fireEvent.click(toggleBtn);
    
    expect(screen.getByDisplayValue('Saudi Arabia')).toBeInTheDocument();
  });

  test('shows safe mode banner when safe mode is enabled', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ safeMode: true })
    });

    render(<CompanyJobsExtractor />);
    
    await waitFor(() => {
      expect(screen.getByText('Safe Mode is ON — Company jobs extraction is disabled')).toBeInTheDocument();
    });
  });

  test('disables buttons when safe mode is enabled', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ safeMode: true })
    });

    render(<CompanyJobsExtractor />);
    
    const toggleBtn = screen.getByText('▶');
    fireEvent.click(toggleBtn);
    
    await waitFor(() => {
      const runButton = screen.getByText('🚀 Run Extract');
      const dryRunButton = screen.getByText('🧪 Dry Run');
      
      expect(runButton).toBeDisabled();
      expect(dryRunButton).toBeDisabled();
    });
  });

  test('shows results when extraction is successful', async () => {
    const mockResults = {
      ok: true,
      count: 2,
      items: [
        {
          title: 'Software Engineer',
          url: 'https://example.com/job1',
          source: 'example.com',
          location: 'Riyadh, Saudi Arabia',
          countryMatch: true,
          cityMatch: 'Riyadh',
          fetchedAt: '2025-09-29T13:00:00Z'
        },
        {
          title: 'Data Scientist',
          url: 'https://example.com/job2',
          source: 'example.com',
          location: 'Jeddah, Saudi Arabia',
          countryMatch: true,
          cityMatch: 'Jeddah',
          fetchedAt: '2025-09-29T13:00:00Z'
        }
      ]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults
    });

    render(<CompanyJobsExtractor />);
    
    const toggleBtn = screen.getByText('▶');
    fireEvent.click(toggleBtn);
    
    const domainsInput = screen.getByLabelText('Domains (one per line)');
    fireEvent.change(domainsInput, { target: { value: 'example.com' } });
    
    const runButton = screen.getByText('🚀 Run Extract');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('📊 Total: 2')).toBeInTheDocument();
      expect(screen.getByText('🌍 Country Matches: 2')).toBeInTheDocument();
      expect(screen.getByText('🏙️ City Matches: 2')).toBeInTheDocument();
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Data Scientist')).toBeInTheDocument();
    });
  });

  test('shows error when extraction fails', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<CompanyJobsExtractor />);
    
    const toggleBtn = screen.getByText('▶');
    fireEvent.click(toggleBtn);
    
    const domainsInput = screen.getByLabelText('Domains (one per line)');
    fireEvent.change(domainsInput, { target: { value: 'example.com' } });
    
    const runButton = screen.getByText('🚀 Run Extract');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('⏳ Extracting...')).toBeInTheDocument();
    });
  });

  test('filters results when search filter is used', async () => {
    const mockResults = {
      ok: true,
      count: 2,
      items: [
        {
          title: 'Software Engineer',
          url: 'https://example.com/job1',
          source: 'example.com',
          location: 'Riyadh, Saudi Arabia',
          countryMatch: true,
          cityMatch: 'Riyadh',
          fetchedAt: '2025-09-29T13:00:00Z'
        },
        {
          title: 'Data Scientist',
          url: 'https://example.com/job2',
          source: 'example.com',
          location: 'Jeddah, Saudi Arabia',
          countryMatch: true,
          cityMatch: 'Jeddah',
          fetchedAt: '2025-09-29T13:00:00Z'
        }
      ]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults
    });

    render(<CompanyJobsExtractor />);
    
    const toggleBtn = screen.getByText('▶');
    fireEvent.click(toggleBtn);
    
    const domainsInput = screen.getByLabelText('Domains (one per line)');
    fireEvent.change(domainsInput, { target: { value: 'example.com' } });
    
    const runButton = screen.getByText('🚀 Run Extract');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      const filterInput = screen.getByPlaceholderText('🔍 Filter by title or location...');
      fireEvent.change(filterInput, { target: { value: 'Software' } });
      
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.queryByText('Data Scientist')).not.toBeInTheDocument();
    });
  });
});
