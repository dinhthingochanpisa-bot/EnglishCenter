import LeadDetailClient from './LeadDetailClient';

export const metadata = {
  title: 'Chi tiết Lead | English Center CRM',
  description: 'Xem và quản lý quá trình chăm sóc, đánh giá Lead.',
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetailClient id={id} />;
}
