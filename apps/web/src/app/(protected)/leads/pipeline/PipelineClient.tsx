'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { ChevronLeft, ExternalLink, Phone, User } from 'lucide-react';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';
import { salesPipelineStages } from '@/lib/lead.constants';

type PipelineData = {
  leads: any[];
  opportunities: any[];
};

const entityLabels: Record<string, string> = {
  LEAD: 'Lead',
  OPPORTUNITY: 'Cơ hội',
};

export default function PipelineClient() {
  const [data, setData] = useState<PipelineData>({ leads: [], opportunities: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchPipeline = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await apiFetch<PipelineData>('/crm/pipeline');
      setData(resp);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, []);

  const updateStatus = async (item: any, nextStageId: string) => {
    try {
      const url = item.entityType === 'LEAD'
        ? `/leads/${item.id}/status`
        : `/crm/opportunities/${item.id}/status`;

      await apiFetch(url, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStageId }),
      });
      fetchPipeline();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật trạng thái');
    }
  };

  const handleDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const item = [...data.leads, ...data.opportunities].find((entry) => entry.id === draggableId);
    if (!item) return;

    const nextStage = salesPipelineStages.find((stage) => stage.id === destination.droppableId);
    if (!nextStage) return;

    if (item.entityType !== nextStage.entity) {
      if (item.entityType === 'LEAD' && nextStage.entity === 'OPPORTUNITY') {
        router.push(`/leads/${item.id}`);
      }
      return;
    }

    if (item.entityType === 'OPPORTUNITY' && nextStage.id === 'WON') {
      router.push(`/leads/${item.leadId}`);
      return;
    }

    updateStatus(item, nextStage.id);
  };

  const getItemsForStage = (stageId: string) => {
    const stage = salesPipelineStages.find((item) => item.id === stageId);
    if (!stage) return [];

    if (stage.entity === 'LEAD') {
      return data.leads.filter((lead) => lead.status === stageId);
    }

    return data.opportunities.filter((opportunity) => opportunity.status === stageId);
  };

  return (
    <ModuleBoundary moduleCode="SALES_PIPELINE">
      <div className="flex h-[calc(100vh-120px)] flex-col space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <Link href="/leads">
              <Button variant="secondary" size="sm">
                <ChevronLeft size={18} />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Pipeline bán hàng</h1>
          </div>
          <p className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
            Kéo thả lead để chuyển trạng thái
          </p>
        </div>

        {error && (
          <div className="mx-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            Lỗi: {error}
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="scrollbar-custom flex-1 overflow-x-auto pb-4">
            <div className="flex h-full min-w-max gap-4 px-2">
              {salesPipelineStages.map((stage) => (
                <div key={stage.id} className="flex w-72 flex-col rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className={`flex items-center justify-between rounded-t-xl border-b border-white p-3 ${stage.color}`}>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      {stage.label}
                      <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs text-slate-500">
                        {getItemsForStage(stage.id).length}
                      </span>
                    </h3>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 space-y-2 overflow-y-auto p-2 transition-colors duration-200 ${snapshot.isDraggingOver ? 'bg-slate-100/50' : ''}`}
                      >
                        {isLoading ? (
                          <div className="p-4 text-center text-xs font-medium text-slate-400">Đang tải...</div>
                        ) : (
                          getItemsForStage(stage.id).map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={{
                                    ...dragProvided.draggableProps.style,
                                    opacity: dragSnapshot.isDragging ? 0.8 : 1,
                                  }}
                                >
                                  <Card
                                    className={`group cursor-grab border-slate-100 bg-white p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${dragSnapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-primary/20' : ''}`}
                                    onClick={() => router.push(`/leads/${item.entityType === 'LEAD' ? item.id : item.leadId}`)}
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-start justify-between">
                                        <p className="line-clamp-1 text-sm font-bold text-slate-800 transition-colors group-hover:text-primary">
                                          {item.title}
                                        </p>
                                        <ExternalLink size={12} className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
                                      </div>
                                      <div className="space-y-1">
                                        <p className="flex items-center gap-1 text-xs text-slate-500">
                                          <Phone size={10} className="text-slate-400" /> {item.subtitle}
                                        </p>
                                        <p className="flex items-center gap-1 text-xs text-slate-500">
                                          <User size={10} className="text-slate-400" /> {item.owner || 'Chưa phân công'}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-between pt-2">
                                        <Badge variant={stage.entity === 'LEAD' ? 'info' : 'warning'} className="px-2 py-0 text-[10px] font-bold uppercase tracking-wider">
                                          {entityLabels[stage.entity] || stage.entity}
                                        </Badge>
                                      </div>
                                    </div>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>
      </div>
    </ModuleBoundary>
  );
}
