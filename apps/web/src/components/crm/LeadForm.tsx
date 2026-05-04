import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { apiFetch } from '@/lib/api';

interface LeadFormProps {
  onSuccess: (lead: any) => void;
  onCancel: () => void;
}

type ContactType = 'PARENT' | 'STUDENT';

const leadSourceOptions = [
  'Fanpage/Page',
  'Google Ads/GG Ads',
  'Hotline',
  'Walk in/Vãng lai',
  'Event/Sự kiện',
  'Khách hàng giới thiệu',
  'Học sinh cũ/Remarketing',
  'Zalo OA',
  'Website/SEO',
  'School/Trường',
  'B2B',
  'CTV/Đối tác',
  'Data list',
  'Khác',
];

const contactTypeOptions: Array<{ value: ContactType; label: string; description: string }> = [
  {
    value: 'PARENT',
    label: 'Phụ huynh liên hệ',
    description: 'Người để lại thông tin là cha, mẹ hoặc người giám hộ.',
  },
  {
    value: 'STUDENT',
    label: 'Học sinh tự liên hệ',
    description: 'Người để lại thông tin chính là học sinh tiềm năng.',
  },
];

export function LeadForm({ onSuccess, onCancel }: LeadFormProps) {
  const [contactType, setContactType] = useState<ContactType>('PARENT');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [prospectiveStudentName, setProspectiveStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [demand, setDemand] = useState('');
  const [address, setAddress] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [source, setSource] = useState('');
  const [isDedupeChecked, setIsDedupeChecked] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [forceCreate, setForceCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crmConfig, setCrmConfig] = useState<any>(null);

  const sourceOptions = crmConfig?.leadSources?.length ? crmConfig.leadSources : leadSourceOptions;
  const schoolOptions = crmConfig?.schools || [];
  const productOptions = crmConfig?.products || [];

  useEffect(() => {
    if (contactType === 'STUDENT' && !selectedParentId) {
      setProspectiveStudentName((current) => current || fullName);
    }
  }, [contactType, fullName, selectedParentId]);

  useEffect(() => {
    apiFetch('/config/monbay-crm')
      .then(setCrmConfig)
      .catch(() => setCrmConfig(null));
  }, []);

  const resetDedupeState = () => {
    setIsDedupeChecked(false);
    setMatches([]);
    setSelectedParentId(null);
    setForceCreate(false);
  };

  const handleCheckDedupe = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) return;

    setIsLoading(true);
    setError(null);
    setSelectedParentId(null);
    setForceCreate(false);

    try {
      const data = await apiFetch<any[]>(`/leads/check-dedupe?phone=${encodeURIComponent(trimmedPhone)}`);
      setMatches(data);
      setIsDedupeChecked(true);
      if (data.length === 1) {
        const contact = data[0];
        setSelectedParentId(contact.id);
        setForceCreate(false);
        setFullName(contact.fullName || '');
        setEmail(contact.email || '');
        if (contactType === 'STUDENT') {
          setProspectiveStudentName(contact.fullName || '');
        }
      }
    } catch {
      setError('Không thể kiểm tra trùng số điện thoại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactNameChange = (value: string) => {
    setFullName(value);
    if (contactType === 'STUDENT' && !selectedParentId) {
      setProspectiveStudentName(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isDedupeChecked) {
      setError('Vui lòng kiểm tra số điện thoại trước khi tạo lead.');
      return;
    }

    const contactName = fullName.trim();
    const studentName = (contactType === 'STUDENT' ? prospectiveStudentName.trim() || contactName : prospectiveStudentName.trim());

    const payload = {
      parentName: contactName,
      phone: phone.trim(),
      email: email.trim() || undefined,
      studentName,
      target: grade.trim() || undefined,
      grade: grade.trim() || undefined,
      school: school.trim() || undefined,
      productInterest: productInterest.trim() || undefined,
      demand: demand.trim() || undefined,
      address: address.trim() || undefined,
      fatherName: fatherName.trim() || undefined,
      fatherPhone: fatherPhone.trim() || undefined,
      motherName: motherName.trim() || undefined,
      motherPhone: motherPhone.trim() || undefined,
      studentPhone: studentPhone.trim() || undefined,
      source: source || undefined,
      notes:
        contactType === 'STUDENT'
          ? '[CONTACT_TYPE:STUDENT] Người liên hệ là học sinh.'
          : '[CONTACT_TYPE:PARENT] Người liên hệ là phụ huynh/người giám hộ.',
      linkParentId: selectedParentId || undefined,
      forceCreate: forceCreate || undefined,
    };

    setIsLoading(true);

    try {
      const lead = await apiFetch('/leads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onSuccess(lead);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo lead.');
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit =
    !isLoading &&
    isDedupeChecked &&
    fullName.trim().length > 0 &&
    phone.trim().length > 0 &&
    (contactType === 'STUDENT' || prospectiveStudentName.trim().length > 0);

  const contactNameLabel = contactType === 'STUDENT' ? 'Họ tên học sinh / người liên hệ *' : 'Họ và tên phụ huynh *';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium text-slate-700">Vai trò người liên hệ</h4>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {contactTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setContactType(option.value);
                  setError(null);
                  if (option.value === 'STUDENT' && !prospectiveStudentName.trim()) {
                    setProspectiveStudentName(fullName);
                  }
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  contactType === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <h4 className="font-medium text-slate-700">Thông tin người liên hệ</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Số điện thoại *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  resetDedupeState();
                }}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <Button
                type="button"
                onClick={handleCheckDedupe}
                variant="secondary"
                size="sm"
                disabled={isLoading || !phone.trim()}
              >
                Kiểm tra
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">{contactNameLabel}</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => handleContactNameChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              required
              disabled={!!selectedParentId}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-500">Nguồn lead</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Chọn nguồn lead</option>
            {sourceOptions.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Địa chỉ</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Nhu cầu</label>
            <input
              type="text"
              value={demand}
              onChange={(e) => setDemand(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {isDedupeChecked && matches.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 p-4">
            <p className="mb-3 text-sm font-medium text-amber-800">
              Phát hiện {matches.length} người liên hệ có số điện thoại tương tự trong hệ thống.
            </p>
            <div className="space-y-2">
              {matches.map((match) => (
                <div key={match.id} className="flex items-center justify-between gap-3 rounded border border-amber-100 bg-white p-2">
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-bold">{match.fullName}</p>
                    <p className="truncate text-slate-500">
                      {match.phone} | {match.email || 'Chưa có email'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant={selectedParentId === match.id ? 'primary' : 'secondary'}
                    onClick={() => {
                      setSelectedParentId(match.id);
                      setForceCreate(false);
                      setFullName(match.fullName);
                      setEmail(match.email || '');
                      if (contactType === 'STUDENT') {
                        setProspectiveStudentName(match.fullName);
                      }
                    }}
                  >
                    {selectedParentId === match.id ? 'Đã liên kết' : 'Liên kết'}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="xs"
                variant={forceCreate ? 'primary' : 'secondary'}
                onClick={() => {
                  setSelectedParentId(null);
                  setForceCreate(true);
                  setFullName('');
                  setEmail('');
                  if (contactType === 'STUDENT') {
                    setProspectiveStudentName('');
                  }
                }}
                className="mt-2"
              >
                Tạo người liên hệ mới
              </Button>
            </div>
          </Card>
        )}

        {isDedupeChecked && matches.length === 0 && (
          <p className="text-xs text-green-600">Số điện thoại chưa trùng trong hệ thống.</p>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-slate-700">Thông tin học sinh tiềm năng</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Tên học sinh *</label>
            <input
              type="text"
              value={prospectiveStudentName}
              onChange={(e) => setProspectiveStudentName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={contactType === 'STUDENT' ? 'Tự điền theo tên người liên hệ' : undefined}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Lớp / mục tiêu</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Lớp 5, IELTS 6.5"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-slate-700">Thông tin bổ sung từ CRM</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Trường</label>
            <input type="text" list="monbay-school-options" value={school} onChange={(e) => setSchool(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Sản phẩm quan tâm</label>
            <input type="text" list="monbay-product-options" value={productInterest} onChange={(e) => setProductInterest(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="IELTS, SAT, JUNIOR..." />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">SĐT học sinh</label>
            <input type="text" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Họ tên bố</label>
            <input type="text" value={fatherName} onChange={(e) => setFatherName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">SĐT bố</label>
            <input type="text" value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">Họ tên mẹ</label>
            <input type="text" value={motherName} onChange={(e) => setMotherName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-500">SĐT mẹ</label>
            <input type="text" value={motherPhone} onChange={(e) => setMotherPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <datalist id="monbay-school-options">
          {schoolOptions.map((option: string) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="monbay-product-options">
          {productOptions.map((option: string) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>

      {error && <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Hủy
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isLoading ? 'Đang tạo...' : 'Tạo Lead'}
        </Button>
      </div>
    </form>
  );
}
