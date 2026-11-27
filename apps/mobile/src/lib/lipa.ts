import { Platform } from 'react-native';
import {
  LAST_METHOD_KEY,
  PAYMENT_ADAPTERS,
  isLastMethod,
  normalizeTransactionId,
  paymentErrorCode,
  parseMethodRows,
  type LipaNumber,
  type MyPaymentOrder,
  type PaymentMethodRow,
  type PaymentPlatform,
  type PaymentPurpose,
  type RpcClient,
  type StartResult,
} from '@kwetuly/shared';
import { supabase } from './supabase';

// Paying Kwetuly from the app. The server decides everything: which methods are live, the store route
// for this platform (an empty list = show nothing for this item in the app), every amount. The app only
// shows the answer, and "I have paid" only records the transaction ID for an admin to check.
export const appPlatform: PaymentPlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

export async function paymentMethods(purpose: PaymentPurpose): Promise<PaymentMethodRow[]> {
  const { data, error } = await supabase.rpc('payment_methods_for', { p_purpose: purpose, p_platform: appPlatform });
  if (error) throw new Error('methods');
  return parseMethodRows(data);
}

export async function startOrder(args: { purpose: PaymentPurpose; subject?: string | null; period?: 'month' | 'year' | null; month?: string | null; locale: string }): Promise<StartResult> {
  return PAYMENT_ADAPTERS.manual_lipa.createPayment(supabase as unknown as RpcClient, {
    purpose: args.purpose,
    subject: args.subject ?? null,
    period: args.period ?? null,
    accountType: args.purpose === 'verification' ? 'guide' : null,
    month: args.month ?? null,
    locale: args.locale,
    platform: appPlatform,
  });
}

export async function myOrder(reference: string): Promise<MyPaymentOrder | null> {
  const { data, error } = await supabase.rpc('my_payment_orders', { p_reference: reference });
  if (error) throw new Error('order');
  return ((data ?? []) as MyPaymentOrder[])[0] ?? null;
}

export async function payerNumbers(): Promise<LipaNumber[]> {
  const { data, error } = await supabase.rpc('payment_numbers_for_payers');
  if (error) throw new Error('numbers');
  return (data ?? []) as LipaNumber[];
}

/** 'submitted', or a fixed error code for the texts. */
export async function submitClaim(reference: string, network: string, transactionId: string, phone: string): Promise<string> {
  const tx = normalizeTransactionId(transactionId);
  if (!tx) return 'transaction_format';
  const { data, error } = await supabase.rpc('submit_payment_claim', { p_reference: reference, p_network: network, p_transaction_id: tx, p_phone: phone.slice(0, 30) });
  if (error) return paymentErrorCode(error.message);
  return data === 'duplicate' ? 'duplicate' : 'submitted';
}

// Last-used method, per device. Safe to fail: storage errors only lose the ordering.
export function readLastMethod(): string | null {
  try {
    const v = globalThis.localStorage?.getItem(LAST_METHOD_KEY) ?? null;
    return isLastMethod(v) ? v : null;
  } catch {
    return null;
  }
}
export function saveLastMethod(id: string) {
  try {
    globalThis.localStorage?.setItem(LAST_METHOD_KEY, id);
  } catch {
    // ignore
  }
}
