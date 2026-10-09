/**
 * Image Capture Card Component
 * Displays a single captured screenshot as a card
 */

import React, { useEffect, useState } from 'react';
import type { ImageCapture } from '@/types/image-capture';
import { LinkedItems, type LinkEntry, type LinkKind } from '@/sidebar/ui/LinkedItems';
import { COLORS } from '@/sidebar/ui/theme';

interface CaptureCardProps {
  capture: ImageCapture;
  onDelete: (id: string) => void;
  onEdit?: (capture: ImageCapture) => void;
  onRecognize: (capture: ImageCapture) => void;
  ocrRunning: boolean;
  links: LinkEntry[];
  onNavigate?: (kind: LinkKind, id: string) => void;
  autoOpen: boolean;
  onAutoOpened: () => void;
}

export const CaptureCard: React.FC<CaptureCardProps> = ({
  capture,
  onDelete,
  onEdit,
  onRecognize,
  ocrRunning,
  links,
  onNavigate,
  autoOpen,
  onAutoOpened
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoOpen) {
      setShowLightbox(true);
      onAutoOpened();
    }
  }, [autoOpen]);

  useEffect(() => {
    if (!showLightbox) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowLightbox(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox]);

  const handleCopyText = async (): Promise<void> => {
    await navigator.clipboard.writeText(capture.ocrText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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

          {ocrRunning ? (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-black bg-opacity-60 text-white">
              OCR...
            </span>
          ) : capture.ocrStatus === 'failed' ? (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-600 text-white">
              OCR failed
            </span>
          ) : capture.ocrStatus === 'done' && capture.ocrText ? (
            <span
              className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#A9863F] text-white"
              title={capture.ocrText.slice(0, 200)}
            >
              text
            </span>
          ) : null}

          {/* Action buttons overlay */}
          {showActions && (
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLightbox(true);
                }}
                className="p-1.5 bg-white rounded-full hover:bg-gray-100 transition-colors"
                title="View"
              >
                <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(capture);
                  }}
                  className="p-1.5 bg-white rounded-full hover:bg-[#FBF5EA] transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4 text-[#9A7B43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {!ocrRunning && capture.ocrStatus !== 'done' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRecognize(capture);
                  }}
                  className="p-1.5 bg-white rounded-full hover:bg-[#FBF5EA] transition-colors"
                  title="Recognize text"
                >
                  <svg className="w-4 h-4 text-[#9A7B43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7V5h16v2M9 19h6M12 5v14" />
                  </svg>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = capture.imageData;
                  link.download = `aureen-capture-${capture.createdAt}.jpg`;
                  link.click();
                }}
                className="p-1.5 bg-white rounded-full hover:bg-gray-100 transition-colors"
                title="Download"
              >
                <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(capture.id);
                }}
                className="p-1.5 bg-white rounded-full hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          {/* Title */}
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <p className={`text-[13px] font-semibold truncate ${capture.title ? 'text-[#1F1F2E]' : 'text-[#6B6878] italic font-normal'}`}>{capture.title || 'Untitled'}</p>
            {capture.price && <span className="text-xs font-semibold text-[#6E5428] flex-shrink-0">{capture.price.label}</span>}
          </div>

          {/* Tags */}
          {capture.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {capture.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-2 py-0.5 text-xs font-medium rounded"
                  style={{
                    backgroundColor: COLORS.goldChip,
                    color: COLORS.goldChipText
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
              {links.length > 0 && (
                <span className="flex items-center gap-0.5 text-[#C9A86C]" title="Linked items, listed in the preview">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {links.length}
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
          data-aureen-modal
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[99999]"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-6xl max-h-[90vh] p-4 overflow-y-auto">
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
              {links.length > 0 && onNavigate && (
                <div className="mt-3 pt-3 border-t border-white border-opacity-20" onClick={(e) => e.stopPropagation()}>
                  <LinkedItems
                    links={links}
                    dark
                    onNavigate={(kind, id) => {
                      setShowLightbox(false);
                      onNavigate(kind, id);
                    }}
                  />
                </div>
              )}
              {capture.ocrStatus === 'done' && (
                <div className="mt-3 pt-3 border-t border-white border-opacity-20" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#E0CFA0]">Recognized text</span>
                    {capture.ocrText && (
                      <button
                        onClick={handleCopyText}
                        className="px-2 py-0.5 text-xs bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors"
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {capture.ocrText || 'No text found'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
