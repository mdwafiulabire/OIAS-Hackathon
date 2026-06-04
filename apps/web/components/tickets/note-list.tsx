'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatRelativeTime } from '@/lib/utils';

interface Note {
  id: string;
  body: string;
  isInternal: boolean;
  authorId: string;
  authorName?: string;
  createdAt: string;
}

interface NoteListProps {
  notes: Note[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function NoteList({ notes }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No notes yet. Add the first note below.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {notes.map((note, idx) => (
        <div key={note.id}>
          <div className="flex gap-3 py-4">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">
                {note.authorName ? getInitials(note.authorName) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {note.authorName ?? note.authorId.slice(0, 8)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(note.createdAt)}
                </span>
                {note.isInternal && (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs"
                  >
                    Internal
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.body}</p>
            </div>
          </div>
          {idx < notes.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}
