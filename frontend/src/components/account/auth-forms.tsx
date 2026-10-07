"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { useLogin, useRegister } from "@/lib/api/hooks";
import { PHONE_PATTERN, applyApiFieldErrors } from "@/lib/forms";

const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number"),
  password: z.string().min(1, "Enter your password"),
});
type LoginValues = z.infer<typeof loginSchema>;

function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="touch-target text-fg-muted hover:text-fg absolute top-[1.65rem] right-0 inline-flex items-center justify-center"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}

export function LoginForm({
  next = "/account",
  onSuccess,
}: {
  next?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      if (onSuccess) onSuccess();
      else router.push(next as never);
    } catch (error) {
      applyApiFieldErrors(error, setError, ["identifier", "password"]);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input
        label="Email or phone"
        autoComplete="username"
        inputMode="email"
        error={errors.identifier?.message}
        {...register("identifier")}
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <FormError error={login.error} />
      <Button type="submit" size="lg" loading={isSubmitting || login.isPending}>
        Sign in
      </Button>
      <p className="text-fg-muted text-center text-sm">
        New to Jewelora?{" "}
        <Link
          href="/account/register"
          className="text-accent-text underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your name").max(120),
    email: z.string().trim().email("Enter a valid email").or(z.literal("")),
    phone: z
      .string()
      .trim()
      .regex(PHONE_PATTERN, "Enter a valid phone number with country code")
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[a-z]/, "Include a lower-case letter")
      .regex(/[A-Z]/, "Include an upper-case letter")
      .regex(/\d/, "Include a number"),
    marketing_opt_in: z.boolean(),
  })
  .refine((v) => v.email || v.phone, {
    message: "Enter an email address or a phone number",
    path: ["email"],
  });
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm({
  next = "/account",
  onSuccess,
}: {
  next?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const signup = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { marketing_opt_in: false, email: "", phone: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signup.mutateAsync({
        full_name: values.full_name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        password: values.password,
        marketing_opt_in: values.marketing_opt_in,
      });
      if (onSuccess) onSuccess();
      else router.push(next as never);
    } catch (error) {
      applyApiFieldErrors(error, setError, ["full_name", "email", "phone", "password"]);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input
        label="Full name"
        autoComplete="name"
        required
        error={errors.full_name?.message}
        {...register("full_name")}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label="Phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="+91 98765 43210"
        hint="Either email or phone is required."
        error={errors.phone?.message}
        {...register("phone")}
      />
      <PasswordInput
        label="Password"
        autoComplete="new-password"
        hint="At least 8 characters with upper and lower case letters and a number."
        error={errors.password?.message}
        {...register("password")}
      />
      <Checkbox
        label="Send me new collection launches and private preview invitations"
        {...register("marketing_opt_in")}
      />
      <FormError error={signup.error} />
      <Button type="submit" size="lg" loading={isSubmitting || signup.isPending}>
        Create account
      </Button>
      <p className="text-fg-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/account/login" className="text-accent-text underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
