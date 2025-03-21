import { useState } from 'react';
import { Tabs } from '../components/ui/Tabs';
import { CollectionsTab } from './merchant/CollectionsTab';
import { OrdersTab } from './merchant/OrdersTab';
import { OrderAnalytics } from '../components/merchant/OrderAnalytics';
import { subDays } from 'date-fns';
import { useOrders } from '../hooks/useOrders';

type TabId = 'collections' | 'orders' | 'analytics';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'collections', label: 'Collections' },
  { id: 'orders', label: 'Orders' },
  { id: 'analytics', label: 'Analytics' },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('collections');
  const { orders } = useOrders();
  const [timeRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-10">
          <Tabs<TabId>
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
          <div className="mt-8">
            {activeTab === 'collections' && <CollectionsTab />}
            {activeTab === 'orders' && <OrdersTab />}
            {activeTab === 'analytics' && <OrderAnalytics orders={orders} timeRange={timeRange} />}
          </div>
        </div>
      </div>
    </div>
  );
} 