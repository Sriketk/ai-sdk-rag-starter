'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import { getResources, deleteResource } from '@/lib/actions/resources';

interface Resource {
  id: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: string | null;
  createdAt: Date;
}

export default function Chat() {
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage } = useChat();

  // Load resources on component mount
  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    const resourceList = await getResources();
    setResources(resourceList);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus(`✅ ${result.message}`);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Reload resources list
        loadResources();
      } else {
        setUploadStatus(`❌ ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      // Clear status after 5 seconds
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        handleFileUpload(file);
      } else {
        setUploadStatus('❌ Please upload a PDF file');
        setTimeout(() => setUploadStatus(null), 5000);
      }
    }
  };

  const handleDeleteResource = async (resourceId: string, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
      const result = await deleteResource(resourceId);
      setUploadStatus(result.includes('Successfully') ? `✅ ${result}` : `❌ ${result}`);
      setTimeout(() => setUploadStatus(null), 3000);
      loadResources();
    }
  };

  const formatFileSize = (sizeStr: string | null) => {
    if (!sizeStr) return 'Unknown';
    const size = parseInt(sizeStr);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {/* PDF Upload Section */}
      <div className="mb-8 p-4 border-2 border-dashed border-gray-300 rounded-lg">
        <div
          className="text-center"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <h3 className="text-lg font-semibold mb-2">Upload PDF Documents</h3>
          <p className="text-sm text-gray-600 mb-4">
            Drag and drop a PDF file here or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Choose PDF File'}
          </button>
          {uploadStatus && (
            <div className="mt-3 p-2 text-sm rounded bg-gray-100">
              {uploadStatus}
            </div>
          )}
        </div>
      </div>

      {/* File Management Section */}
      <div className="mb-6">
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          {showFiles ? 'Hide' : 'Show'} Uploaded Files ({resources.length})
        </button>
        
        {showFiles && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            {resources.length === 0 ? (
              <p className="text-sm text-gray-500">No PDF files uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {resources.map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{resource.fileName}</div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(resource.fileSize)} • {new Date(resource.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteResource(resource.id, resource.fileName || 'Unknown')}
                      className="text-xs px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="space-y-4">
        {messages.map(m => (
          <div key={m.id} className="whitespace-pre-wrap">
            <div>
              <div className="font-bold">{m.role}</div>
              {m.parts.map(part => {
                switch (part.type) {
                  case 'text':
                    return <p>{part.text}</p>;
                  case 'tool-addResource':
                  case 'tool-getInformation':
                    return (
                      <p>
                        call{part.state === 'output-available' ? 'ed' : 'ing'}{' '}
                        tool: {part.type}
                        <pre className="my-4 bg-zinc-100 p-2 rounded-sm">
                          {JSON.stringify(part.input, null, 2)}
                        </pre>
                      </p>
                    );
                }
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input */}
      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
      >
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="Ask questions about your documents..."
          onChange={e => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}