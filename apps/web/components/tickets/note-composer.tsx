'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useCreateNote } from '@/lib/hooks/use-notes';

interface NoteComposerProps {
  ticketId: string;
}

export function NoteComposer({ ticketId }: NoteComposerProps) {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const createNote = useCreateNote(ticketId);

  const handleSend = () => {
    if (!body.trim()) return;
    createNote.mutate(
      { body: body.trim(), isInternal },
      {
        onSuccess: () => {
          toast.success('Note added');
          setBody('');
          setIsInternal(false);
        },
        onError: (err) => {
          toast.error(err.message ?? 'Failed to add note');
        },
      },
    );
  };

  return (
    <div className="space-y-3 pt-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a note…"
        rows={3}
        className="resize-none"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="internal-toggle"
            checked={isInternal}
            onCheckedChange={setIsInternal}
          />
          <Label htmlFor="internal-toggle" className="cursor-pointer text-sm">
            Internal note
          </Label>
        </div>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!body.trim() || createNote.isPending}
        >
          {createNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send
        </Button>
      </div>
    </div>
  );
}
