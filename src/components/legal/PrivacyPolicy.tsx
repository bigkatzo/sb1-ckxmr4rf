export function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="space-y-6 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
          <p>
            This Privacy Policy describes how we collect, use, and protect your personal information when you use our Solana-based e-commerce platform. We are committed to protecting your privacy and ensuring the security of your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
          <h3 className="text-lg font-medium mb-2">2.1 Personal Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Name and contact information</li>
            <li>Email address</li>
            <li>Phone number</li>
            <li>Shipping address</li>
            <li>Wallet addresses</li>
            <li>Transaction history</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">2.2 Technical Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Device information</li>
            <li>Usage data and analytics</li>
            <li>Cookies and similar tracking technologies</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
          <p>We use your information for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Processing your orders and payments</li>
            <li>Communicating with you about your orders</li>
            <li>Providing customer support</li>
            <li>Improving our platform and services</li>
            <li>Preventing fraud and ensuring security</li>
            <li>Complying with legal obligations</li>
            <li>Analyzing usage patterns and trends</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">4. Blockchain and Payment Data</h2>
          <p>
            Our platform uses the Solana blockchain for processing payments. Please note:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Blockchain transactions are public and permanent</li>
            <li>We store transaction signatures and related data</li>
            <li>Wallet addresses are stored for transaction purposes</li>
            <li>We do not store private keys or sensitive wallet information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">5. Data Storage and Security</h2>
          <p>
            We implement appropriate security measures to protect your information:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Encryption of sensitive data</li>
            <li>Secure data storage and transmission</li>
            <li>Regular security assessments</li>
            <li>Access controls and authentication</li>
            <li>Data backup and recovery procedures</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">6. Data Sharing and Disclosure</h2>
          <p>
            We may share your information with:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Service providers and partners</li>
            <li>Shipping and delivery services</li>
            <li>Payment processors</li>
            <li>Legal authorities when required</li>
            <li>Other users (only information you choose to share)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">7. Your Rights and Choices</h2>
          <p>
            You have the right to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
            <li>Export your data</li>
            <li>Object to data processing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">8. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Maintain your session</li>
            <li>Remember your preferences</li>
            <li>Analyze platform usage</li>
            <li>Improve user experience</li>
          </ul>
          <p className="mt-2">
            You can control cookie settings through your browser preferences.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">9. Children's Privacy</h2>
          <p>
            Our platform is not intended for children under 13. We do not knowingly collect or maintain information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">10. Changes to Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the effective date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">11. Contact Us</h2>
          <p>
            For questions about this Privacy Policy or our data practices, please contact us at support@store.fun
          </p>
        </section>

        <section className="text-sm text-gray-400 mt-8">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </section>
      </div>
    </div>
  );
} 