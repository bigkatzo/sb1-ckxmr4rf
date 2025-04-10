import { LegalPage } from '../../components/legal/LegalPage';

export function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-gray-400 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
        <p className="text-gray-300 mb-4">
          This Privacy Policy explains how store.fun ("we," "us," or "our") collects, uses, shares, and protects your personal information when you use our e-commerce platform. We are committed to protecting your privacy and ensuring the security of your data while providing a seamless shopping experience that bridges traditional e-commerce with Web3 technology.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">2.1 Platform Information</h3>
          <p className="mb-4">As a technology platform provider, store.fun collects:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email address (for account management)</li>
            <li>Wallet addresses (for blockchain transactions)</li>
            <li>Technical usage data</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">2.2 Information Collected by Logic Group LLC</h3>
          <p className="mb-4">Our operating partner, Logic Group LLC, collects and manages:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Name and contact information</li>
            <li>Shipping address</li>
            <li>Phone number (for delivery purposes)</li>
            <li>Payment information (credit card details via Stripe)</li>
            <li>Order history and preferences</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">2.3 Blockchain Data</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Public wallet addresses</li>
            <li>Transaction hashes and metadata</li>
            <li>Token and NFT ownership information</li>
            <li>Smart contract interactions</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">2.4 Technical Information</h3>
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
        <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
        <div className="text-gray-300 mb-4">
          <h3 className="text-lg font-medium mb-2">3.1 Platform Services</h3>
          <p className="mb-4">store.fun uses collected information to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide and maintain the technology platform</li>
            <li>Verify wallet connections and token ownership</li>
            <li>Enable blockchain transactions</li>
            <li>Improve platform functionality</li>
            <li>Provide technical support</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">3.2 Services Provided by Logic Group LLC</h3>
          <p className="mb-4">Logic Group LLC uses collected information to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Process orders and payments</li>
            <li>Manage shipping and delivery</li>
            <li>Handle customer support</li>
            <li>Process refunds and returns</li>
            <li>Maintain order history</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">4. Payment Processing</h2>
        <div className="text-gray-300 mb-4">
          <p className="mb-4">All payment processing is handled by Logic Group LLC:</p>
          
          <h3 className="text-lg font-medium mb-2">4.1 Traditional Payments</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Credit card processing is managed by Logic Group LLC through Stripe</li>
            <li>store.fun does not collect or store any credit card information</li>
            <li>Payment data is subject to Logic Group LLC's privacy practices</li>
            <li>For payment-related inquiries, contact admin@logic300.com</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">4.2 Blockchain Payments</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Cryptocurrency payments are managed by Logic Group LLC</li>
            <li>store.fun only provides the technical interface for wallet connections</li>
            <li>Transaction data is publicly visible on the blockchain</li>
            <li>We do not have access to private keys or wallet credentials</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
        <p className="text-gray-300 mb-4">We may share your information with:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Shipping partners (for order delivery)</li>
          <li>Payment processors (Stripe and Solana)</li>
          <li>Analytics providers (with anonymized data)</li>
          <li>Legal authorities (when required by law)</li>
          <li>Service providers (who help operate our platform)</li>
          <li>Business partners (with your consent)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">6. Data Security</h2>
        <p className="text-gray-300 mb-4">We protect your data through:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Encryption of sensitive information</li>
          <li>Regular security audits and assessments</li>
          <li>Secure data storage and transmission</li>
          <li>Access controls and authentication</li>
          <li>Employee training on data protection</li>
          <li>Incident response procedures</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">7. Your Rights and Choices</h2>
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
        <h2 className="text-xl font-semibold mb-4">8. Cookies and Tracking</h2>
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
        <h2 className="text-xl font-semibold mb-4">9. International Data Transfers</h2>
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
        <h2 className="text-xl font-semibold mb-4">10. Data Retention</h2>
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
        <h2 className="text-xl font-semibold mb-4">11. Legal Basis for Processing (GDPR)</h2>
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
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">12. Your Privacy Rights (CCPA)</h2>
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
        <h2 className="text-xl font-semibold mb-4">13. Data Breach Procedures</h2>
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
        <h2 className="text-xl font-semibold mb-4">14. Children's Privacy</h2>
        <p className="text-gray-300">
          Our services are not intended for children under 13 (or 16 in the European Economic Area). We do not knowingly collect or maintain information from children. If we learn that we have collected personal information from a child, we will take immediate steps to delete such information and terminate the child's account.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">15. Changes to This Policy</h2>
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
        <h2 className="text-xl font-semibold mb-4">16. Contact Information</h2>
        <div className="text-gray-300">
          <p className="mb-4">
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <ul className="list-none pl-6 space-y-2">
            <li>Data Protection Officer: privacy@store.fun</li>
            <li>General Support: support@store.fun</li>
            <li>Telegram: @storedotfun</li>
          </ul>
        </div>
      </section>
    </LegalPage>
  );
}