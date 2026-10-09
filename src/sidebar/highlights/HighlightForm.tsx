import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SaveHint, FieldLabel } from '@/sidebar/ui/Sheet';
import { TagInput, withPendingTag } from '@/sidebar/ui/TagInput';
import { LinkPicker } from '@/sidebar/ui/LinkPicker';
import type { Highlight } from '@/types/highlight';
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
  const { t } = useTranslation();
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
      title={isEdit ? t('form.editHighlight') : t('form.newHighlight')}
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
            {t('form.saveHighlight')}
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
          <FieldLabel htmlFor="hl-title" label={t('form.title')} hint={t('form.titleHint')} />
          <input
            id="hl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('form.titlePlaceholderHighlight')}
            className="h-10 px-3 border border-[#E2D8C4] rounded-[9px] text-sm outline-none focus:border-[#C9A86C]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('form.tags')} hint={t('form.tagsHint')} />
          <TagInput
            tags={tags}
            onChange={setTags}
            onSubmit={(next) => save(next)}
            onPendingChange={setPendingTag}
            suggestions={suggestions.map((name) => ({ name }))}
            label={null}
            placeholder={t('form.tagsPlaceholderHighlight')}
            maxTags={Infinity}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {recent.length > 0 && <span className="text-[11px] text-[#6B6878]">{t('form.recent')}</span>}
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
            <span className="ml-auto text-[11px] text-[#6B6878]">{t('form.enterAddsTag')}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="hl-note" label={t('form.note')} hint={t('form.noteHint')} />
          <textarea
            id="hl-note"
            rows={3}
            value={note}
            autoFocus={focusNote}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('form.notePlaceholderHighlight')}
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
