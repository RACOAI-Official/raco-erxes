import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert, Button, Form, Input, Spinner, REACT_APP_API_URL } from 'erxes-ui';
import { BillingCheckout } from './BillingCheckout';

const configSchema = z.object({ domain: z.string(), trialDays: z.number(), checkoutEnabled: z.boolean(),
  paymentMode: z.enum(['sandbox', 'live']).optional().default('sandbox'),
  plans: z.array(z.object({ id: z.string(), name: z.string(), description: z.string(), monthlyPrice: z.number().nullable(), yearlyPrice: z.number().nullable().optional().default(null), currency: z.string(), features: z.array(z.string()) })) });
const resultSchema = z.object({ message: z.string().optional(), workspaceUrl: z.string().url().optional(),
  trialEndsAt: z.string().optional(), paidUntil: z.string().optional(), status: z.string().optional(), planId: z.string().optional(),
  payments: z.array(z.object({ transactionId: z.string(), amount: z.number(), currency: z.string(), interval: z.string(), status: z.string(), createdAt: z.string() })).optional().default([]) });
type Config = z.infer<typeof configSchema>;
type Result = z.infer<typeof resultSchema>;
type Mode = 'signup' | 'verify' | 'account';
const formSchema = z.object({ company: z.string(), workspace: z.string(), email: z.string(),
  firstName: z.string(), password: z.string(), planId: z.string() });
type Values = z.infer<typeof formSchema>;
const fields: Record<Mode, { name: keyof Values; label: string; type?: string }[]> = {
  signup: [{ name: 'company', label: 'Company name' }, { name: 'workspace', label: 'Workspace address' }, { name: 'email', label: 'Work email', type: 'email' }],
  verify: [{ name: 'firstName', label: 'Your name' }, { name: 'password', label: 'Create password (12–72 characters; upper/lowercase and a number)', type: 'password' }],
  account: [{ name: 'workspace', label: 'Workspace address' }, { name: 'email', label: 'Owner email', type: 'email' }, { name: 'password', label: 'Password', type: 'password' }],
};

const call = async (path: string, body?: object): Promise<unknown> => {
  const response = await fetch(`${REACT_APP_API_URL}/saas/${path}`, { method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000), cache: 'no-store' });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(z.object({ error: z.string() }).safeParse(data).data?.error || 'Workspace service is unavailable');
  return data;
};

export const SaasPortal = () => {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('verify'));
  const [mode, setMode] = useState<Mode>(token ? 'verify' : 'signup');
  const [config, setConfig] = useState<Config>();
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: {
    company: '', workspace: '', email: '', firstName: '', password: '', planId: '',
  } });
  useEffect(() => {
    if (token) window.history.replaceState(null, '', '/saas');
    call('config').then(data => { const parsed = configSchema.parse(data); setConfig(parsed); form.setValue('planId', parsed.plans[0].id); })
      .catch(() => setError('SaaS signup is not enabled on this installation. Contact your operator.'));
  }, [form, token]);
  const submit = async (values: Values) => {
    setError(''); setResult(undefined); setBusy(true);
    try {
      const data = mode === 'verify' ? { token, firstName: values.firstName, password: values.password }
        : mode === 'account' ? { workspace: values.workspace, email: values.email, password: values.password }
        : { company: values.company, workspace: values.workspace, email: values.email, planId: values.planId };
      const parsed = resultSchema.parse(await call(mode === 'verify' ? 'verify' : mode === 'account' ? 'account' : 'signup', data));
      setResult(parsed); form.setValue('password', '');
      if (mode === 'verify') window.history.replaceState(null, '', '/saas');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again'); }
    finally { setBusy(false); }
  };
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div><p className="font-semibold text-primary">RACO XOS</p><h1 className="text-3xl font-semibold mt-3">Your customer workspace</h1>
          <p className="text-muted-foreground mt-2">Start a 14-day trial. No card required. Your company’s records stay in its own workspace.</p></div>
        {error && <Alert variant="destructive"><Alert.Description>{error}</Alert.Description></Alert>}
        {new URLSearchParams(window.location.search).has('payment') && <Alert><Alert.Description>The payment provider returned. Sign in to Workspace status to check the verified result.</Alert.Description></Alert>}
        {!config && !error && <Spinner />}
        {config && <div className="grid gap-8 md:grid-cols-2">
          <section className="space-y-4">
            {config.plans.map(plan => <div key={plan.id} className="rounded-xl border p-5 space-y-3">
              <h2 className="text-xl font-semibold">{plan.name}</h2><p>{plan.description}</p>
              <p className="font-medium">{plan.monthlyPrice === null ? 'Pricing to be announced' : `${plan.currency} ${plan.monthlyPrice}/month`}</p>
              <p className="text-sm">{plan.yearlyPrice === null ? 'Yearly pricing to be announced' : `${plan.currency} ${plan.yearlyPrice}/year`}</p>
              <ul className="list-disc pl-5 text-sm space-y-2">{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
              {mode === 'signup' && <Button variant={form.watch('planId') === plan.id ? 'default' : 'outline'} onClick={() => form.setValue('planId', plan.id)}>
                {form.watch('planId') === plan.id ? 'Selected' : 'Choose plan'}</Button>}
            </div>)}
            <p className="text-sm text-muted-foreground">{config.checkoutEnabled ? 'Pay or renew through SSLCommerz after signing in to Workspace status. Monthly and yearly terms are available; no automatic charges.' : 'SSLCommerz setup is pending. BDT monthly and yearly pricing will be configured before payment collection opens.'}</p>
          </section>
          <section className="rounded-xl border p-6 space-y-5">
            <div className="flex gap-2"><Button disabled={busy || mode === 'verify'} variant={mode === 'signup' ? 'default' : 'outline'} onClick={() => { setMode('signup'); setResult(undefined); }}>Start trial</Button>
              <Button disabled={busy || mode === 'verify'} variant={mode === 'account' ? 'default' : 'outline'} onClick={() => { setMode('account'); setResult(undefined); }}>Workspace status</Button></div>
            {result ? <div className="space-y-4">
              <p>{result.message || (mode === 'verify' ? 'Your workspace is ready. Sign in using the owner email and password you just set.' : `Workspace status: ${result.status}`)}</p>
              {result.trialEndsAt && <p>Trial ends {new Date(result.trialEndsAt).toLocaleDateString()}.</p>}
              {result.paidUntil && <p>Paid access until {new Date(result.paidUntil).toLocaleDateString()}.</p>}
              {!!result.payments.length && <div className="space-y-2"><h3 className="font-semibold">Recent payments</h3>
                {result.payments.map(payment => <p key={payment.transactionId} className="text-sm">{payment.currency} {payment.amount.toLocaleString('en-BD')} · {payment.interval} · {payment.status} · {payment.transactionId}</p>)}
              </div>}
              {result.workspaceUrl && <Button onClick={() => window.location.assign(result.workspaceUrl || '/saas')}>Open workspace</Button>}
              {['trial_expired', 'payment_expired'].includes(result.status || '') && <p>Your access period has ended. Your records have been retained.</p>}
              {mode === 'account' && <BillingCheckout workspace={form.getValues('workspace')} email={form.getValues('email')}
                currentPlan={result.planId} enabled={config.checkoutEnabled} mode={config.paymentMode} plans={config.plans} />}
              <Button variant="outline" onClick={() => { setResult(undefined); if (mode === 'verify') setMode('account'); }}>Back</Button>
            </div> : <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              {fields[mode].map(item => <Form.Field key={item.name} control={form.control} name={item.name} render={({ field }) => <Form.Item>
                <Form.Label>{item.label}</Form.Label><Form.Control><Input {...field} type={item.type || 'text'} required
                  minLength={item.name === 'password' && mode === 'verify' ? 12 : undefined} maxLength={item.name === 'password' ? 72 : 254}
                  autoComplete={item.name === 'password' ? mode === 'verify' ? 'new-password' : 'current-password' : undefined} /></Form.Control>
                {item.name === 'workspace' && <Form.Description>{field.value || 'your-company'}.{config.domain}</Form.Description>}<Form.Message />
              </Form.Item>} />)}
              <Button type="submit" disabled={busy}>{busy ? <Spinner size="sm" /> : mode === 'verify' ? 'Verify and create workspace' : mode === 'account' ? 'Check workspace' : 'Email me a verification link'}</Button>
            </form></Form>}
          </section>
        </div>}
      </div>
    </main>
  );
};
