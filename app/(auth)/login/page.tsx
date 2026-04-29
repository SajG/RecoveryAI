"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginValues) => {
    setIsLoading(true);

    const result = await signIn("credentials", {
      email: values.email.trim(),
      password: values.password.trim(),
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      toast.error("Invalid email or password.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-12">
      <Card className="w-full max-w-md border-slate-700/70 bg-slate-900/80 text-slate-100 shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-600 bg-slate-800 text-sm font-semibold text-slate-200">
            SB
          </div>
          <div>
            <CardTitle className="text-2xl">Synergy Bonding</CardTitle>
            <CardDescription className="mt-1 text-slate-300">
              Sign in to access Synergy Recovery OS
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@synergyrecovery.in"
                className="border-slate-700 bg-slate-950/60 text-slate-100 placeholder:text-slate-400"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-red-300">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="border-slate-700 bg-slate-950/60 text-slate-100 placeholder:text-slate-400"
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-sm text-red-300">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
