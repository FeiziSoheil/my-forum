'use client';

import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComposerTextarea } from '@/components/composer/ComposerTextarea';
import { renderRichText } from '@/components/RichText';
import { cn } from '@/lib/utils';

type CommentBodyProps = {
  content: string;
  editedAt?: Date | string | null;
  /** Top-level: 16px/400; nested: 15px/400 */
  isRoot?: boolean;
  isEditing?: boolean;
  editContent?: string;
  onEditChange?: (value: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  isSaving?: boolean;
};

export const CommentBody = memo(function CommentBody({
  content,
  editedAt,
  isRoot = false,
  isEditing,
  editContent = '',
  onEditChange,
  onCancelEdit,
  onSaveEdit,
  isSaving,
}: CommentBodyProps) {
  if (isEditing) {
    return (
      <div className="mb-2">
        <ComposerTextarea
          value={editContent}
          onChange={onEditChange ?? (() => {})}
          rows={3}
          maxLength={500}
          autoFocus
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">
            {editContent.length} / 500
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              disabled={isSaving}
              className="min-h-11 sm:min-h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSaveEdit}
              disabled={isSaving || editContent.trim().length === 0}
              className="min-h-11 sm:min-h-8"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <p
      dir="auto"
      className={cn(
        'mb-2 whitespace-pre-wrap font-normal leading-relaxed text-foreground',
        isRoot ? 'text-base' : 'text-[15px]'
      )}
    >
      {renderRichText(content)}
      {editedAt && (
        <span className="ml-1 text-[12px] font-normal text-muted-foreground">(edited)</span>
      )}
    </p>
  );
});
