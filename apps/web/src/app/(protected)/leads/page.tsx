import { ShieldAlert } from 'lucide-react';
import LeadsClient from './LeadsClient';
import { SERVER_API_BASE_URL } from '@/lib/config';

async function isModuleEnabled(moduleCode: string) {
  try {
    const response = await fetch(`${SERVER_API_BASE_URL}/modules`, {
      cache: 'no-store',
    });
    if (!response.ok) return true;

    const modules: Array<{ code: string; settings?: Array<{ isEnabled: boolean }> }> =
      await response.json();
    const moduleItem = modules.find((item) => item.code === moduleCode);
    if (!moduleItem) return true;

    if (!moduleItem.settings || moduleItem.settings.length === 0) return true;
    return Boolean(moduleItem.settings[0].isEnabled);
  } catch {
    return true;
  }
}

export default async function LeadsPage() {
  const enabled = await isModuleEnabled('CRM_LEADS');

  if (!enabled) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-lg text-center p-8 bg-white border border-slate-200 rounded-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Module is disabled</h1>
          <p className="text-slate-500 mt-2">
            CRM_LEADS is currently disabled by system settings, so direct URL access is blocked.
          </p>
        </div>
      </div>
    );
  }

  return <LeadsClient />;
}
