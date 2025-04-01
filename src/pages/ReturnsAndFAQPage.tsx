import { useState } from 'react';
import { LegalPage } from '../components/legal/LegalPage';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TabContent {
  title: string;
  content: React.ReactNode;
}

export function ReturnsAndFAQPage() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs: TabContent[] = [
    {
      title: "Bonding Curve & Dynamic Pricing",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Our platform uses a bonding curve system for dynamic pricing, which means:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Prices automatically adjust based on supply and demand</li>
            <li>As more items are sold, prices increase gradually</li>
            <li>This creates a fair and transparent pricing mechanism</li>
            <li>Prices are updated in real-time on the platform</li>
            <li>All transactions are recorded on the Solana blockchain</li>
          </ul>
        </div>
      )
    },
    {
      title: "Token & NFT-gate, and Whitelist Access",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Our platform supports various access control mechanisms:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Token-gated access for holders of specific tokens</li>
            <li>NFT-gated access for holders of specific NFTs</li>
            <li>Whitelist access for pre-approved addresses</li>
            <li>Multiple tokens/NFTs can be required for access</li>
            <li>Real-time verification of token/NFT ownership</li>
          </ul>
        </div>
      )
    },
    {
      title: "Returns & Cancellations",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Our returns and cancellation policy:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Orders can be cancelled before payment is confirmed</li>
            <li>Once payment is confirmed, returns are handled on a case-by-case basis</li>
            <li>Digital items are non-refundable once delivered</li>
            <li>Physical items can be returned within 30 days of receipt</li>
            <li>Return shipping costs are the responsibility of the buyer unless the item is defective</li>
          </ul>
        </div>
      )
    },
    {
      title: "Quality Guarantee",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            We stand behind the quality of our products:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>All products are verified before listing</li>
            <li>Physical items are inspected before shipping</li>
            <li>Digital items are verified for authenticity</li>
            <li>Defective items are replaced at no cost</li>
            <li>Quality issues are resolved within 48 hours</li>
          </ul>
        </div>
      )
    },
    {
      title: "Shipping",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Our shipping policies:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Physical items are shipped within 2-3 business days</li>
            <li>Digital items are delivered immediately after payment confirmation</li>
            <li>Shipping costs are calculated at checkout</li>
            <li>Tracking information is provided for physical items</li>
            <li>International shipping is available for most items</li>
          </ul>
        </div>
      )
    },
    {
      title: "Payments",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Our payment system:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>All payments are processed through the Solana blockchain</li>
            <li>Prices are denominated in SOL</li>
            <li>Transaction fees are the responsibility of the buyer</li>
            <li>Payments are confirmed in real-time</li>
            <li>Failed transactions are automatically refunded</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <LegalPage title="Returns & FAQ">
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          {tabs.map((tab, index) => (
            <div key={index} className="border border-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab(index)}
                className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                <span className="text-gray-200 font-medium">{tab.title}</span>
                {activeTab === index ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {activeTab === index && (
                <div className="p-4 bg-gray-900/50">
                  {tab.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </LegalPage>
  );
} 