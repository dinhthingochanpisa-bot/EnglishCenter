import { apiFetch } from '../api';

export const ContractsClient = {
  findAll: () => apiFetch('/commercial/contracts'),
  findOne: (id: string) => apiFetch(`/commercial/contracts/${id}`),
  create: (data: any) => apiFetch('/commercial/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  quote: (data: any) => apiFetch('/commercial/contracts/quote', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiFetch(`/commercial/contracts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export const PaymentsClient = {
  findAll: () => apiFetch('/commercial/payments'),
  create: (data: any) => apiFetch('/commercial/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getReceivables: () => apiFetch('/commercial/payments/receivables'),
  getContracts: () => apiFetch('/commercial/payments/contracts'),
  getFamilyReceivables: (familyId: string) => apiFetch(`/commercial/payments/receivables/family/${familyId}`),
};

export const RenewalsClient = {
  findCandidates: () => apiFetch('/commercial/renewals/candidates'),
  createRenewal: (contractId: string) => apiFetch(`/commercial/renewals/${contractId}`, {
    method: 'POST',
  }),
};
