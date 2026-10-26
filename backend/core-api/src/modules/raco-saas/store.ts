import mongoose, { Model, Schema } from 'mongoose';
import { coreModelOrganizations, getSaasCoreConnection } from 'erxes-api-shared/utils';

export interface SignupRecord {
  _id: mongoose.Types.ObjectId;
  company: string;
  email: string;
  workspace: string;
  planId: string;
  tokenHash: string;
  state: 'pending' | 'processing' | 'complete';
  expiresAt: Date;
  leaseUntil?: Date;
  organizationId?: mongoose.Types.ObjectId;
}
export interface RacoOrganization {
  _id: mongoose.Types.ObjectId;
  name: string;
  subdomain: string;
  ownerId?: string;
  racoSignupId?: string;
  racoManaged?: boolean;
  racoStatus?: string;
  racoTrialEndsAt?: Date;
  racoPlanId?: string;
  racoPaidUntil?: Date;
  teamMembersLimit?: number;
  plan?: string;
  createdAt?: Date;
  charge?: Record<string, { free: number }>;
  racoAppliedPayments?: string[];
}
export interface PaymentRecord {
  _id: string;
  organizationId: mongoose.Types.ObjectId;
  requestKey: string;
  fingerprint: string;
  planId: string;
  seats: number;
  interval: 'monthly' | 'yearly';
  amountPoisha: number;
  currency: 'BDT';
  mode: 'sandbox' | 'live';
  status: 'creating' | 'pending' | 'failed' | 'verified' | 'paid' | 'sandbox_paid' | 'review';
  gatewayUrl?: string;
  sessionKey?: string;
  validationId?: string;
  bankTransactionId?: string;
  reviewReason?: string;
  createdAt: Date;
  paidAt?: Date;
}
const paymentSchema = new Schema<PaymentRecord>({
  _id: String, organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  requestKey: { type: String, required: true, unique: true }, fingerprint: String,
  planId: String, seats: Number, interval: { type: String, enum: ['monthly', 'yearly'] },
  amountPoisha: Number, currency: { type: String, enum: ['BDT'] }, mode: { type: String, enum: ['sandbox', 'live'] },
  status: String, gatewayUrl: String, sessionKey: String,
  validationId: { type: String, unique: true, sparse: true }, bankTransactionId: String,
  reviewReason: String, createdAt: { type: Date, default: Date.now }, paidAt: Date,
});
const schema = new Schema<SignupRecord>({
  company: String, email: String, workspace: { type: String, unique: true }, planId: String,
  tokenHash: { type: String, unique: true }, state: String, expiresAt: Date,
  leaseUntil: Date, organizationId: Schema.Types.ObjectId,
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const getSaasStores = async () => {
  await getSaasCoreConnection();
  // The shared legacy registry has an untyped public export; narrow it here.
  const organizations: Model<RacoOrganization> = coreModelOrganizations;
  const db = organizations.db;
  const signups = db.models.raco_signups as Model<SignupRecord> | undefined || db.model<SignupRecord>('raco_signups', schema);
  const payments = db.models.raco_payments as Model<PaymentRecord> | undefined || db.model<PaymentRecord>('raco_payments', paymentSchema);
  await signups.init();
  await payments.init();
  await organizations.collection.createIndex({ subdomain: 1 }, { unique: true, partialFilterExpression: { racoManaged: true }, name: 'raco_workspace_unique' });
  return { organizations, signups, payments };
};
