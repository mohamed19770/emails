import React, { useState, useRef } from 'react';
import { fileApi } from '../api.js';

function FileShare() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.txt')) {
      setError('Only .txt files are allowed');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await fileApi.uploadFile(file);
      setUploadResult(response.data);
      setDownloadUrl(`${window.location.origin}/api/files/download/${response.data.fileId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleGetFileInfo = async () => {
    const fileId = downloadUrl.split('/').pop();
    if (!fileId) {
      setError('Invalid file ID');
      return;
    }

    setLoadingInfo(true);
    setError(null);

    try {
      const response = await fileApi.getFileInfo(fileId);
      setFileInfo(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get file information');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleDownload = async () => {
    const fileId = downloadUrl.split('/').pop();
    if (!fileId) {
      setError('Invalid file ID');
      return;
    }

    try {
      const response = await fileApi.downloadFile(fileId);
      
      // Create blob and download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo?.originalName || 'download.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download file');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Copied to clipboard');
    });
  };

  const resetForm = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
    setDownloadUrl('');
    setFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>File Share</h2>
        <p>Upload .txt files and share them via public links. Files expire after 7 days.</p>
      </div>

      <div className="card">
        <div className="file-upload-section">
          <h3>Upload File</h3>
          
          <div className="file-upload">
            <label htmlFor="file-input" className="file-upload-label">
              <input
                ref={fileInputRef}
                type="file"
                id="file-input"
                accept=".txt"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <div className="file-upload-area">
                <div className="file-upload-icon">📁</div>
                <div className="file-upload-text">
                  {file ? (
                    <div>
                      <strong>{file.name}</strong>
                      <p>{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <strong>Select .txt file</strong>
                      <p>Click to choose a text file (max 10MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </label>
          </div>

          {file && (
            <div className="form-actions">
              <button 
                onClick={handleUpload}
                className="btn btn-primary"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
              <button 
                onClick={resetForm}
                className="btn btn-secondary"
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {uploadResult && (
            <div className="upload-result">
              <div className="success-message">
                <h4>✅ File uploaded successfully!</h4>
                <div className="result-details">
                  <div className="detail-item">
                    <span className="detail-label">File ID:</span>
                    <span className="detail-value">{uploadResult.fileId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Original Name:</span>
                    <span className="detail-value">{uploadResult.originalName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Size:</span>
                    <span className="detail-value">{(uploadResult.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Expires:</span>
                    <span className="detail-value">
                      {new Date(uploadResult.expiresAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="share-section">
                <h4>Share Link</h4>
                <div className="share-url">
                  <input
                    type="text"
                    value={downloadUrl}
                    readOnly
                    className="url-input"
                  />
                  <button 
                    onClick={() => copyToClipboard(downloadUrl)}
                    className="btn btn-secondary"
                  >
                    Copy
                  </button>
                </div>
                <p className="share-note">
                  Share this link with others to allow them to download the file.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="file-info-section">
          <h3>Get File Information</h3>
          <p>Enter a file ID or download URL to get information about an uploaded file.</p>
          
          <div className="form-group">
            <label htmlFor="download-url">File ID or Download URL</label>
            <input
              type="text"
              id="download-url"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="Enter file ID or full download URL"
              disabled={loadingInfo}
            />
          </div>

          <div className="form-actions">
            <button 
              onClick={handleGetFileInfo}
              className="btn btn-primary"
              disabled={loadingInfo || !downloadUrl.trim()}
            >
              {loadingInfo ? 'Loading...' : 'Get File Info'}
            </button>
            {fileInfo && (
              <button 
                onClick={handleDownload}
                className="btn btn-secondary"
              >
                Download File
              </button>
            )}
          </div>

          {fileInfo && (
            <div className="file-info-result">
              <h4>File Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Original Name:</span>
                  <span className="info-value">{fileInfo.originalName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Size:</span>
                  <span className="info-value">{(fileInfo.size / 1024).toFixed(1)} KB</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Type:</span>
                  <span className="info-value">{fileInfo.mimeType}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Downloads:</span>
                  <span className="info-value">{fileInfo.downloadCount}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Uploaded:</span>
                  <span className="info-value">
                    {new Date(fileInfo.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Last Downloaded:</span>
                  <span className="info-value">
                    {fileInfo.lastDownloadedAt 
                      ? new Date(fileInfo.lastDownloadedAt).toLocaleString()
                      : 'Never'
                    }
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Expires:</span>
                  <span className="info-value">
                    {new Date(fileInfo.expiresAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="info-section">
        <h3>File Sharing Features</h3>
        <div className="info-grid">
          <div className="info-item">
            <h4>🔒 Secure Sharing</h4>
            <p>Files are accessible only via unique public links with no authentication required.</p>
          </div>
          <div className="info-item">
            <h4>⏰ Auto-Expiry</h4>
            <p>Files automatically expire after 7 days to ensure privacy and storage efficiency.</p>
          </div>
          <div className="info-item">
            <h4>📊 Download Tracking</h4>
            <p>Monitor download counts and access patterns for your shared files.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileShare;


















