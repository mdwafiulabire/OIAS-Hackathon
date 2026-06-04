'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { useCreateTicket } from '@/lib/hooks/use-tickets';
import type { ApiResponse } from '@oias/types';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
}

// Ticket returned on create includes refNumber and id for redirect
interface CreatedTicket {
  id: string;
  refNumber: string;
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const newTicketSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(['request', 'lead', 'case', 'incident']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  categoryId: z.string().uuid().optional(),
});

type NewTicketForm = z.infer<typeof newTicketSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewTicketPage() {
  const router = useRouter();

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<ApiResponse<Category[]>>('/categories'),
  });

  const createTicket = useCreateTicket();

  const form = useForm<NewTicketForm>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'request',
      priority: 'medium',
      categoryId: undefined,
    },
  });

  const onSubmit = (values: NewTicketForm) => {
    const payload = {
      ...values,
      description: values.description || undefined,
      categoryId: values.categoryId || undefined,
    };

    createTicket.mutate(payload as Parameters<typeof createTicket.mutate>[0], {
      onSuccess: (res) => {
        const ticket = res.data as CreatedTicket;
        toast.success(`Ticket #${ticket.refNumber} created`);
        router.push(`/tickets/${ticket.id}`);
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to create ticket');
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New ticket</CardTitle>
          <CardDescription>
            Describe the request, incident, or case you want to track.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Brief description of the request"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description (optional)"
                        rows={4}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type + Priority + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="request">Request</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="case">Case</SelectItem>
                          <SelectItem value="incident">Incident</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(v) => field.onChange(v || undefined)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {categories.data?.data?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create ticket
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
