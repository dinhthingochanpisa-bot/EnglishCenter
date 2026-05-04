'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiFetch } from '@/lib/api';
import { Users, Search, Plus, ChevronRight, Hash } from 'lucide-react';
import Link from 'next/link';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';

export default function FamiliesClient() {
  const [families, setFamilies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchFamilies = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/families?search=${search}`);
      setFamilies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFamilies();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <ModuleBoundary moduleCode="FAMILY_PARENT">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Families</h1>
            <p className="text-slate-500">Manage family relationships and students across centers.</p>
          </div>
          <Button className="gap-2">
            <Plus size={18} /> New Family
          </Button>
        </div>

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Search by family name or code..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {families.map((family) => (
              <Link key={family.id} href={`/families/${family.id}`}>
                <Card className="p-5 hover:border-blue-500 transition-colors group cursor-pointer h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <Users size={20} />
                    </div>
                    <div className="bg-slate-100 px-2 py-1 rounded text-[10px] font-mono text-slate-500 flex items-center gap-1">
                      <Hash size={10} /> {family.code}
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {family.name}
                  </h3>
                  <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
                    <span>{family._count?.relations || 0} Members</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!loading && families.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">No families found matching your search.</p>
          </div>
        )}
      </div>
    </ModuleBoundary>
  );
}
