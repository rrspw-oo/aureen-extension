/**
 * Image Capture Card Component
 * Displays a single captured screenshot as a card
 */

import React, { useState } from 'react';
import type { ImageCapture } from '@/types/image-capture';
import { COLORS } from '@/constants/theme';

interface ImageCaptureCardProps {
  capture: ImageCapture;
  onDelete: (id: string) => void;
}

export const ImageCaptureCard: React.FC<ImageCaptureCardProps> = ({
  capture,
  onDelete
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // Format relative time
  const getRelativeTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Extract domain from URL
  const getDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <>
      <div
        className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Thumbnail */}
        <div
          className="relative bg-gray-100"
          style={{ paddingTop: '75%' }}
          onClick={() => setShowLightbox(true)}
        >
          <img
            src={capture.imageData}
            alt="Screenshot"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {capture.ocrStatus && capture.ocrStatus !== 'done' && (
            <span
              className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                capture.ocrStatus === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-black bg-opacity-60 text-white'
              }`}
            >
              {capture.ocrStatus === 'failed' ? 'OCR failed' : 'OCR...'}
            </span>
          )}
          {capture.ocrStatus === 'done' && capture.ocrText && (
            <span
              className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-600 text-white"
              title={capture.ocrText.slice(0, 200)}
            >
              text
            </span>
          )}

          {/* Action buttons overlay */}
          {showActions && (
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLightbox(true);
                }}
                className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                title="View"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = capture.imageData;
                  link.download = `aureen-capture-${capture.createdAt}.jpg`;
                  link.click();
                }}
                className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                title="Download"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(capture.id);
                }}
                className="p-2 bg-white rounded-full hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          {/* Title */}
          {capture.title && (
            <p className="text-xs font-semibold text-indigo-700 mb-1.5 truncate">{capture.title}</p>
          )}

          {/* Tags */}
          {capture.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {capture.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-2 py-0.5 text-xs font-medium rounded"
                  style={{
                    backgroundColor: COLORS.primary,
                    color: '#374151'
                  }}
                >
                  {tag}
                </span>
              ))}
              {capture.tags.length > 3 && (
                <span className="inline-block px-2 py-0.5 text-xs text-gray-500">
                  +{capture.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Note */}
          {capture.note && (
            <p className="text-xs text-gray-600 line-clamp-2 mb-2 italic border-l-2 border-gray-300 pl-2">
              {capture.note}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="truncate flex-1">{getDomain(capture.url)}</span>
            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
              {capture.linkedIds && capture.linkedIds.length > 0 && (
                <span className="flex items-center gap-0.5 text-indigo-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {capture.linkedIds.length}
                </span>
              )}
              <span>{getRelativeTime(capture.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[99999]"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-6xl max-h-[90vh] p-4">
            <div className="absolute top-6 right-6 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = capture.imageData;
                  link.download = `aureen-capture-${capture.createdAt}.jpg`;
                  link.click();
                }}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
                title="Download"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={() => setShowLightbox(false)}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <img
              src={capture.imageData}
              alt="Screenshot"
              className="max-w-full max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Info overlay */}
            <div className="mt-4 p-4 bg-black bg-opacity-50 rounded-lg text-white">
              {capture.title && <p className="text-sm font-semibold mb-1">{capture.title}</p>}
              <p className="text-sm mb-1">{capture.note || 'No note'}</p>
              <p className="text-xs text-gray-300">{capture.url}</p>
              {capture.linkedIds && capture.linkedIds.length > 0 && (
                <p className="text-xs text-indigo-300 mt-1">{capture.linkedIds.length} linked items</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
