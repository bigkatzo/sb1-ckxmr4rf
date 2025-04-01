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
      title: "Bonding Curve, Dynamic Pricing & MOQ",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Understanding our pricing system:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Prices are determined by a bonding curve - they adjust based on demand and supply</li>
            <li>Early supporters get better prices as the curve starts lower</li>
            <li>Each design has a Minimum Order Quantity (MOQ) that must be reached</li>
            <li>Once MOQ is reached, production begins for all orders</li>
            <li>If MOQ isn't reached, all payments are refunded 24hrs after the drop ends</li>
          </ul>
        </div>
      )
    },
    {
      title: "Token & NFT-gate and Whitelist",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Special access and privileges:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Some products are exclusively available to specific token or NFT holders</li>
            <li>Whitelisted addresses get early access to new drops</li>
            <li>Token holders may receive special pricing or benefits</li>
            <li>NFT ownership is verified in real-time through the Solana blockchain</li>
            <li>Join our Discord to learn about whitelist opportunities</li>
          </ul>
        </div>
      )
    },
    {
      title: "Shipping Policy",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Our shipping information:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Free worldwide shipping is included with every order</li>
            <li>Standard delivery time is 15-20 days*</li>
            <li>All items are made to order with care</li>
            <li>Tracking information will be provided and updated once available</li>
            <li>Orders are processed and shipped as quickly as possible</li>
          </ul>
        </div>
      )
    },
    {
      title: "Returns & Refunds",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Our returns and refund policy:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Due to the made-to-order nature of our products, we do not accept general returns</li>
            <li>Size-related returns are not accepted - please check measurements carefully before ordering</li>
            <li>If there is a print error or visible quality issue, we'll replace the item or provide a refund</li>
            <li>Quality issues must be reported with photos for verification</li>
            <li>Replacement or refund will be processed once quality issues are confirmed</li>
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
            <li>All products are carefully inspected before shipping</li>
            <li>Quality is guaranteed for all items</li>
            <li>Any print errors or quality issues will be addressed promptly</li>
            <li>Replacement items will be shipped free of charge if quality issues are confirmed</li>
            <li>Our customer service team is here to help with any quality concerns</li>
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
            <li>All payments are processed securely through the Solana blockchain</li>
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