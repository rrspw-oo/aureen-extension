import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SaveHint, FieldLabel } from '@/sidebar/ui/Sheet';
import { TagInput, withPendingTag } from '@/sidebar/ui/TagInput';
import { LinkPicker } from '@/sidebar/ui/LinkPicker';
import { TrimImageModal } from '@/sidebar/captures/TrimImageModal';
import { extractPrice, parsePriceInput } from '@/lib/price';
import type { Highlight } from '@/types/highlight';
import type { CapturePrice, ImageCapture } from '@/types/image-capture';

export interface CaptureFormFields {
  title: string;
  note: string;
  tags: string[];
  linkedIds: string[];
  price?: CapturePrice;
  imageData: string;
}

interface CaptureFormProps {
  isEdit: boolean;
  selfId: string;
  imageData: string;
  fullPage: boolean;
  pageUrl: string;
  ocrText?: string;
  initial: { title: string; note: string; tags: string[]; linkedIds: string[]; price?: CapturePrice };
  suggestions: string[];
  recentTags: string[];
  highlights: Highlight[];
  captures: ImageCapture[];
  onSave: (fields: CaptureFormFields) => void;
  onCancel: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const CaptureForm: React.FC<CaptureFormProps> = ({
  isEdit,
  selfId,
  imageData,
  fullPage,
  pageUrl,
  ocrText,
  initial,
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
  const [priceText, setPriceText] = useState(initial.price?.label ?? '');
  const [priceError, setPriceError] = useState(false);
  const [trimmed, setTrimmed] = useState<string | null>(null);
  const [showTrim, setShowTrim] = useState(false);

  const currentImage = trimmed ?? imageData;

  const resolvePrice = (): CapturePrice | undefined | false => {
    const text = priceText.trim();
    if (!text) {
      const fromOcr = ocrText ? extractPrice(ocrText) : null;
      return fromOcr ? { ...fromOcr, source: 'ocr' } : undefined;
    }
    if (initial.price && text === initial.price.label) return initial.price;
    const parsed = parsePriceInput(text);
    return parsed ? { ...parsed, source: 'manual' } : false;
  };

  const save = (finalTags: string[] = withPendingTag(tags, pendingTag)): void => {
    const price = resolvePrice();
    if (price === false) {
      setPriceError(true);
      return;
    }
    onSave({ title, note, tags: finalTags, linkedIds, price, imageData: currentImage });
  };

  const recent = recentTags.filter((tag) => !tags.includes(tag)).slice(0, 5);

  return (
    <Sheet
      title={isEdit ? t('form.editScreenshot') : t('form.newScreenshot')}
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
            {t('form.saveScreenshot')}
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
        <div className="p-2 bg-[#FBFAF7] border border-[#ECE4D4] rounded-[10px]">
          <img src={currentImage} alt={t('form.previewAlt')} className="w-full max-h-48 object-contain rounded" />
          <div className="mt-2 flex justify-end gap-2">
            {fullPage && (
              <button
                type="button"
                onClick={() => setShowTrim(true)}
                title={t('form.trimTitle')}
                className="h-8 px-3 rounded-lg bg-[#F4ECDD] hover:bg-[#E8DCC2] text-xs font-medium text-[#6E5428]"
              >
                {trimmed ? t('form.trimAgain') : t('form.trim')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const link = document.createElement('a');
                link.href = currentImage;
                link.download = `aureen-capture-${Date.now()}.jpg`;
                link.click();
              }}
              className="h-8 px-3 rounded-lg bg-white border border-[#E2D8C4] hover:bg-[#F4F1EA] text-xs font-medium text-[#5E5A4E]"
            >
              {t('common.download')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cap-title" label={t('form.title')} hint={t('form.titleHint')} />
          <input
            id="cap-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('form.titlePlaceholderCapture')}
            className="h-10 px-3 border border-[#E2D8C4] rounded-[9px] text-sm outline-none focus:border-[#C9A86C]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('form.tags')} hint={t('form.tagsHintCapture')} />
          <TagInput
            tags={tags}
            onChange={setTags}
            onSubmit={(next) => save(next)}
            onPendingChange={setPendingTag}
            suggestions={suggestions.map((name) => ({ name }))}
            label={null}
            placeholder={t('form.tagsPlaceholderCapture')}
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
          <FieldLabel htmlFor="cap-price" label={t('form.price')} hint={t('form.priceHint')} />
          <input
            id="cap-price"
            value={priceText}
            onChange={(e) => {
              setPriceText(e.target.value);
              setPriceError(false);
            }}
            placeholder={initial.price ? '' : t('form.pricePlaceholder')}
            aria-invalid={priceError}
            className={`h-10 px-3 border rounded-[9px] text-sm outline-none ${priceError ? 'border-[#C0533F]' : 'border-[#E2D8C4] focus:border-[#C9A86C]'}`}
          />
          {priceError ? (
            <span className="text-[11px] text-[#B5533F]">{t('form.priceError')}</span>
          ) : initial.price?.source === 'ocr' && priceText === initial.price.label ? (
            <span className="text-[11px] text-[#6B6878]">{t('form.priceFromOcr')}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cap-note" label={t('form.note')} hint={t('form.noteHint')} />
          <textarea
            id="cap-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('form.notePlaceholderCapture')}
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

      {showTrim && (
        <TrimImageModal
          imageData={imageData}
          onCancel={() => setShowTrim(false)}
          onApply={(cropped) => {
            setTrimmed(cropped);
            setShowTrim(false);
          }}
        />
      )}
    </Sheet>
  );
};
