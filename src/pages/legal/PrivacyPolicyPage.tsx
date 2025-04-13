import { LegalPage } from '../../components/legal/LegalPage';

export function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-gray-400 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="bg-gray-800 p-6 rounded-lg mb-8 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-blue-400">Privacy at a Glance</h2>
        <p className="text-gray-300 mb-4">Your privacy matters to us. Here's our approach in simple terms:</p>
        <ul className="space-y-3 text-gray-300">
          <li><span className="font-semibold text-green-400">✓</span> We only collect information needed to provide our services</li>
          <li><span className="font-semibold text-green-400">✓</span> We never sell your personal information</li>
          <li><span className="font-semibold text-green-400">✓</span> We use robust security measures to protect your data</li>
          <li><span className="font-semibold text-green-400">✓</span> Your wallet's private keys remain under your control</li>
          <li><span className="font-semibold text-green-400">✓</span> We're your primary point of contact for all support needs</li>
          <li><span className="font-semibold text-green-400">✓</span> Your shipping and contact information is shared only with shipping carriers and only for delivery purposes</li>
          <li><span className="font-semibold text-yellow-400">!</span> Public wallet addresses and blockchain transactions are visible on-chain</li>
        </ul>
        <p className="text-gray-400 mt-4 text-sm italic">This summary gives you the highlights. The full policy below provides all the details you need.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Our Approach to Privacy</h2>
        <p className="text-gray-300 mb-4">
          Welcome to store.fun! We've created this Privacy Policy to explain how we protect your information in simple, straightforward language. We believe you deserve to know exactly how your data is handled when you use our platform.
        </p>
        <p className="text-gray-300 mb-4">
          We understand that privacy concerns can be heightened when using blockchain technology. That's why we've designed our platform with privacy at its core – giving you control over your information while enjoying a seamless shopping experience that bridges traditional e-commerce with Web3.
        </p>
        <p className="text-gray-300 mb-4">
          As your primary service provider, we're committed to protecting your privacy every step of the way. If you have questions at any point, our team is here to help at <span className="text-blue-400">support@store.fun</span>.
        </p>
      </section>

      <section className="bg-gray-800 p-6 rounded-lg mb-8 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-blue-400">Our Privacy Approach</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">store.fun implements the following privacy practices:</p>
          <ul className="space-y-4">
            <li className="flex items-start">
              <div className="text-gray-400 mr-3 mt-1">•</div>
              <div>
                <span className="font-semibold">Central point of contact:</span> We provide a unified support channel for all account and service matters.
              </div>
            </li>
            <li className="flex items-start">
              <div className="text-gray-400 mr-3 mt-1">•</div>
              <div>
                <span className="font-semibold">Data segregation:</span> We separate on-chain blockchain data from personal information to enhance privacy while maintaining necessary functionality.
              </div>
            </li>
            <li className="flex items-start">
              <div className="text-gray-400 mr-3 mt-1">•</div>
              <div>
                <span className="font-semibold">Minimal data collection:</span> We collect only information that is directly necessary for providing our services and fulfilling orders.
              </div>
            </li>
            <li className="flex items-start">
              <div className="text-gray-400 mr-3 mt-1">•</div>
              <div>
                <span className="font-semibold">Blockchain-specific security:</span> We utilize specialized security protocols designed for the unique requirements of blockchain commerce.
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">2. Our Privacy Commitment</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">At store.fun, we believe in:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><span className="font-semibold">Transparency:</span> We clearly explain what data we collect and why</li>
            <li><span className="font-semibold">Minimalism:</span> We only collect information that's necessary for our services</li>
            <li><span className="font-semibold">Security:</span> We implement industry-leading safeguards to protect your data</li>
            <li><span className="font-semibold">Control:</span> We give you choices about your information</li>
            <li><span className="font-semibold">No selling:</span> We do not sell your personal information</li>
          </ul>
          <p className="mt-4">
            When you connect your wallet to store.fun, we access only the public information necessary to verify your NFT ownership and enable transactions. We never access your private keys or control your assets.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">3. Information We Collect</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">3.1 Information We Collect</h3>
          <p className="mb-4">store.fun collects:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email address (for account management)</li>
            <li>Wallet addresses (for blockchain transactions)</li>
            <li>Name and contact information</li>
            <li>Shipping address</li>
            <li>Phone number (for delivery purposes)</li>
            <li>Payment information (credit card details via Stripe)</li>
            <li>Order history and preferences</li>
            <li>Technical usage data</li>
          </ul>
          <p className="mt-4">
            <strong>Important:</strong> Your shipping address and personal contact information are collected solely for the purpose of providing this information to shipping carriers to facilitate delivery of your orders. This information is never used for marketing, sold to third parties, or used for any purpose other than order fulfillment and shipping.
          </p>

          <h3 className="text-lg font-medium mb-2 mt-4">3.2 Blockchain Data</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Public wallet addresses</li>
            <li>Transaction hashes and metadata</li>
            <li>Token and NFT ownership information</li>
            <li>Smart contract interactions</li>
            <li>NFT metadata including collection addresses, token IDs, and associated attributes</li>
            <li>NFT-gated access privileges and tier status</li>
            <li>Historical token transactions relevant to platform functionality</li>
            <li>On-chain verification data to confirm ownership and eligibility for special offers</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">3.3 Technical Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>IP address and location data</li>
            <li>Browser type and version</li>
            <li>Device information</li>
            <li>Operating system</li>
            <li>Usage data and analytics</li>
            <li>Cookies and similar tracking technologies</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">4. How We Use Your Information</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">store.fun uses collected information to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide and maintain the platform</li>
            <li>Verify wallet connections and token ownership</li>
            <li>Enable blockchain transactions</li>
            <li>Process orders and payments</li>
            <li>Manage shipping and delivery</li>
            <li>Handle customer support</li>
            <li>Process refunds and returns</li>
            <li>Maintain order history</li>
            <li>Improve platform functionality</li>
            <li>Provide technical support</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">5. Payment Processing</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">5.1 Traditional Payments</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Credit card processing is managed through Stripe</li>
            <li>store.fun does not collect or store any credit card information</li>
            <li>Payment data is protected with industry-standard security measures</li>
            <li>For payment-related inquiries, contact us at support@store.fun</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">5.2 Blockchain Payments</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Cryptocurrency payments are processed through the Solana blockchain</li>
            <li>store.fun provides the secure technical interface for wallet connections</li>
            <li>Transaction data is publicly visible on the blockchain</li>
            <li>We do not have access to private keys or wallet credentials</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">6. Data Sharing and Disclosure</h2>
        <p className="text-gray-300 mb-4">We may share your information with:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Shipping partners (for order delivery <strong>only</strong> - your shipping address and contact information are shared exclusively to facilitate delivery of your orders)</li>
          <li>Payment processors (Stripe and Solana)</li>
          <li>Analytics providers (with anonymized data)</li>
          <li>Legal authorities (when required by law)</li>
          <li>Service providers (who help operate our platform)</li>
          <li>Business partners (with your consent)</li>
        </ul>
        <p className="text-gray-300 mt-4">
          We strictly limit the sharing of your personal information to what is necessary for the specific purpose. Your shipping and contact details are only shared with shipping carriers to complete deliveries and are never sold, rented, or shared for marketing or any other purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">7. Data Security</h2>
        <p className="text-gray-300 mb-4">Your security is our priority. We implement extensive measures to protect your data:</p>
        <div className="text-gray-300 mb-6">
          <h3 className="text-lg font-medium mb-2">7.1 Technical Protections</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>End-to-end encryption for sensitive data transmission</li>
            <li>Advanced firewalls and intrusion detection systems</li>
            <li>Regular security penetration testing by independent experts</li>
            <li>Secure, access-controlled database environments</li>
            <li>HTTPS/TLS encryption for all web traffic</li>
          </ul>
        </div>
        
        <div className="text-gray-300 mb-6">
          <h3 className="text-lg font-medium mb-2">7.2 Organizational Safeguards</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Regular employee security training and awareness programs</li>
            <li>Strict access controls based on the principle of least privilege</li>
            <li>Comprehensive security policies and procedures</li>
            <li>Background checks for employees with access to sensitive systems</li>
            <li>Secure development practices and code reviews</li>
          </ul>
        </div>
        
        <div className="text-gray-300 mb-6">
          <h3 className="text-lg font-medium mb-2">7.3 Blockchain-Specific Security</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>No storage of private keys or seed phrases</li>
            <li>Secure wallet connection protocols</li>
            <li>Verification of transaction signatures</li>
            <li>Secure handling of on-chain data</li>
          </ul>
        </div>
        
        <div className="bg-gray-900 p-5 rounded-md border border-gray-700 mt-6">
          <p className="text-gray-300 mb-3 flex items-center">
            <span className="text-blue-400 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
            </span>
            <span className="font-medium">Our Security Promise:</span>
          </p>
          <p className="text-gray-300 ml-7">
            We understand that trust is earned. That's why we regularly conduct security audits and keep our security measures up to date with evolving threats. We're committed to maintaining the highest standards of data protection to safeguard your information. Your trust is our priority, and we're here to address any concerns you may have about your data security.
          </p>
        </div>
        
        <p className="text-gray-300">
          While we implement best-in-class security measures, no system is completely immune to risks. We continuously monitor for threats and regularly update our security practices to address emerging vulnerabilities.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">8. Your Rights and Choices</h2>
        <p className="text-gray-300 mb-4">You have the right to:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Access your personal information</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data (where applicable)</li>
          <li>Object to data processing</li>
          <li>Export your data</li>
          <li>Opt-out of marketing communications</li>
          <li>Withdraw consent (where processing is based on consent)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">9. Cookies and Tracking</h2>
        <p className="text-gray-300 mb-4">
          We use cookies and similar technologies to enhance your experience. You can control these through your browser settings. We use these technologies for:
        </p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Essential website functionality</li>
          <li>Authentication and security</li>
          <li>Performance monitoring</li>
          <li>Analytics and improvements</li>
          <li>Personalized content and recommendations</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">10. International Data Transfers</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">
            Your information may be transferred and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers through:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Standard contractual clauses approved by relevant data protection authorities</li>
            <li>Data processing agreements with our service providers</li>
            <li>Privacy Shield certification where applicable</li>
            <li>Adequacy decisions issued by relevant authorities</li>
          </ul>
          <p className="mt-4">
            By using our platform, you consent to your data being transferred and processed in countries where data protection standards may differ from your country of residence.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">11. Data Retention</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-2">We retain your information for as long as necessary to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide our services and fulfill our contractual obligations</li>
            <li>Comply with legal requirements and regulatory obligations</li>
            <li>Resolve disputes and enforce our agreements</li>
            <li>Protect against fraudulent or illegal activity</li>
          </ul>
          <p className="mt-4">
            Specific retention periods:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Account information: Duration of account plus 7 years</li>
            <li>Transaction records: 7 years (tax/regulatory requirements)</li>
            <li>Communication records: 3 years</li>
            <li>Marketing preferences: Until consent withdrawal</li>
            <li>Technical logs: 12 months</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">12. Legal Basis for Processing (GDPR)</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-2">Under GDPR, we process your data based on:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Contract performance (processing orders, providing services)</li>
            <li>Legal obligations (tax, regulatory requirements)</li>
            <li>Legitimate interests (security, fraud prevention, service improvement)</li>
            <li>Consent (marketing communications, cookies)</li>
          </ul>
          <p className="mt-4">
            For special category data, additional safeguards and legal bases apply.
          </p>
          
          <h3 className="text-lg font-medium mb-2 mt-4">12.1 European and UK User Rights</h3>
          <p className="mb-2">If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have these additional rights:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Right to access: You can request a copy of your personal data</li>
            <li>Right to rectification: You can request correction of inaccurate data</li>
            <li>Right to erasure: You can request deletion of your data in certain circumstances</li>
            <li>Right to restrict processing: You can request limits on how we use your data</li>
            <li>Right to data portability: You can request a machine-readable copy of your data</li>
            <li>Right to object: You can object to processing based on legitimate interests</li>
            <li>Rights related to automated decision-making: You can request human intervention for significant decisions</li>
          </ul>
          <p className="mt-4">
            To exercise these rights, contact us at support@store.fun. We will respond to all requests within 30 days. You also have the right to lodge a complaint with your local data protection authority.
          </p>
          
          <h3 className="text-lg font-medium mb-2 mt-4">12.2 Data Privacy Contact</h3>
          <p className="mb-2">
            For data privacy matters, contact our team at support@store.fun.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">13. Your Privacy Rights (CCPA)</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-2">California residents have the following rights:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Right to know what personal information is collected</li>
            <li>Right to know if personal information is sold or disclosed</li>
            <li>Right to say no to the sale of personal information</li>
            <li>Right to access personal information</li>
            <li>Right to request deletion of personal information</li>
            <li>Right to equal service and price</li>
          </ul>
          <p className="mt-4">
            To exercise these rights, contact us using the information in Section 15.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">14. Data Breach Procedures</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-2">In the event of a data breach, we will:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Notify affected users within 72 hours of discovery</li>
            <li>Provide details about the nature and extent of the breach</li>
            <li>Inform relevant supervisory authorities as required by law</li>
            <li>Take immediate steps to contain and mitigate the breach</li>
            <li>Conduct a thorough investigation and implement preventive measures</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">15. Children's Privacy</h2>
        <p className="text-gray-300">
          Our services are not intended for children under 13 (or 16 in the European Economic Area). We do not knowingly collect or maintain information from children. If we learn that we have collected personal information from a child, we will take immediate steps to delete such information and terminate the child's account.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">16. Changes to This Policy</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-2">
            We may update this Privacy Policy from time to time. Material changes will be notified through:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email notification to registered users</li>
            <li>Prominent notice on our platform</li>
            <li>Updated "Last updated" date</li>
          </ul>
          <p className="mt-4">
            Your continued use of our services after such changes constitutes your acceptance of the updated policy. If you do not agree to the changes, you must discontinue using our services.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">17. Contact Information</h2>
        <div className="text-gray-300">
          <p className="mb-4">
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <ul className="list-none pl-6 space-y-2">
            <li>Data Privacy Inquiries: support@store.fun</li>
            <li>General Support: support@store.fun</li>
            <li>Telegram: @storedotfun</li>
          </ul>
        </div>
      </section>
    </LegalPage>
  );
}