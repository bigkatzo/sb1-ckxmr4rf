import { LegalPage } from '../../components/legal/LegalPage';

export function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p className="text-gray-400 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="bg-gray-800 p-6 rounded-lg mb-8 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-blue-400">Welcome to store.fun!</h2>
        <p className="text-gray-300 mb-4">We're excited to have you here. These Terms of Use are designed to create a positive experience for everyone. Here's a friendly overview:</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-2 text-blue-300">What We Do</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Provide a secure platform for buying merchandise with crypto</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Connect your wallet seamlessly and safely</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Offer special benefits to NFT holders</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2 text-blue-300">Our Partners</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Logic Group LLC handles all payment processing and shipping</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>For order or payment support, contact admin@logic300.com</span>
              </li>
            </ul>
          </div>
        </div>
        <p className="text-gray-400 mt-4 text-sm italic">Please read the full Terms below for complete details about using our platform.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
        <p className="text-gray-300 mb-4">
          Thank you for choosing store.fun! These Terms of Use are designed to ensure a safe and enjoyable experience for everyone. By using our platform, you agree to these terms and applicable laws. If you have any questions about these terms, please reach out to us before using the platform.
        </p>
        
        <h3 className="text-lg font-medium mb-2 mt-4">1.1 Relationship Structure</h3>
        <p className="text-gray-300 mb-4">
          store.fun is your primary service provider and point of contact for all aspects of your shopping experience. While our operations partner, Logic Group LLC, handles back-end payment processing and fulfillment logistics, store.fun remains your dedicated advocate throughout your journey with us. We're committed to ensuring you have a seamless experience and are here to assist you with any questions or concerns.
        </p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>store.fun is your direct point of contact for all platform-related matters</li>
          <li>Our team will coordinate with Logic Group LLC on your behalf for payment processing and shipping</li>
          <li>For any questions or concerns about your orders, reach out to us first at support@store.fun</li>
          <li>We're committed to resolving any issues quickly and ensuring your complete satisfaction</li>
          <li>This collaborative structure allows us to provide the best possible service while maintaining legal compliance</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">2. Definitions</h2>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>"Platform" refers to store.fun and all its services</li>
          <li>"User" refers to any person accessing or using the platform</li>
          <li>"Buyer" refers to users purchasing products through the platform</li>
          <li>"Merchant" refers to sellers using our platform to sell products</li>
          <li>"NFT" refers to Non-Fungible Tokens on the Solana blockchain</li>
          <li>"SOL" refers to the Solana cryptocurrency</li>
          <li>"Content" refers to all materials and information on the platform</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">3. Account Registration and Requirements</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">3.1 Eligibility</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must be at least 18 years old</li>
            <li>You must have the legal capacity to enter into contracts</li>
            <li>You must not be barred from using the platform under applicable laws</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">3.2 Account Responsibilities</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Promptly update any changes to your information</li>
            <li>Accept responsibility for all activities under your account</li>
            <li>Not share or transfer your account to others</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">4. Payment Terms and Processing</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">4.1 Operating Partner</h3>
          <p className="mb-4">
            All payments and financial operations on the platform are managed by our operations partner, Logic Group LLC (<a href="https://logic300.com" className="text-blue-400 hover:text-blue-300">logic300.com</a>), working closely with our team at store.fun. For payment-related inquiries, please contact us at <a href="mailto:support@store.fun" className="text-blue-400 hover:text-blue-300">support@store.fun</a> and we'll ensure your concerns are addressed promptly.
          </p>
          <p className="mb-4">
            While store.fun provides the technology platform and serves as your primary point of contact, Logic Group LLC handles the back-end payment processing and fulfillment logistics. This structure allows us to focus on creating the best possible experience for you while ensuring efficient operations behind the scenes.
          </p>

          <h3 className="text-lg font-medium mb-2">4.2 Traditional Payments</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Credit card payments are processed through Stripe on behalf of Logic Group LLC</li>
            <li>All applicable fees and taxes will be clearly displayed</li>
            <li>Prices are shown in USD</li>
            <li>Refunds are processed through the original payment method</li>
            <li>All payment disputes should be directed to Logic Group LLC</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">4.3 Blockchain Payments</h3>
          <div className="mb-4">
            <p className="text-gray-300 mb-4">
              When you pay with cryptocurrency, it's important to understand how it works:
            </p>
            <div className="bg-gray-900 p-4 rounded-lg mb-4">
              <h4 className="text-blue-300 text-base font-medium mb-2">What You Should Know</h4>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li>Cryptocurrency payments are processed through the Solana blockchain and managed by Logic Group LLC</li>
                <li>Prices are shown in SOL</li>
                <li>You'll need to pay transaction fees (gas fees)</li>
                <li>Blockchain transactions are irreversible once confirmed</li>
                <li>Always double-check wallet addresses before confirming transactions</li>
              </ul>
            </div>
            
            <div className="bg-yellow-900/20 p-4 rounded-lg border border-yellow-700/30">
              <h4 className="text-yellow-300 text-base font-medium mb-2">Important Considerations</h4>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li>Cryptocurrency values can be volatile</li>
                <li>The platform may temporarily pause crypto payments during network congestion</li>
                <li>Make sure your wallet is compatible with Solana blockchain</li>
                <li>Transaction confirmation times depend on network conditions</li>
                <li>In case of blockchain forks or upgrades, we'll choose which chain to support</li>
                <li>We cannot be responsible for losses due to blockchain network issues</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">5. NFT and Token Gating</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-2">
            Certain products or features may be restricted to holders of specific NFTs or tokens:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Token ownership is verified through wallet connection</li>
            <li>Access rights may change based on token ownership</li>
            <li>We are not responsible for token transfers or sales</li>
            <li>Token holders may receive special pricing or benefits</li>
            <li>Benefits are subject to change without notice</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">6. Product Listings and Purchases</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">6.1 Product Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>All product descriptions are provided by merchants</li>
            <li>store.fun, as the technology provider, does not guarantee accuracy of product information</li>
            <li>Prices and availability are managed by Logic Group LLC</li>
            <li>Products are subject to availability as determined by Logic Group LLC</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">6.2 Ordering and Fulfillment</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Orders are subject to acceptance and availability as determined by Logic Group LLC</li>
            <li>Logic Group LLC reserves the right to refuse or cancel any order</li>
            <li>Shipping and delivery are managed entirely by Logic Group LLC</li>
            <li>Risk of loss transfers upon delivery as per Logic Group LLC's policies</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">7. Returns and Refunds</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">All returns, refunds, and related customer service are handled by our operating partner, Logic Group LLC:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Products are made to order and generally non-returnable as per Logic Group LLC's policies</li>
            <li>Defective items will be replaced or refunded through Logic Group LLC</li>
            <li>Claims must be submitted to Logic Group LLC with photographic evidence</li>
            <li>Refunds will be processed by Logic Group LLC in the original payment method</li>
            <li>Shipping costs refund policies are determined by Logic Group LLC</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">8. Intellectual Property</h2>
        <div className="text-gray-300 mb-4">
          <ul className="list-disc pl-6 space-y-2">
            <li>All platform content is protected by intellectual property laws</li>
            <li>Users may not copy or reproduce content without permission</li>
            <li>Merchants retain ownership of their product designs</li>
            <li>NFT ownership does not transfer intellectual property rights</li>
            <li>Our trademarks may not be used without permission</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">9. Prohibited Activities</h2>
        <div className="text-gray-300 mb-4">
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the platform for any illegal purpose</li>
            <li>Attempt to gain unauthorized access</li>
            <li>Interfere with platform operations</li>
            <li>Upload malicious code or content</li>
            <li>Engage in fraudulent activities</li>
            <li>Scrape or harvest data</li>
            <li>Impersonate others</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">10. Limitation of Liability</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">store.fun, as the technology platform provider, is not liable for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Any payment processing, refunds, or financial transactions handled by Logic Group LLC</li>
            <li>Blockchain network issues or delays</li>
            <li>Wallet connection problems</li>
            <li>Lost or stolen cryptocurrency</li>
            <li>Any shipping, fulfillment, or delivery issues managed by Logic Group LLC</li>
            <li>Product quality issues from merchants</li>
            <li>Data loss or security breaches not directly related to the technology platform</li>
            <li>Technical malfunctions of the platform interface</li>
          </ul>
          <p className="mt-4">For all matters related to payments, orders, shipping, and customer service, please contact us at support@store.fun and we'll be happy to assist you.</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">11. Dispute Resolution and Arbitration</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">11.1 Informal Resolution</h3>
          <p className="mb-4">
            Before initiating any formal dispute resolution, you agree to first contact us and attempt to resolve any disputes informally.
          </p>

          <h3 className="text-lg font-medium mb-2">11.2 Binding Arbitration</h3>
          <p className="mb-4">
            If informal resolution is unsuccessful, all disputes shall be resolved through final and binding arbitration, rather than in court, except that you may assert claims in small claims court if your claims qualify.
          </p>

          <h3 className="text-lg font-medium mb-2">11.3 Arbitration Rules</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Arbitration will be conducted by JAMS under their applicable rules</li>
            <li>Arbitration will be held in Delaware</li>
            <li>The arbitrator's award shall be binding and may be entered as a judgment in any court of competent jurisdiction</li>
            <li>Discovery and rights to appeal are limited under arbitration</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">11.4 Class Action Waiver</h3>
          <p className="mb-4">
            ALL CLAIMS AND DISPUTES MUST BE BROUGHT IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS ACTION, COLLECTIVE ACTION, PRIVATE ATTORNEY GENERAL ACTION, OR OTHER REPRESENTATIVE PROCEEDING.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">12. Indemnification</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">
            You agree to indemnify, defend, and hold harmless store.fun and its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including but not limited to attorney's fees) arising from:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your use of the platform</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights</li>
            <li>Your user content</li>
            <li>Your interaction with other users</li>
            <li>Your blockchain transactions</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">13. Force Majeure</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">
            We shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable control, including but not limited to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Acts of God, natural disasters, or extreme weather</li>
            <li>War, terrorism, or civil unrest</li>
            <li>Government actions or regulations</li>
            <li>Network, hardware, or software failures</li>
            <li>Blockchain network disruptions</li>
            <li>Cybersecurity incidents</li>
            <li>Labor disputes or shortages</li>
            <li>Supply chain disruptions</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">14. Governing Law and Jurisdiction</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">
            These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.
          </p>
          <p className="mb-4">
            For any matters not subject to arbitration, you agree to submit to the personal and exclusive jurisdiction of the courts located in the State of Florida, United States, unless otherwise required by applicable mandatory law.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">15. Severability</h2>
        <div className="text-gray-300 mb-4">
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect and enforceable. The invalid or unenforceable provision shall be replaced by a valid and enforceable provision that comes closest to the intention underlying the invalid or unenforceable provision.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">16. Entire Agreement</h2>
        <div className="text-gray-300 mb-4">
          <p>
            These Terms constitute the entire agreement between you and store.fun regarding your use of the platform and supersede all prior and contemporaneous written or oral agreements. Any additional terms that may apply to specific products or services will be presented to you before you use those features.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">17. Changes to Terms</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-2">
            We may modify these terms at any time. Changes will be communicated through:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email notification to registered users</li>
            <li>Prominent notice on our platform</li>
            <li>Updated "Last updated" date</li>
          </ul>
          <p className="mt-4">
            Changes will be effective immediately upon posting. Your continued use of the platform after changes constitutes acceptance of the modified terms. If you do not agree to the changes, you must discontinue using our services.
          </p>
        </div>
      </section>

      <section className="bg-gray-800 p-6 rounded-lg mb-8 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-blue-400">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2 text-blue-300">Who handles my payment and shipping?</h3>
            <p className="text-gray-300">
              While Logic Group LLC manages the back-end payment processing and shipping operations, store.fun is your direct point of contact for any questions or concerns. We work closely with our operations partner to ensure a seamless experience, and you can always reach us at support@store.fun for assistance.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2 text-blue-300">Is my wallet safe when connecting to store.fun?</h3>
            <p className="text-gray-300">
              Yes! We only request limited permissions to verify ownership and process transactions. We never access your private keys or request permissions to move funds without your explicit approval for each transaction.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2 text-blue-300">What happens if there's a problem with my order?</h3>
            <p className="text-gray-300">
              We're here to help! Contact us at support@store.fun with details about your order issue, and we'll work with our operations team to resolve it quickly. If you receive a defective item, please include photos of the issue to help us process a replacement or refund.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2 text-blue-300">Can I get special discounts with my NFTs?</h3>
            <p className="text-gray-300">
              Yes! Certain NFT holders may receive special pricing, early access, or exclusive products. Connect your wallet to see your personalized offers.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2 text-blue-300">Do you sell my personal information?</h3>
            <p className="text-gray-300">
              Absolutely not. We only collect the minimum information needed to process orders and provide services. Your shipping information is only shared with delivery carriers to fulfill your order.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">18. Contact Information</h2>
        <div className="text-gray-300">
          <p className="mb-4">
            For questions about these Terms of Use, please contact us at:
          </p>
          <ul className="list-none pl-6 space-y-2">
            <li>Legal Department: support@store.fun</li>
            <li>General Support: support@store.fun</li>
            <li>Telegram: @storedotfun</li>
            <li>Payment Operations: <a href="mailto:admin@logic300.com" className="text-blue-400 hover:text-blue-300">admin@logic300.com</a></li>
          </ul>
          <p className="mt-4">
            Payment Operations Address:<br />
            Logic Group LLC<br />
            1110 Brickell Ave. Suite 200<br />
            Miami, FL 33131<br />
            United States
          </p>
        </div>
      </section>
    </LegalPage>
  );
}