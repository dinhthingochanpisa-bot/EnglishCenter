'use client';

import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import { apiFetch } from '@/lib/api';
import { API_BASE_URL, withApiBaseUrl } from '@/lib/config';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { 
  Palette, 
  Upload, 
  Settings, 
  Check, 
  RefreshCcw,
  Image as ImageIcon,
  Type,
  Layout,
  MousePointer2
} from 'lucide-react';

const FONT_OPTIONS = ['Inter', 'Roboto', 'Poppins', 'Outfit'];
const RADIUS_OPTIONS = ['0px', '4px', '8px', '12px', '16px', '9999px'];
const COLOR_PRESETS = {
  primaryColor: ['#2563eb', '#0f766e', '#7c3aed', '#dc2626', '#ea580c', '#111827'],
  secondaryColor: ['#475569', '#334155', '#1e293b', '#374151', '#3f3f46', '#52525b'],
  accentColor: ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#84cc16', '#ef4444'],
} as const;

type BrandingForm = {
  appName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: string;
};

export default function BrandingManagementPage() {
  const { branding, setBranding } = useTheme();
  const { notify } = useAppDialog();
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<BrandingForm>({
    appName: branding.appName,
    shortName: branding.shortName,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    headingFont: branding.headingFont,
    bodyFont: branding.bodyFont,
    borderRadius: branding.borderRadius,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccess(false);

    try {
      const data = await apiFetch('/branding/admin', {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      setBranding({
        ...branding,
        ...data,
        logoLightUrl: normalizeAssetUrl(data.logoLightUrl ?? branding.logoLightUrl),
        logoDarkUrl: normalizeAssetUrl(data.logoDarkUrl ?? branding.logoDarkUrl),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to update branding:', error);
      notify({ type: 'error', title: 'Không thể lưu cấu hình', message: 'Vui lòng thử lại sau.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(withApiBaseUrl('/branding/admin/logo'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setBranding({ 
          ...branding, 
          logoLightUrl: `${API_BASE_URL}${data.url}` 
        });
        notify({ type: 'success', title: 'Tải logo thành công' });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Logo upload failed:', error);
      notify({ type: 'error', title: 'Không thể tải logo', message: 'Vui lòng kiểm tra tệp và thử lại.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhãn hiệu & Giao diện</h1>
          <p className="text-slate-500 mt-1">Tùy chỉnh nhận diện thương hiệu của bạn trên toàn hệ thống.</p>
        </div>
        <div className="flex gap-3">
           <Button 
            variant="outline" 
            onClick={() => setFormData({...defaultBranding, appName: branding.appName, shortName: branding.shortName})}
            className="text-xs"
           >
             <RefreshCcw size={14} className="mr-2" />
             Khôi phục mặc định
           </Button>
           <Button onClick={handleSave} isLoading={isSaving} className="min-w-[140px]">
             {success ? <Check size={18} className="mr-2" /> : <Check size={18} className="mr-2" />}
             {success ? 'Đã lưu' : 'Lưu tất cả'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Settings */}
        <div className="lg:col-span-8 space-y-8">
          <Card title="Thông tin cơ bản" subtitle="Tên hiển thị công ty">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên đầy đủ</label>
                <input 
                  type="text" 
                  value={formData.appName}
                  onChange={(e) => setFormData({...formData, appName: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-custom outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên viết tắt</label>
                <input 
                  type="text" 
                  value={formData.shortName}
                  onChange={(e) => setFormData({...formData, shortName: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-custom outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </Card>

          <Card title="Bảng màu" subtitle="Màu sắc chủ đạo cho giao diện">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              {[
                { label: 'Màu chính', key: 'primaryColor' as const, desc: 'Nút bấm, Link, Active state' },
                { label: 'Màu phụ', key: 'secondaryColor' as const, desc: 'Sidebar, Header, Elements' },
                { label: 'Màu nhấn', key: 'accentColor' as const, desc: 'Badge, Thông báo, Highlights' },
              ].map((item) => (
                <ColorField
                  key={item.key}
                  label={item.label}
                  desc={item.desc}
                  value={formData[item.key]}
                  presets={COLOR_PRESETS[item.key]}
                  onChange={(value) =>
                    setFormData((current) => ({ ...current, [item.key]: value }))
                  }
                  />
              ))}
            </div>
          </Card>

          <Card title="Kiểu chữ & Bo góc" subtitle="Cấu hình thẩm mỹ chi tiết">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Type size={14} /> Phông tiêu đề
                </label>
                <select 
                  value={formData.headingFont}
                  onChange={(e) => setFormData({...formData, headingFont: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white text-sm"
                >
                  {FONT_OPTIONS.map(font => <option key={font} value={font}>{font}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Type size={14} /> Phông nội dung
                </label>
                <select 
                  value={formData.bodyFont}
                  onChange={(e) => setFormData({...formData, bodyFont: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white text-sm"
                >
                  {FONT_OPTIONS.map(font => <option key={font} value={font}>{font}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Layout size={14} /> Độ bo góc
                </label>
                <select 
                  value={formData.borderRadius}
                  onChange={(e) => setFormData({...formData, borderRadius: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white text-sm"
                >
                  {RADIUS_OPTIONS.map(radius => <option key={radius} value={radius}>{radius}</option>)}
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Previews */}
        <div className="lg:col-span-4 space-y-8">
          <Card title="Logo & Hình ảnh">
             <div className="mt-4 space-y-6">
                <div className="aspect-video w-full rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group">
                  {branding.logoLightUrl ? (
                    <img src={branding.logoLightUrl} alt="Logo" className="max-w-[70%] max-h-[70%] object-contain p-4" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <ImageIcon size={40} />
                      <span className="text-xs">Chưa có logo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                     <Button size="sm" onClick={() => fileInputRef.current?.click()} isLoading={uploading}>
                       Tải ảnh mới
                     </Button>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                
                <div className="space-y-3">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Xem trước thành phần</p>
                   <div 
                    className="p-6 border border-slate-200 rounded-2xl space-y-4"
                    style={{ 
                      borderRadius: formData.borderRadius,
                      fontFamily: `"${formData.bodyFont}", sans-serif`
                    }}
                   >
                      <h4 
                        className="text-lg font-bold"
                        style={{ fontFamily: `"${formData.headingFont}", sans-serif`, color: formData.primaryColor }}
                      >
                        Tiêu đề mẫu
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Đây là đoạn văn bản mẫu để kiểm tra phông chữ và bố cục hiển thị trên giao diện thực tế.
                      </p>
                      <div className="flex gap-2">
                        <button 
                          className="px-4 py-2 text-xs text-white font-bold"
                          style={{ backgroundColor: formData.primaryColor, borderRadius: formData.borderRadius }}
                        >
                          Nút chính
                        </button>
                        <button 
                          className="px-4 py-2 text-xs font-bold border"
                          style={{ borderColor: formData.primaryColor, color: formData.primaryColor, borderRadius: formData.borderRadius }}
                        >
                          Nút phụ
                        </button>
                      </div>
                      <div className="pt-2">
                         <span 
                          className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white"
                          style={{ backgroundColor: formData.accentColor }}
                         >
                           #Success-Badge
                         </span>
                      </div>
                   </div>
                </div>
             </div>
          </Card>

          <Card title="Trạng thái Sidebar" className="bg-slate-950 border-none">
             <div className="space-y-4">
                <div className="flex items-center gap-3">
                   <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: formData.primaryColor }}
                   >
                     {branding.logoLightUrl ? (
                        <img src={branding.logoLightUrl} alt="L" className="w-6 h-6 object-contain" />
                     ) : (
                        <span className="text-white font-bold text-lg">{formData.shortName.charAt(0)}</span>
                     )}
                   </div>
                   <div className="overflow-hidden">
                     <p className="text-sm font-bold text-white truncate" style={{ fontFamily: `"${formData.headingFont}", sans-serif` }}>
                       {formData.shortName}
                      </p>
                     <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest leading-none">EDU HUB</p>
                   </div>
                </div>
                {/* Menu Mock */}
                <div className="space-y-1 pt-2">
                   {[1, 2].map(i => (
                     <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ 
                        backgroundColor: i === 1 ? `${formData.primaryColor}15` : 'transparent',
                        color: i === 1 ? formData.primaryColor : '#94a3b8'
                      }}>
                        <div className="w-4 h-4 rounded bg-current opacity-20" />
                        <div className="w-20 h-2 bg-current opacity-20 rounded" />
                        {i === 1 && <div className="absolute left-0 w-1 h-4 bg-current rounded-r-full" style={{ left: '1px' }} />}
                     </div>
                   ))}
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label,
  desc,
  value,
  presets,
  onChange,
}: {
  label: string;
  desc: string;
  value: string;
  presets: readonly string[];
  onChange: (value: string) => void;
}) {
  const normalizedValue = normalizeHexColor(value) || '#000000';

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>

      <label className="relative block aspect-[5/3] overflow-hidden rounded-lg border border-slate-200 shadow-sm cursor-pointer group">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${normalizedValue}, ${normalizedValue}cc)`,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.16)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.16)_50%,rgba(255,255,255,0.16)_75%,transparent_75%,transparent)] bg-[length:18px_18px] opacity-30" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-white/85 px-3 py-2 backdrop-blur-sm">
          <span className="font-mono text-xs font-semibold text-slate-800 uppercase">{normalizedValue}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 group-hover:text-slate-900">
            Chọn màu
          </span>
        </div>
        <input
          type="color"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Chọn ${label.toLowerCase()}`}
        />
      </label>

      <div className="grid grid-cols-6 gap-2">
        {presets.map((preset) => {
          const isActive = normalizedValue.toLowerCase() === preset.toLowerCase();
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={clsx(
                'h-8 rounded-md border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30',
                isActive ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:scale-105',
              )}
              style={{ backgroundColor: preset }}
              title={preset}
              aria-label={`Chọn màu ${preset}`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Palette size={16} className="text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            const normalized = normalizeHexColor(event.target.value);
            if (normalized) onChange(normalized);
          }}
          placeholder="#2563eb"
          className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-mono uppercase focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  );
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase()}`;
  }
  return null;
}

function normalizeAssetUrl(value?: string | null) {
  if (!value) return undefined;
  return value.startsWith('http') ? value : `${API_BASE_URL}${value}`;
}

const defaultBranding = {
  appName: 'English Center CRM',
  shortName: 'EC CRM',
  primaryColor: '#2563eb',
  secondaryColor: '#475569',
  accentColor: '#10b981',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  borderRadius: '8px',
};

function clsx(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
