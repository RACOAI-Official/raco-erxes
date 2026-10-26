import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Form, Input, Spinner, REACT_APP_API_URL } from 'erxes-ui';

interface BillingPlan { id: string; name: string; monthlyPrice: number | null; yearlyPrice: number | null }
interface BillingCheckoutProps {
  workspace: string; email: string; currentPlan?: string; enabled: boolean;
  mode: 'sandbox' | 'live'; plans: BillingPlan[];
}
const schema = z.object({ password: z.string().min(1), phone: z.string().min(7).max(20),
  address: z.string().min(3).max(100), city: z.string().min(2).max(50),
  postcode: z.string().min(2).max(20), country: z.string().min(2).max(56) });
type Values = z.infer<typeof schema>;
const labels: Record<keyof Values, string> = { password: 'Owner password — confirm payment setup', phone: 'Billing phone',
  address: 'Billing address', city: 'City', postcode: 'Postcode', country: 'Country' };

export const BillingCheckout = ({ workspace, email, currentPlan, enabled, mode, plans }: BillingCheckoutProps) => {
  const [planId, setPlanId] = useState(currentPlan || plans[0]?.id || '');
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef({ fingerprint: '', id: '' });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: {
    password: '', phone: '', address: '', city: '', postcode: '', country: 'Bangladesh',
  } });
  const plan = plans.find(item => item.id === planId);
  const price = interval === 'monthly' ? plan?.monthlyPrice : plan?.yearlyPrice;
  const submit = async (values: Values) => {
    setBusy(true); setError('');
    try {
      const fingerprint = JSON.stringify([planId, interval, values.phone, values.address, values.city, values.postcode, values.country]);
      if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      const response = await fetch(`${REACT_APP_API_URL}/saas/checkout`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ ...values, workspace, email, planId, interval, requestId: request.current.id }) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(z.object({ error: z.string() }).safeParse(data).data?.error || 'Checkout is unavailable');
      const { gatewayUrl } = z.object({ gatewayUrl: z.string().url() }).parse(data);
      const url = new URL(gatewayUrl);
      const allowed = mode === 'live' ? ['securepay.sslcommerz.com'] : ['sandbox.sslcommerz.com', 'sandbox-gw.sslcommerz.com'];
      if (url.protocol !== 'https:' || !allowed.includes(url.hostname)) throw new Error('Invalid checkout destination');
      form.setValue('password', '');
      window.location.assign(gatewayUrl);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Checkout is unavailable'); }
    finally { setBusy(false); }
  };
  return <div className="border-t pt-5 space-y-4">
    <h3 className="font-semibold">Pay or renew with SSLCommerz</h3>
    <p className="text-sm text-muted-foreground">Choose a monthly or yearly term. Each renewal needs a new payment; this does not authorize automatic charges.</p>
    <p className="text-sm text-muted-foreground">During an active paid term, renew your current plan. Contact the operator for a plan change.</p>
    <div className="flex flex-wrap gap-2">{plans.map(item => <Button key={item.id} variant={planId === item.id ? 'default' : 'outline'} onClick={() => setPlanId(item.id)} disabled={busy}>{item.name}</Button>)}</div>
    <div className="flex gap-2"><Button variant={interval === 'monthly' ? 'default' : 'outline'} onClick={() => setInterval('monthly')} disabled={busy}>Monthly</Button>
      <Button variant={interval === 'yearly' ? 'default' : 'outline'} onClick={() => setInterval('yearly')} disabled={busy}>Yearly</Button></div>
    <p className="font-medium">{price ? `BDT ${price.toLocaleString('en-BD')} / ${interval === 'monthly' ? 'month' : 'year'}` : 'Price to be announced'}</p>
    {!enabled ? <p className="text-sm text-muted-foreground">SSLCommerz is not connected yet. Payment collection is disabled.</p> : <>
      {mode === 'sandbox' && <Alert><Alert.Description>Sandbox checkout: use test payments only. These do not activate paid workspace access.</Alert.Description></Alert>}
      {error && <Alert variant="destructive"><Alert.Description>{error}</Alert.Description></Alert>}
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        {(Object.keys(labels) as (keyof Values)[]).map(name => <Form.Field key={name} control={form.control} name={name} render={({ field }) => <Form.Item>
          <Form.Label>{labels[name]}</Form.Label><Form.Control><Input {...field} type={name === 'password' ? 'password' : 'text'} autoComplete={name === 'password' ? 'current-password' : undefined} /></Form.Control><Form.Message />
        </Form.Item>} />)}
        <p className="text-sm text-muted-foreground">Your billing contact details will be shared with SSLCommerz. Card and mobile banking details are entered on its hosted checkout.</p>
        <Button type="submit" disabled={busy || !price}>{busy ? <Spinner size="sm" /> : 'Continue to SSLCommerz'}</Button>
        {error && <Button type="button" variant="outline" onClick={() => { request.current = { fingerprint: '', id: '' }; setError(''); }}>Start a new checkout after checking payment status</Button>}
      </form></Form>
    </>}
  </div>;
};
