'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { signIn } from '@/lib/auth-client';
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

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginFormValues) {
    setAuthError(null);
    const result = await signIn.email({
      email: values.email,
      password: values.password,
    });

    if (result.error) {
      setAuthError(result.error.message ?? 'Login failed. Please try again.');
      return;
    }

    toast.success('Welcome back');
    router.push('/dashboard');
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Enter your email and password to access your workspace.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {authError && (
            <Alert variant="destructive">
              <TriangleAlert className="size-4" />
              <AlertTitle>Authentication failed</AlertTitle>
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
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don&apos;t have an account?&nbsp;
          <Link href="/register" className="text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
