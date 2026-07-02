'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, type RegistrationInput } from '../../../../lib/registration/schema';
import { registerForEvent } from '../../../../lib/registration/actions';

const HEARD_OPTIONS = ['Friend or family', 'Facebook', 'Church announcement', 'Walked by', 'Other'];

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

const input = 'w-full rounded-lg border px-3 py-2';

export function RegistrationForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<RegistrationInput>({
      resolver: zodResolver(registrationSchema),
      defaultValues: { is_first_time: false },
    });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const res = await registerForEvent(eventId, values);
    if (!res.ok) { setServerError(res.error); return; }
    router.push(`/register/success?matched=${res.matched}${res.duplicate ? '&dup=1' : ''}`);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *" error={errors.first_name?.message}>
          <input className={input} {...register('first_name')} /></Field>
        <Field label="Last name *" error={errors.last_name?.message}>
          <input className={input} {...register('last_name')} /></Field>
        <Field label="Middle name"><input className={input} {...register('middle_name')} /></Field>
        <Field label="Nickname"><input className={input} {...register('nickname')} /></Field>
      </div>

      <Field label="Mobile number *" error={errors.mobile?.message}>
        <input className={input} type="tel" placeholder="0917 123 4567" {...register('mobile')} /></Field>
      <Field label="Email *" error={errors.email?.message}>
        <input className={input} type="email" {...register('email')} /></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender">
          <select className={input} {...register('gender')}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
          </select></Field>
        <Field label="Birthday"><input className={input} type="date" {...register('birthday')} /></Field>
      </div>

      <Field label="Address"><input className={input} {...register('address')} /></Field>
      <Field label="Emergency contact (name & number)">
        <input className={input} {...register('emergency_contact')} /></Field>

      <Field label="How did you hear about this event?">
        <select className={input} {...register('heard_about')}>
          <option value="">—</option>
          {HEARD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select></Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('is_first_time')} />
        This is my first time attending JLYCC
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" {...register('consent_given')} />
        <span>I consent to JLYCC collecting and using my information for event registration and
          follow-up, in line with the Data Privacy Act. *</span>
      </label>
      {errors.consent_given && <p className="text-sm text-red-600">{errors.consent_given.message}</p>}

      <button disabled={isSubmitting}
        className="w-full rounded-lg bg-[#1F8A8B] px-6 py-3 font-semibold text-white disabled:opacity-50">
        {isSubmitting ? 'Submitting…' : 'Submit registration'}
      </button>
    </form>
  );
}
