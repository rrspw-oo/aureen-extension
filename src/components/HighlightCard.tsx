import React, { useState } from 'react';
import { escapeHtml, sanitizeUrl } from '@/utils/security';
import { COLORS } from '@/constants/theme';
import { formatDate } from '@/utils/date';
import type { Highlight } from '@/types';

interface HighlightCardProps {
  highlight: Highlight;
  onEdit?: (highlight: Highlight) => void;
  onDelete?: (highlightId: string) => void;
  showUrl?: boolean;
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  highlight,
  onEdit,
  onDelete,
  showUrl = true
}) => {
  const createdDate = formatDate(highlight.createdAt);
  const [isExpanded, setIsExpanded] = useState(false);

  const displayText = isExpanded
    ? highlight.text
    : highlight.text.length > 50
      ? highlight.text.slice(0, 50) + '...'
      : highlight.text;

  const handleEdit = (): void => { if (onEdit) onEdit(highlight); };
  const handleDelete = (): void => {
    if (onDelete && confirm('Are you sure you want to delete this highlight?')) onDelete(highlight.id);
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '14px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(201,168,108,0.12), 0 1px 3px rgba(31,26,12,0.05)',
      border: '1px solid #EFE7D8',
      transition: 'box-shadow 0.2s, transform 0.15s',
    }}
      className="highlight-card"
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(201,168,108,0.22), 0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(201,168,108,0.15), 0 1px 4px rgba(0,0,0,0.06)';
      }}
    >
      {/* Title header */}
      {highlight.title && (
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #F0EADD', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '17px', fontWeight: 700, color: COLORS.goldChipText, lineHeight: 1.3, letterSpacing: '-0.01em', margin: 0 }}>
            {highlight.title}
          </p>
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
            {onEdit && (
              <button onClick={handleEdit}
                style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#c4c3d0', transition: 'background 0.15s, color 0.15s' }}
                title="Edit"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#c4c3d0'; }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button onClick={handleDelete}
                style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#c4c3d0', transition: 'background 0.15s, color 0.15s' }}
                title="Delete"
                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#c4c3d0'; }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: highlight.title ? '12px 16px 14px' : '14px 16px 14px' }}>

        {/* Highlight bubble */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: '#F8F2E6',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '10px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(201,168,108,0.14)',
            position: 'relative',
            transition: 'opacity 0.15s',
          }}
          title={isExpanded ? 'Click to collapse' : 'Click to expand'}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: COLORS.primary, display: 'inline-block',
            marginRight: '6px', verticalAlign: 'middle', flexShrink: 0,
          }} />
          <span
            style={{ fontSize: '13.5px', fontWeight: 500, color: '#4A3F2A', lineHeight: '1.55', whiteSpace: 'pre-line' }}
            dangerouslySetInnerHTML={{ __html: escapeHtml(displayText) }}
          />
          {highlight.text.length > 50 && (
            <p style={{ fontSize: '11px', color: '#B0A07A', marginTop: '5px', marginLeft: '13px' }}>
              {isExpanded ? 'collapse' : 'expand'}
            </p>
          )}
        </div>

        {/* Note */}
        {highlight.note && (
          <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.5', marginBottom: '11px', paddingLeft: '10px', borderLeft: `2px solid ${COLORS.accent}` }}>
            {highlight.note}
          </p>
        )}

        {/* Tags + actions (only when no title — actions are in header when title exists) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1 }}>
            {highlight.tags.map((tag, index) => {
              const displayTag = tag.startsWith('#') ? tag.slice(1) : tag;
              return (
                <span key={index} style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: '9999px',
                  fontSize: '11px', fontWeight: 600, backgroundColor: '#F4ECDD',
                  color: '#9A7B43', letterSpacing: '0.01em',
                }}>
                  {escapeHtml(displayTag)}
                </span>
              );
            })}
            {highlight.linkedIds && highlight.linkedIds.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: COLORS.primary }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {highlight.linkedIds.length}
              </span>
            )}
          </div>

          {!highlight.title && (
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
              {onEdit && (
                <button onClick={handleEdit}
                  style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', transition: 'background 0.15s, color 0.15s' }}
                  title="Edit"
                  onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ca3af'; }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button onClick={handleDelete}
                  style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', transition: 'background 0.15s, color 0.15s' }}
                  title="Delete"
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ca3af'; }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {showUrl && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #F0EADD', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <a
              href={sanitizeUrl(highlight.url)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '11px', color: '#c4c3d0', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }}
              title={highlight.pageTitle}
              onMouseEnter={e => (e.currentTarget.style.color = COLORS.primary)}
              onMouseLeave={e => (e.currentTarget.style.color = '#c4c3d0')}
            >
              {escapeHtml(highlight.pageTitle)}
            </a>
            <span style={{ fontSize: '11px', color: '#c4c3d0', flexShrink: 0 }}>{createdDate}</span>
          </div>
        )}
      </div>
    </div>
  );
};
