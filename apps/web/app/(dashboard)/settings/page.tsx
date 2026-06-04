'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useOrganisation,
  useUpdateOrganisation,
  usePlugins,
  useTogglePlugin,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
} from '@/lib/hooks/use-settings';
import { formatRelativeTime } from '@/lib/utils';

// ─── Schemas ────────────────────────────────────────────────────────────────

const orgSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(60, 'Slug must be at most 60 characters')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, dashes only'),
  plan: z.enum(['lite', 'lite_plus', 'advanced']),
  timezone: z.string().min(1, 'Timezone is required'),
});

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #FF5733)')
    .optional()
    .or(z.literal('')),
});

type OrgFormValues = z.infer<typeof orgSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// ─── Organisation Card ───────────────────────────────────────────────────────

function OrganisationCard() {
  const orgQuery = useOrganisation();
  const updateOrg = useUpdateOrganisation();

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: '', slug: '', plan: 'lite', timezone: 'UTC' },
  });

  const org = orgQuery.data?.data;

  useEffect(() => {
    if (org) {
      form.reset({
        name: org.name,
        slug: org.slug,
        plan: org.plan as OrgFormValues['plan'],
        timezone: org.timezone,
      });
    }
  }, [org, form]);

  function onSubmit(values: OrgFormValues) {
    updateOrg.mutate(values, {
      onSuccess: () => toast.success('Organisation updated'),
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to update organisation';
        toast.error(msg);
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisation</CardTitle>
        <CardDescription>Update your workspace details</CardDescription>
      </CardHeader>
      <CardContent>
        {orgQuery.isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="acme-corp"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Lowercase letters, numbers, and dashes only</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="lite">Lite</SelectItem>
                        <SelectItem value="lite_plus">Lite + Plugins</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateOrg.isPending}>
                {updateOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Category Dialog ─────────────────────────────────────────────────────

function AddCategoryDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const createCategory = useCreateCategory();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', color: '' },
  });

  function onSubmit(values: CategoryFormValues) {
    createCategory.mutate(
      { name: values.name, color: values.color || undefined },
      {
        onSuccess: () => {
          toast.success('Category created');
          setOpen(false);
          form.reset();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to create category';
          toast.error(msg);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
          <DialogDescription>Create a new category to organise tickets.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Bug Reports" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="#FF5733" {...field} />
                  </FormControl>
                  <FormDescription>Hex color code, e.g. #FF5733</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Categories Card ─────────────────────────────────────────────────────────

function CategoriesCard() {
  const categoriesQuery = useCategories();
  const deleteCategory = useDeleteCategory();

  const categories = categoriesQuery.data?.data ?? [];

  function handleDelete(id: string, name: string) {
    deleteCategory.mutate(id, {
      onSuccess: () => toast.success(`Category "${name}" deleted`),
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to delete category';
        toast.error(msg);
      },
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Organise tickets by category</CardDescription>
        </div>
        <AddCategoryDialog>
          <Button size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" />
            Add category
          </Button>
        </AddCategoryDialog>
      </CardHeader>
      <CardContent>
        {categoriesQuery.isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No categories yet. Add one to organise tickets.
            </p>
            <AddCategoryDialog>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add category
              </Button>
            </AddCategoryDialog>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    {cat.color ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full border"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-mono text-xs text-muted-foreground">{cat.color}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {/* Categories schema doesn't expose createdAt here; use isActive indicator instead */}
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete category &quot;{cat.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tickets in this category will lose their category. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleDelete(cat.id, cat.name)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Plugins Card ────────────────────────────────────────────────────────────

function PluginsCard() {
  const pluginsQuery = usePlugins();
  const togglePlugin = useTogglePlugin();

  const plugins = pluginsQuery.data?.data ?? [];

  function handleToggle(id: string, currentEnabled: boolean) {
    togglePlugin.mutate(
      { id, isEnabled: !currentEnabled },
      {
        onSuccess: () =>
          toast.success(`Plugin ${!currentEnabled ? 'enabled' : 'disabled'}`),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to update plugin';
          toast.error(msg);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plugins</CardTitle>
        <CardDescription>Enable or disable plugins for your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        {pluginsQuery.isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : plugins.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No plugins configured yet. Contact your administrator or check the docs.
          </p>
        ) : (
          <div className="divide-y">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium capitalize">{plugin.pluginKey.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-muted-foreground">
                    {plugin.isEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <Switch
                  checked={plugin.isEnabled}
                  onCheckedChange={() => handleToggle(plugin.id, plugin.isEnabled)}
                  disabled={togglePlugin.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace configuration, categories, and plugins.
        </p>
      </div>

      <OrganisationCard />
      <CategoriesCard />
      <PluginsCard />
    </div>
  );
}
