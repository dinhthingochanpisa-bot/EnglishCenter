'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Pencil, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

type EntityType = 'LEAD' | 'STUDENT' | 'PARENT' | 'TASK' | 'CONTRACT' | 'CLASS';

interface InternalThreadProps {
  entityType: EntityType;
  entityId: string;
  title?: string;
  compact?: boolean;
}

export function InternalThread({
  entityType,
  entityId,
  title = 'Trao đổi nội bộ',
  compact = false,
}: InternalThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = user?.userId || user?.id;
  const endpoint = useMemo(
    () => `/collaboration/${entityType}/${entityId}/messages`,
    [entityType, entityId],
  );

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(endpoint);
      setMessages(data.messages || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải trao đổi nội bộ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [endpoint]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value) return;

    setSaving(true);
    setError(null);
    try {
      const message = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ content: value }),
      });
      setMessages((items) => [...items, message]);
      setContent('');
    } catch (err: any) {
      setError(err.message || 'Không thể gửi trao đổi');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (messageId: string) => {
    const value = editingContent.trim();
    if (!value) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/collaboration/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: value }),
      });
      setMessages((items) =>
        items.map((item) => (item.id === messageId ? updated : item)),
      );
      setEditingId(null);
      setEditingContent('');
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật tin nhắn');
    } finally {
      setSaving(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/collaboration/messages/${messageId}`, {
        method: 'DELETE',
      });
      setMessages((items) => items.filter((item) => item.id !== messageId));
    } catch (err: any) {
      setError(err.message || 'Không thể xóa tin nhắn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={compact ? 'p-4' : 'p-6'}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <MessageSquare size={18} className="text-blue-600" />
            {title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Ghi lại trao đổi nội bộ theo hồ sơ, không gửi ra phụ huynh.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
          {messages.length}
        </span>
      </div>

      <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Đang tải trao đổi...</p>
        ) : messages.length ? (
          messages.map((message) => {
            const isMine = message.authorId === currentUserId;
            const isEditing = editingId === message.id;

            return (
              <div
                key={message.id}
                className={`rounded-xl border p-3 ${
                  isMine ? 'border-blue-100 bg-white' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {message.author?.fullName || message.author?.email || 'Người dùng'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(message.createdAt).toLocaleString('vi-VN')}
                      {message.editedAt ? ' • đã sửa' : ''}
                    </p>
                  </div>
                  {isMine && !isEditing && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                        onClick={() => {
                          setEditingId(message.id);
                          setEditingContent(message.content);
                        }}
                        aria-label="Sửa tin nhắn"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => deleteMessage(message.id)}
                        disabled={saving}
                        aria-label="Xóa tin nhắn"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        <X size={14} /> Hủy
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveEdit(message.id)}
                        disabled={saving || !editingContent.trim()}
                      >
                        Lưu
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {message.content}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <p className="py-8 text-center text-sm italic text-slate-400">
            Chưa có trao đổi nội bộ nào.
          </p>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <textarea
          className="min-h-12 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
          placeholder="Nhập trao đổi nội bộ..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={4000}
        />
        <Button
          type="submit"
          className="self-end gap-2"
          disabled={saving || !content.trim()}
        >
          <Send size={16} /> Gửi
        </Button>
      </form>
    </Card>
  );
}
