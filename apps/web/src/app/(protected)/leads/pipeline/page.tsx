import PipelineClient from './PipelineClient';

export const metadata = {
  title: 'Pipeline bán hàng | English Center CRM',
  description: 'Quản lý Lead và cơ hội trong một bảng pipeline thống nhất.',
};

export default function PipelinePage() {
  return <PipelineClient />;
}
