import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import './PDFUploader.css';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({ onFileSelect }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      
      const files = e.dataTransfer.files;
      if (files && files.length > 0 && files[0].type === 'application/pdf') {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div 
      className="uploader-container"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="uploader-content">
        <div className="icon-wrapper">
          <Upload size={48} className="upload-icon" />
        </div>
        <h2 className="uploader-title">Upload your PDF</h2>
        <p className="uploader-text">Drag and drop your PDF file here, or click to browse</p>
        
        <label className="btn btn-primary upload-btn">
          <FileText size={20} />
          <span>Choose File</span>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handleFileInput} 
            hidden 
          />
        </label>
      </div>
    </div>
  );
};
