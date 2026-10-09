import React, { useState } from 'react';
import { Sheet, SaveHint, FieldLabel } from '@/components/Sheet';
import { TagInput, withPendingTag } from '@/components/TagInput';
import { LinkPicker } from '@/components/LinkPicker';
import type { Highlight } from '@/types';
import type { ImageCapture } from '@/types/image-capture';

export interface HighlightFormFields {
  title: string;
  note: string;
  tags: string[];
  linkedIds: string[];
}

interface HighlightFormProps {
  isEdit: boolean;
  selfId?: string;
  text: string;
  pageUrl: string;
  initial: HighlightFormFields;
  focusNote: boolean;
  suggestions: string[];
  recentTags: string[];
  highlights: Highlight[];
  captures: ImageCapture[];
  onSave: (fields: HighlightFormFields) => void;
  onCancel: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const HighlightForm: React.FC<HighlightFormProps> = ({
  isEdit,
  selfId,
  text,
  pageUrl,
  initial,
  focusNote,
  suggestions,
  recentTags,
  highlights,
  captures,
  onSave,
  onCancel
}) => {
  const [title, setTitle] = useState(initial.title);
  const [note, setNote] = useState(initial.note);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [pendingTag, setPendingTag] = useState('');
  const [linkedIds, setLinkedIds] = useState<string[]>(initial.linkedIds);

  const save = (finalTags: string[] = withPendingTag(tags, pendingTag)): void => {
    onSave({ title, note, tags: finalTags, linkedIds });
  };

  const recent = recentTags.filter((tag) => !tags.includes(tag)).slice(0, 5);

  return (
    <Sheet
      title={isEdit ? 'Edit highlight' : 'New highlight'}
      subtitle={hostOf(pageUrl)}
      onClose={onCancel}
      footer={
        <>
          <SaveHint />
          <button
            type="button"
            onClick={() => save()}
            className="ml-auto h-11 px-5 rounded-[10px] bg-[#C9A86C] hover:bg-[#B8975B] text-[#2C2417] text-sm font-semibold"
          >
            Save highlight
          </button>
        </>
      }
    >
      <div
        className="contents"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          }
        }}
      >
        <p className="m-0 px-3.5 py-3 rounded-[10px] bg-[#FBF6EB] text-sm leading-relaxed text-[#2E2A22] line-clamp-6">{text}</p>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="hl-title" label="Title" hint="Card and PDF heading" />
          <input
            id="hl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional. Defaults to the page title"
            className="h-10 px-3 border border-[#E2D8C4] rounded-[9px] text-sm outline-none focus:border-[#C9A86C]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel label="Tags" hint="Filter and export" />
          <TagInput
            tags={tags}
            onChange={setTags}
            onSubmit={(next) => save(next)}
            onPendingChange={setPendingTag}
            suggestions={suggestions.map((name) => ({ name }))}
            label={null}
            placeholder="e.g. research, todo"
            maxTags={Infinity}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {recent.length > 0 && <span className="text-[11px] text-[#6B6878]">Recent</span>}
            {recent.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTags([...tags, tag])}
                className="h-6 px-2.5 border border-dashed border-[#D9CDB4] rounded-full bg-white text-xs font-medium text-[#5E5A4E] hover:bg-[#FBF4E6]"
              >
                {tag}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-[#6B6878]">Enter adds a tag</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="hl-note" label="Note" hint="Shown on the card and in the PDF" />
          <textarea
            id="hl-note"
            rows={3}
            value={note}
            autoFocus={focusNote}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this matters"
            className="px-3 py-2.5 border border-[#E2D8C4] rounded-[9px] text-sm resize-none outline-none focus:border-[#C9A86C]"
          />
        </div>

        <LinkPicker
          selfId={selfId}
          pageUrl={pageUrl}
          highlights={highlights}
          captures={captures}
          value={linkedIds}
          onChange={setLinkedIds}
        />
      </div>
    </Sheet>
  );
};
