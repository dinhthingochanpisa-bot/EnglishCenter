'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Filter, Kanban, Plus, Search, Target } from 'lucide-react';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { LeadForm } from '@/components/crm/LeadForm';
import { apiFetch } from '@/lib/api';
import {
  leadStatusLabels,
  leadStatusVariants,
  opportunityStatusLabels,
  opportunityStatusVariants,
} from '@/lib/lead.constants';

type LeadItem = {
  id: string;
  status: string;
  parent?: { fullName?: string; phone?: string };
  source?: { name?: string };
  center?: { id?: string; name?: string; code?: string };
  owner?: { id?: string; fullName?: string; email?: string };
  opportunities?: Array<{ id: string; status: string; updatedAt?: string }>;
  prospectiveStudentName?: string;
  productInterest?: string;
  school?: string;
  grade?: string;
  closeStatus?: string;
  sourceSheet?: string;
  notes?: string;
  createdAt: string;
};

type Assignee = {
  id: string;
  fullName: string;
  email?: string;
  role?: { code?: string; name?: string };
  centers?: Array<{ centerId: string; center?: { name?: string; code?: string } }>;
};

function getContactRole(lead: LeadItem) {
  return lead.notes?.includes('[CONTACT_TYPE:STUDENT]') ? 'Học sinh' : 'Phụ huynh';
}

function getDisplayStatus(lead: LeadItem) {
  const opportunity = lead.opportunities?.[0];
  if (lead.status === 'CONVERTED' && opportunity) {
    return {
      label: opportunityStatusLabels[opportunity.status] || opportunity.status,
      variant: opportunityStatusVariants[opportunity.status] || 'warning',
      caption: 'Cơ hội',
    };
  }

  return {
    label: leadStatusLabels[lead.status] || lead.status,
    variant: leadStatusVariants[lead.status] || 'info',
    caption: 'Lead',
  };
}

export default function LeadsClient() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<LeadItem[]>('/leads');
      setLeads(data);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách lead';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    apiFetch<Assignee[]>('/leads/assignees')
      .then(setAssignees)
      .catch(() => setAssignees([]));
  }, []);

  const handleAssignLead = async (leadId: string, ownerId: string) => {
    if (!ownerId) return;
    setAssigningLeadId(leadId);
    setError(null);
    try {
      const updated = await apiFetch<LeadItem>(`/leads/${leadId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ ownerId }),
      });
      setLeads((items) =>
        items.map((item) =>
          item.id === leadId
            ? { ...item, owner: updated.owner || assignees.find((assignee) => assignee.id === ownerId) }
            : item,
        ),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể gán nhân viên phụ trách';
      setError(message);
    } finally {
      setAssigningLeadId(null);
    }
  };

  const getAssigneesForLead = (lead: LeadItem) => {
    if (!lead.center?.id) return assignees;
    return assignees.filter(
      (assignee) =>
        assignee.role?.code === 'SUPER_ADMIN' ||
        assignee.centers?.some((center) => center.centerId === lead.center?.id),
    );
  };

  const normalizedSearch = searchTerm.toLowerCase();
  const filteredLeads = leads.filter((lead) => {
    const displayStatus = getDisplayStatus(lead);
    return (
      lead.parent?.fullName?.toLowerCase().includes(normalizedSearch) ||
      lead.parent?.phone?.includes(searchTerm) ||
      lead.source?.name?.toLowerCase().includes(normalizedSearch) ||
      lead.productInterest?.toLowerCase().includes(normalizedSearch) ||
      lead.closeStatus?.toLowerCase().includes(normalizedSearch) ||
      lead.prospectiveStudentName?.toLowerCase().includes(normalizedSearch) ||
      getContactRole(lead).toLowerCase().includes(normalizedSearch) ||
      displayStatus.label.toLowerCase().includes(normalizedSearch)
    );
  });

  return (
    <ModuleBoundary moduleCode="CRM_LEADS">
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Quản lý Lead</h1>
            <p className="mt-1 text-slate-500">
              Ghi nhận, chăm sóc và chuyển đổi khách hàng tiềm năng.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/leads/pipeline">
              <Button variant="secondary">
                <Kanban size={18} className="mr-2" /> Xem Pipeline
              </Button>
            </Link>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus size={18} className="mr-2" /> Thêm Lead
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Tìm theo tên người liên hệ, học sinh, trạng thái hoặc số điện thoại..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="secondary">
              <Filter size={18} className="mr-2" /> Bộ lọc
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="border-red-100 bg-red-50 p-4 text-red-600">
            {error}
          </Card>
        )}

        {isLoading ? (
          <Card className="p-8 text-center text-slate-500">Đang tải danh sách lead...</Card>
        ) : (
          <Card className="overflow-hidden border-slate-100 p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Người liên hệ</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Học sinh tiềm năng</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">CRM Monbay</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Nguồn</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Phụ trách</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Trạng thái</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const displayStatus = getDisplayStatus(lead);
                    return (
                      <tr key={lead.id} className="border-b border-slate-50 transition-colors last:border-b-0 hover:bg-slate-50/30">
                        <td className="px-6 py-4">
                          <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-slate-900 hover:text-primary">
                            {lead.parent?.fullName || 'Chưa có tên'}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-xs text-slate-500">{lead.parent?.phone}</p>
                            <Badge variant="outline">{getContactRole(lead)}</Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <p className="font-medium text-slate-800">{lead.prospectiveStudentName || '-'}</p>
                          <p className="mt-1 text-xs text-slate-400">{[lead.grade, lead.school].filter(Boolean).join(' - ') || 'Chưa có lớp/trường'}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <p>{lead.productInterest || '-'}</p>
                          <p className="mt-1 text-xs text-slate-400">{lead.closeStatus || lead.sourceSheet || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline">{lead.source?.name || 'Chưa có'}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <select
                            value={lead.owner?.id || ''}
                            onChange={(event) => handleAssignLead(lead.id, event.target.value)}
                            disabled={assigningLeadId === lead.id || assignees.length === 0}
                            className="min-w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait disabled:bg-slate-50"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <option value="">Chưa phân công</option>
                            {getAssigneesForLead(lead).map((assignee) => (
                              <option key={assignee.id} value={assignee.id}>
                                {assignee.fullName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={displayStatus.variant}>
                              {displayStatus.label}
                            </Badge>
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">{displayStatus.caption}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(lead.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td className="px-6 py-12 text-center text-slate-500" colSpan={7}>
                        <Target size={32} className="mx-auto mb-3 text-slate-200" />
                        <p className="font-medium text-slate-400">Không tìm thấy lead phù hợp.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Thêm Lead mới"
          size="lg"
        >
          <LeadForm
            onSuccess={() => {
              setIsModalOpen(false);
              fetchLeads();
            }}
            onCancel={() => setIsModalOpen(false)}
          />
        </Modal>
      </div>
    </ModuleBoundary>
  );
}
