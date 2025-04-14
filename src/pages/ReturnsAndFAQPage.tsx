import { useState } from 'react';
import { LegalPage } from '../components/legal/LegalPage';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TabContent {
  title: string;
  content: React.ReactNode;
}

export function ReturnsAndFAQPage() {
  const [openTabs, setOpenTabs] = useState<number[]>([]);

  const toggleTab = (index: number) => {
    setOpenTabs(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

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
            <li>If MOQ isn't reached, all payments are refunded after the drop ends</li>
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
          </ul>
        </div>
      )
    },
    {
      title: "Afraid of Doxxing?",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            We take your privacy seriously:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Your personal contact information and shipping address are collected solely for delivery purposes</li>
            <li>This information is only shared with shipping carriers - nothing more</li>
            <li>Shipping providers have no access to your wallet address, transaction details, or any blockchain information</li>
            <li>Your blockchain activity and wallet address remain completely separate from your shipping details</li>
            <li>We maintain strict separation between your Web3 identity and your physical shipping information</li>
            <li>Your on-chain activity remains disconnected from your personal details</li>
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
      title: "Order Tracking",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Track your orders:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Connect your wallet and visit your orders page to track your order status</li>
            <li>Tracking numbers are updated once available from the shipping carrier</li>
            <li>Access your tracking number anytime for live shipping updates</li>
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
            Our payment options:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Choose between Solana blockchain payments or credit card payments via Stripe</li>
            <li>Blockchain payments are processed securely through Solana</li>
            <li>Credit card payments are processed securely through Stripe</li>
            <li>Prices are shown in SOL or USD conversion at the time of purchase</li>
            <li>For blockchain payments: transaction fees are the responsibility of the buyer</li>
            <li>All payments are confirmed in real-time</li>
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
                onClick={() => toggleTab(index)}
                className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                <span className="text-gray-200 font-medium">{tab.title}</span>
                {openTabs.includes(index) ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {openTabs.includes(index) && (
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