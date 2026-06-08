import React, { useState, useRef } from 'react';
import { jobApi } from '../api.js';

function BatchCheck() {
  const [emails, setEmails] = useState('');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);
  const fileInputRef = useRef(null);

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    
    const emailList = emails
      .split('\n')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emailList.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    if (emailList.length > 1000) {
      setError('Maximum 1000 emails allowed per batch');
      return;
    }

    await createBatchJob(emailList);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('Please upload a .txt file');
      return;
    }

    try {
      const text = await file.text();
      const emailList = text
        .split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (emailList.length === 0) {
        setError('No valid email addresses found in the file');
        return;
      }

      if (emailList.length > 1000) {
        setError('Maximum 1000 emails allowed per batch');
        return;
      }

      setEmails(emailList.join('\n'));
      await createBatchJob(emailList);
    } catch (err) {
      setError('Failed to read file');
    }
  };

  const createBatchJob = async (emailList) => {
    setLoading(true);
    setError(null);
    setJob(null);

    try {
      const response = await jobApi.createBatchJob(emailList);
      setJob(response.data);
      startPolling(response.data.jobId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create batch job');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (jobId) => {
    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await jobApi.getJob(jobId);
        const jobData = response.data;
        setJob(jobData);

        if (jobData.status === 'completed' || jobData.status === 'failed') {
          clearInterval(pollInterval);
          setPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollInterval);
        setPolling(false);
      }
    }, 2000); // Poll every 2 seconds
  };

  const downloadResults = () => {
    if (!job || !job.results) return;

    const csvContent = [
      'Email,Valid,Error',
      ...job.results.map(result => 
        `"${result.email}","${result.isValid}","${result.error || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-validation-results-${job.jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setEmails('');
    setJob(null);
    setError(null);
    setPolling(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Batch Email Check</h2>
        <p>Validate multiple email addresses at once. Upload a .txt file or paste emails directly.</p>
      </div>

      {!job && (
        <div className="card">
          <form onSubmit={handleTextSubmit} className="form">
            <div className="form-group">
              <label htmlFor="emails">Email Addresses</label>
              <textarea
                id="emails"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="Enter email addresses, one per line"
                rows={10}
                disabled={loading}
              />
              <small className="form-help">
                Enter one email address per line. Maximum 1000 emails per batch.
              </small>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading || !emails.trim()}
              >
                {loading ? 'Creating Job...' : 'Start Batch Check'}
              </button>
            </div>
          </form>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="file-upload">
            <label htmlFor="file-upload" className="file-upload-label">
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                accept=".txt"
                onChange={handleFileUpload}
                disabled={loading}
                style={{ display: 'none' }}
              />
              <div className="file-upload-area">
                <div className="file-upload-icon">📁</div>
                <div className="file-upload-text">
                  <strong>Upload .txt file</strong>
                  <p>Click to select a text file containing email addresses</p>
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
        </div>
      )}

      {job && (
        <div className="card">
          <div className="job-header">
            <h3>Batch Job Status</h3>
            <div className="job-actions">
              <button onClick={resetForm} className="btn btn-secondary">
                New Batch
              </button>
              {job.status === 'completed' && (
                <button onClick={downloadResults} className="btn btn-primary">
                  Download Results
                </button>
              )}
            </div>
          </div>

          <div className="job-info">
            <div className="job-details">
              <div className="detail-item">
                <span className="detail-label">Job ID:</span>
                <span className="detail-value">{job.jobId}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className={`status-badge status-${job.status}`}>
                  {job.status}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Total Emails:</span>
                <span className="detail-value">{job.totalEmails}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Processed:</span>
                <span className="detail-value">{job.processedEmails}</span>
              </div>
            </div>

            {job.status === 'processing' && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${job.progressPercentage}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {job.progressPercentage}% complete ({job.processedEmails}/{job.totalEmails})
                </div>
              </div>
            )}

            {job.status === 'completed' && (
              <div className="results-summary">
                <div className="summary-grid">
                  <div className="summary-item valid">
                    <div className="summary-number">{job.validEmails}</div>
                    <div className="summary-label">Valid</div>
                  </div>
                  <div className="summary-item invalid">
                    <div className="summary-number">{job.invalidEmails}</div>
                    <div className="summary-label">Invalid</div>
                  </div>
                  <div className="summary-item total">
                    <div className="summary-number">{job.totalEmails}</div>
                    <div className="summary-label">Total</div>
                  </div>
                </div>
              </div>
            )}

            {job.status === 'failed' && job.error && (
              <div className="alert alert-error">
                <strong>Job Failed:</strong> {job.error}
              </div>
            )}

            {job.results && job.results.length > 0 && (
              <div className="results-preview">
                <h4>Results Preview (First 10)</h4>
                <div className="results-table">
                  <div className="table-header">
                    <div className="table-cell">Email</div>
                    <div className="table-cell">Status</div>
                    <div className="table-cell">Error</div>
                  </div>
                  {job.results.slice(0, 10).map((result, index) => (
                    <div key={index} className="table-row">
                      <div className="table-cell">{result.email}</div>
                      <div className="table-cell">
                        <span className={`status-badge ${result.isValid ? 'status-valid' : 'status-invalid'}`}>
                          {result.isValid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                      <div className="table-cell">{result.error || '-'}</div>
                    </div>
                  ))}
                </div>
                {job.results.length > 10 && (
                  <p className="preview-note">
                    Showing first 10 results. Download full results for complete data.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>Batch Processing Features</h3>
        <div className="info-grid">
          <div className="info-item">
            <h4>📊 Real-time Progress</h4>
            <p>Monitor batch processing with live progress updates and status tracking.</p>
          </div>
          <div className="info-item">
            <h4>📁 File Upload</h4>
            <p>Upload .txt files containing email addresses for bulk validation.</p>
          </div>
          <div className="info-item">
            <h4>📥 CSV Export</h4>
            <p>Download results in CSV format for further analysis and record keeping.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BatchCheck;


















