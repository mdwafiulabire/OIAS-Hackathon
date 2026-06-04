'use client';

// reason: register creates a new org per signup; org-join flow is a separate /join/[token] route (future).
// organisationName is forwarded in signUp.email's additional fields so the API onboarding
// handler can create the org row immediately after account creation.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { signUp } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/auth-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const registerSchema = z.object({
  organisationName: z
    .string()
    .min(2, 'Organisation name must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { organisationName: '', name: '', email: '', password: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: RegisterFormValues) {
    setAuthError(null);

    // reason: Better Auth's signUp.email accepts additional fields that are forwarded
    // to the server. organisationName goes here so the server onboarding handler
    // can create the organisation row after the user account is created.
    const result = await (signUp.email as (args: {
      email: string;
      password: string;
      name: string;
      organisationName: string;
    }) => ReturnType<typeof signUp.email>)({
      email: values.email,
      password: values.password,
      name: values.name,
      organisationName: values.organisationName,
    });

    if (result.error) {
      setAuthError(result.error.message ?? 'Registration failed. Please try again.');
      return;
    }

    toast.success('Account created. Welcome to OIAS.');
    router.push('/dashboard');
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Start your organisation on OIAS. One account, one workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {authError && (
            <Alert variant="destructive">
              <TriangleAlert className="size-4" />
              <AlertTitle>Registration failed</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="organisationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organisation name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Acme Corp"
                        autoComplete="organization"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Jane Smith"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Already have an account?&nbsp;
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
